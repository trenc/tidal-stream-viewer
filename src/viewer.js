import { downloadAtlas, loadAtlasIndex } from './atlas.js';
import { clearVectors, createMapView, drawVectors, fitToBounds } from './map.js';
import { parseCurrents } from './netcdf.js';
import { createPlayback } from './playback.js';
import { createSession } from './session.js';
import { createTideService } from './tide-service.js';
import { buildAxis } from './timeline.js';
import { loadSettings, saveSettings, TideApiError } from './tides.js';

const MS_TO_KNOTS = 1.943844;
const SPAN_DAYS = 5;
const LEVEL_STEP_MINUTES = 10;

const ARROW_LEVELS = [
  { id: 'overview', label: 'Overview', arrows: 200 },
  { id: 'standard', label: 'Standard', arrows: 1500 },
  { id: 'fine', label: 'Fine', arrows: 3000 },
];
const DEFAULT_ARROW_LEVEL = 'standard';
const ARROW_LEVEL_KEY = 'currents.arrowLevel';

const pad = (n) => String(n).padStart(2, '0');

function toLocalInput(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function roundToStep(date, minutes) {
  const step = minutes * 60000;
  return new Date(Math.round(date.getTime() / step) * step);
}

function storedArrowLevel() {
  const saved = localStorage.getItem(ARROW_LEVEL_KEY);
  return ARROW_LEVELS.some((level) => level.id === saved) ? saved : DEFAULT_ARROW_LEVEL;
}

// Alpine component: connects the page to the session, the tide service and the map.
// Heavy objects live in the closure, not in reactive state.
export function currentViewer() {
  let view = null;
  let session = null;
  let playback = null;
  let queued = false;
  let manualMode = false;
  let tideRequest = 0;

  const tideService = createTideService();
  const settings = loadSettings();

  return {
    loading: false,
    error: '',
    fileName: '',
    info: '',
    hasData: false,
    isTidal: false,
    referenceName: '',
    siteName: '',
    stepMinutes: 30,
    sliderMax: 0,
    sliderIndex: 0,
    when: '',
    days: [],
    wave: null,
    cursor: { x: 0, y: null },
    clockLabel: '',
    heightLabel: '',
    nextLabel: '',
    detail: '',
    status: '',
    statusIsError: false,
    tideAttribution: '',
    depthIndex: 0,
    depthLabels: [],
    arrowLevels: ARROW_LEVELS,
    arrowLevel: storedArrowLevel(),
    visibleCount: 0,
    maxSpeedKn: '0.00',
    frameMaxKn: '0.00',
    playing: false,
    dragging: false,

    atlases: [],
    atlasId: '',
    atlasProgress: 0,

    apiBase: settings.apiBase,
    apiKey: settings.apiKey,
    manualHw: '',
    manualCoef: '70',

    init() {
      playback = createPlayback(() => this.tick());

      this.$nextTick(() => {
        const container = document.getElementById('current-map');
        if (!container) {
          console.error('Missing <div id="current-map"> in index.html');
          return;
        }
        view = createMapView(container, () => this.render());
        this.loadAtlasList();
      });
    },

    // Atlas loading

    async loadAtlasList() {
      try {
        this.atlases = await loadAtlasIndex();
      } catch (error) {
        console.warn(error);
        this.atlases = [];
      }
    },

    async loadFile(event) {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;

      this.atlasId = '';
      await this.openBuffer(await file.arrayBuffer(), file.name);
    },

    async selectAtlas(id) {
      const entry = this.atlases.find((atlas) => atlas.id === id);
      if (!entry) return;

      this.atlasId = id;
      this.error = '';
      this.loading = true;
      this.atlasProgress = 0;

      try {
        const buffer = await downloadAtlas(entry, (progress) => {
          this.atlasProgress = progress;
        });
        await this.openBuffer(buffer, entry.label);
      } catch (error) {
        console.error(error);
        this.loading = false;
        this.error = error.message;
      }
    },

    async openBuffer(buffer, name) {
      this.stop();
      this.error = '';
      this.loading = true;
      this.hasData = false;
      if (view) clearVectors(view);

      try {
        const model = parseCurrents(buffer);
        session = createSession(model);
        manualMode = false;
        tideRequest++;

        this.fileName = name;
        this.info = model.info;
        this.isTidal = session.isTidal;
        this.referenceName = session.referenceName;
        this.siteName = '';
        this.tideAttribution = '';
        this.wave = null;
        this.depthIndex = 0;
        this.depthLabels = Array.from({ length: model.depthCount }, (_, i) =>
          model.depths[i] !== undefined ? `${model.depths[i].toFixed(1)} m` : `Level ${i}`
        );
        this.maxSpeedKn = (model.maxSpeed * MS_TO_KNOTS).toFixed(2);
        this.frameMaxKn = '0.00';
        this.setStatus('');
        this.setupSlider();
        this.hasData = true;

        fitToBounds(view, model.bounds);
        this.render();

        if (session.isTidal) await this.refreshTides();
      } catch (error) {
        console.error(error);
        session = null;
        this.info = error.info || '';
        this.error = this.explain(error);
      } finally {
        this.loading = false;
      }
    },

    explain(error) {
      if (/valid NetCDF|magic|version/i.test(error.message)) {
        return 'Unsupported file. The browser parser reads classic NetCDF-3 only. Convert it first: nccopy -k classic input.nc output.nc';
      }
      return error.message;
    },

    // Time window and slider

    setupSlider() {
      const config = session.sliderConfig(SPAN_DAYS);
      this.stepMinutes = config.stepMinutes;
      this.sliderMax = config.sliderMax;
      this.sliderIndex = 0;

      if (session.isTidal) {
        this.when = toLocalInput(roundToStep(new Date(), this.stepMinutes));
        this.applyWindow();
      }
    },

    timeWindow() {
      const startMs = new Date(this.when).getTime();
      return { startMs, endMs: startMs + SPAN_DAYS * 864e5, stepMinutes: this.stepMinutes };
    },

    applyWindow() {
      const { startMs, endMs } = this.timeWindow();
      this.days = Number.isNaN(startMs) ? [] : buildAxis(startMs, endMs);
    },

    async setWhen(value) {
      this.when = value;
      this.sliderIndex = 0;
      this.wave = null;
      this.applyWindow();

      if (!manualMode) session?.clearTide();
      this.render();

      if (!manualMode) await this.refreshTides();
    },

    setSlider(value) {
      this.sliderIndex = Math.min(Math.max(Number(value), 0), this.sliderMax);
      this.queueRender();
    },

    stepSlider(delta) {
      this.setSlider(this.sliderIndex + delta);
    },

    scrub(event) {
      const rect = event.currentTarget.getBoundingClientRect();
      const fraction = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
      this.setSlider(Math.round(fraction * this.sliderMax));
    },

    scrubStart(event) {
      event.currentTarget.setPointerCapture(event.pointerId);
      this.dragging = true;
      this.scrub(event);
    },

    scrubMove(event) {
      if (this.dragging) this.scrub(event);
    },

    scrubEnd() {
      this.dragging = false;
    },

    // Playback

    tick() {
      const stride = session?.isTidal ? Math.max(1, Math.round(30 / this.stepMinutes)) : 1;
      const next = this.sliderIndex + stride;
      this.sliderIndex = next > this.sliderMax ? 0 : next;
      this.render();
    },

    togglePlay() {
      this.playing = playback.toggle();
    },

    stop() {
      playback?.stop();
      this.playing = false;
    },

    // Display options

    setDepth(value) {
      this.depthIndex = Number(value);
      this.render();
    },

    setArrowLevel(id) {
      this.arrowLevel = id;
      localStorage.setItem(ARROW_LEVEL_KEY, id);
      this.render();
    },

    arrowBudget() {
      const level = ARROW_LEVELS.find((item) => item.id === this.arrowLevel);
      return (level ?? ARROW_LEVELS[1]).arrows;
    },

    // Tide data

    setStatus(message, isError = false) {
      this.status = message;
      this.statusIsError = isError;
    },

    saveTideSettings() {
      saveSettings({ apiBase: this.apiBase, apiKey: this.apiKey });
      const saved = loadSettings();
      this.apiBase = saved.apiBase;
      this.apiKey = saved.apiKey;
      this.setStatus('Settings saved.');
    },

    applyTide(data) {
      this.siteName = data.siteName;
      this.tideAttribution = data.attribution;
      this.wave = session.setTide(data, this.timeWindow());

      if (data.levelsError) {
        this.setStatus(`Tide curve unavailable. ${data.levelsError.message}`, true);
      } else {
        this.setStatus(
          data.events.length ? '' : 'No tide times returned for that period.',
          !data.events.length
        );
      }
    },

    async refreshTides() {
      if (!session?.isTidal) return;

      const { startMs, endMs } = this.timeWindow();
      if (Number.isNaN(startMs)) {
        this.setStatus('Enter a valid start date and time.', true);
        return;
      }

      if (!session.reference) {
        this.setStatus('The file names no reference port. Use the manual tide under "Tide data".', true);
        return;
      }

      const mine = ++tideRequest;
      this.setStatus('Looking up tide times…');
      this.wave = null;

      try {
        const data = await tideService.load(session.reference, startMs, endMs, LEVEL_STEP_MINUTES);
        if (mine !== tideRequest) return;
        this.applyTide(data);
      } catch (error) {
        if (mine !== tideRequest) return;
        console.error(error);
        session.clearTide();
        this.setStatus(
          error instanceof TideApiError ? error.message : `Tide lookup failed: ${error.message}`,
          true
        );
      }

      this.render();
    },

    useManualTide() {
      const at = new Date(this.manualHw);
      if (Number.isNaN(at.getTime())) {
        this.setStatus('Enter the local time of the reference tide.', true);
        return;
      }

      manualMode = true;
      tideRequest++;
      this.applyTide(tideService.manual(at, Number(this.manualCoef) || null));
      this.setStatus('Using the manual tide. No tide curve offline.');
      this.render();
    },

    async useOnlineTide() {
      manualMode = false;
      await this.refreshTides();
    },

    // Rendering

    queueRender() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        this.render();
      });
    },

    render() {
      if (!view || !session) return;

      const window = this.timeWindow();
      if (session.isTidal && Number.isNaN(window.startMs)) return;

      const snap = session.snapshot(this.sliderIndex, window);

      this.clockLabel = snap.clockLabel;
      this.heightLabel = snap.heightLabel;
      this.nextLabel = snap.nextLabel;
      this.cursor = snap.cursor;
      this.detail = snap.detail;

      if (!snap.draw) {
        clearVectors(view);
        this.visibleCount = 0;
        this.frameMaxKn = '0.00';
        return;
      }

      const drawn = drawVectors(view, session.model, {
        ...snap.draw,
        depth: this.depthIndex,
        maxArrows: this.arrowBudget(),
      });

      this.visibleCount = drawn.count;
      this.frameMaxKn = (drawn.maxSpeed * MS_TO_KNOTS).toFixed(2);
    },
  };
}
