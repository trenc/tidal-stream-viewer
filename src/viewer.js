import { downloadAtlas, loadAtlasIndex, openFrameAtlas } from './atlas.js';
import {
  OFFSET_OPTIONS,
  browserOffset,
  formatDateTime,
  gmtLabel,
  nearestOffset,
  parseDateTime,
} from './clock.js';
import { clearVectors, createMapView, drawVectors, fitToBounds } from './map.js';
import {
  LIMIT_DAYS,
  VIEW_HALF_MS,
  clampAndSnap,
  dataRange,
  dragCenter,
  keyboardMinutes,
  limitsAround,
  shadeOf,
  wheelDelta,
} from './navigation.js';
import { parseCurrents } from './netcdf.js';
import { createPlayback } from './playback.js';
import { formatReleaseDate } from './release-date.js';
import { createSession } from './session.js';
import { createTideService } from './tide-service.js';
import { buildAxis } from './timeline.js';
import { TideApiError } from './tides.js';

const MS_TO_KNOTS = 1.943844;
const LEVEL_STEP_MINUTES = 10;

const ARROW_LEVELS = [
  { id: 'overview', label: 'Overview', arrows: 200 },
  { id: 'standard', label: 'Standard', arrows: 1500 },
  { id: 'fine', label: 'Fine', arrows: 3000 },
];
const DEFAULT_ARROW_LEVEL = 'standard';
const ARROW_LEVEL_KEY = 'currents.arrowLevel';
const OFFSET_KEY = 'currents.gmtOffset';

const DATE_FORMAT_HINT = 'dd/mm/yyyy hh:mm';

function storedArrowLevel() {
  const saved = localStorage.getItem(ARROW_LEVEL_KEY);
  return ARROW_LEVELS.some((level) => level.id === saved) ? saved : DEFAULT_ARROW_LEVEL;
}

function storedOffset() {
  const saved = localStorage.getItem(OFFSET_KEY);
  return nearestOffset(saved === null ? browserOffset() : Number(saved));
}

// Alpine component: connects the page to the session, the tide service and the map.
// Heavy objects live in the closure, not in reactive state.
export function currentViewer() {
  let view = null;
  let session = null;
  let playback = null;
  let queued = false;
  let tideRequest = 0;
  let frameRequest = 0;
  let drag = null;
  let freeCenter = null; // unsnapped position while scrolling, so small wheel steps add up

  const tideService = createTideService();

  return {
    loading: false,
    framesLoading: false,
    framesDone: 0,
    framesTotal: 0,
    error: '',
    fileName: '',
    info: '',
    release: '',
    hasData: false,
    isTidal: false,
    referenceName: '',
    siteName: '',
    stepMinutes: 30,
    sliderMax: 0,
    sliderIndex: 0,
    centerMs: 0,
    limits: { minMs: 0, maxMs: 0 },
    limitDays: LIMIT_DAYS,
    days: [],
    wave: null,
    cursor: { x: 50, y: null },
    clockLabel: '',
    heightLabel: '',
    nextLabel: '',
    detail: '',
    status: '',
    statusIsError: false,
    tideAttribution: '',
    tideNotice: '',
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

    manualHw: '',
    manualCoef: '70',

    gmtOffset: storedOffset(),
    offsetOptions: OFFSET_OPTIONS,
    dateFormatHint: DATE_FORMAT_HINT,

    get offsetLabel() {
      return gmtLabel(this.gmtOffset);
    },

    // The time under the marker, as text in the chosen time zone.
    get when() {
      return this.centerMs ? formatDateTime(this.centerMs, this.gmtOffset) : '';
    },

    // Share of the track beyond the limits, shaded on each side.
    get shade() {
      return shadeOf(this.centerMs, this.limits);
    },

    // Loading indicator on the map: frames first, then the atlas itself.
    get busy() {
      return this.framesLoading || this.loading;
    },

    get busyLabel() {
      if (this.framesLoading) {
        return this.framesTotal > 1
          ? `Loading current data ${this.framesDone}/${this.framesTotal}`
          : 'Loading current data…';
      }

      const percent =
        this.atlasProgress > 0 && this.atlasProgress < 1 ? ` ${Math.round(this.atlasProgress * 100)} %` : '';
      return `Opening atlas…${percent}`;
    },

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
        if (entry.kind === 'frames') {
          await this.openModel(() => openFrameAtlas(entry), entry.label);
        } else {
          const buffer = await downloadAtlas(entry, (progress) => {
            this.atlasProgress = progress;
          });
          await this.openBuffer(buffer, entry.label);
        }
      } catch (error) {
        console.error(error);
        this.loading = false;
        this.error = error.message;
      }
    },

    async openBuffer(buffer, name) {
      await this.openModel(() => parseCurrents(buffer), name);
    },

    // makeModel returns a model (or a promise of one); errors are reported here for both sources.
    async openModel(makeModel, name) {
      this.stop();
      this.error = '';
      this.loading = true;
      frameRequest++;
      drag = null;
      freeCenter = null;
      this.framesLoading = false;
      this.hasData = false;
      if (view) clearVectors(view);

      try {
        const model = await makeModel();
        session = createSession(model);
        tideRequest++;

        this.fileName = name;
        this.info = model.info;
        this.release = formatReleaseDate(model.release);
        this.isTidal = session.isTidal;
        this.referenceName = session.referenceName;
        this.siteName = '';
        this.tideAttribution = '';
        this.tideNotice = '';
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

    // Time marker, limits and view

    setupSlider() {
      const config = session.sliderConfig(1);
      this.stepMinutes = config.stepMinutes;
      this.sliderMax = config.sliderMax;
      this.sliderIndex = 0;

      if (session.isTidal) {
        this.limits = limitsAround(Date.now());
        this.centerMs = clampAndSnap(Date.now(), this.limits, this.stepMinutes);
      }
    },

    // The visible part of the timeline: the marker time with the same span on both sides.
    timeWindow() {
      return {
        startMs: this.centerMs - VIEW_HALF_MS,
        endMs: this.centerMs + VIEW_HALF_MS,
        stepMinutes: this.stepMinutes,
        offsetMinutes: this.gmtOffset,
      };
    },

    // Moves the marker, stopping at the limits and on the atlas time step.
    setCenter(ms) {
      this.centerMs = clampAndSnap(ms, this.limits, this.stepMinutes);
      this.queueRender();
    },

    moveTo(ms) {
      freeCenter = null;
      this.setCenter(ms);
    },

    stepTime(minutes) {
      this.moveTo(this.centerMs + minutes * 60000);
    },

    goNow() {
      this.setStatus('');
      this.moveTo(Date.now());
    },

    // input is the text field, so its content can be replaced by the time actually used.
    setWhen(value, input) {
      const ms = parseDateTime(value, this.gmtOffset);

      if (Number.isNaN(ms)) {
        this.setStatus(`Enter the time as ${DATE_FORMAT_HINT}.`, true);
        if (input) input.value = this.when;
        return;
      }

      const inside = ms >= this.limits.minMs && ms <= this.limits.maxMs;
      this.setStatus(inside ? '' : `The timeline is limited to ${LIMIT_DAYS} days before and after today.`);

      this.moveTo(ms);
      if (input) input.value = this.when;
    },

    // Keeps the same moments in time and rewrites the typed manual tide in the new zone.
    setOffset(value) {
      const next = nearestOffset(Number(value));
      const manualMs = parseDateTime(this.manualHw, this.gmtOffset);

      this.gmtOffset = next;
      localStorage.setItem(OFFSET_KEY, String(next));

      if (!Number.isNaN(manualMs)) this.manualHw = formatDateTime(manualMs, next);

      this.render();
    },

    // Dragging, scrolling and keys on the timeline

    scrubStart(event) {
      this.stop();
      event.currentTarget.setPointerCapture(event.pointerId);
      this.dragging = true;
      drag = {
        x: event.clientX,
        center: this.centerMs,
        width: event.currentTarget.getBoundingClientRect().width,
      };
    },

    scrubMove(event) {
      if (!drag) return;
      this.moveTo(dragCenter(drag.center, event.clientX - drag.x, drag.width));
    },

    scrubEnd() {
      drag = null;
      this.dragging = false;
    },

    wheel(event) {
      this.stop();
      const width = event.currentTarget.getBoundingClientRect().width;

      freeCenter = (freeCenter ?? this.centerMs) + wheelDelta(event.deltaX, event.deltaY, width);
      freeCenter = Math.min(Math.max(freeCenter, this.limits.minMs), this.limits.maxMs);
      this.setCenter(freeCenter);
    },

    key(event) {
      if (event.key === 'Home') {
        event.preventDefault();
        this.goNow();
        return;
      }

      const minutes = keyboardMinutes(event.key, event.shiftKey, this.stepMinutes);
      if (minutes === null) return;

      event.preventDefault();
      this.stepTime(minutes);
    },

    // Slider for series without a tidal time axis

    setSlider(value) {
      this.sliderIndex = Math.min(Math.max(Number(value), 0), this.sliderMax);
      this.queueRender();
    },

    // Playback

    playbackStride() {
      return session?.isTidal ? Math.max(1, Math.round(30 / this.stepMinutes)) : 1;
    },

    tick() {
      if (!session?.isTidal) {
        const next = this.sliderIndex + this.playbackStride();
        this.sliderIndex = next > this.sliderMax ? 0 : next;
        this.render();
        return;
      }

      const next = this.centerMs + this.playbackStride() * this.stepMinutes * 60000;
      if (next > this.limits.maxMs) {
        this.stop();
        return;
      }

      this.moveTo(next);
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

    applyTide(data) {
      this.siteName = data.siteName;
      this.tideAttribution = data.attribution;
      this.tideNotice = data.statusNotice;
      session.setTide(data);

      if (data.levelsError) {
        this.setStatus(`Tide curve unavailable. ${data.levelsError.message}`, true);
      } else {
        this.setStatus(
          data.events.length ? '' : 'No tide times returned for that period.',
          !data.events.length
        );
      }
    },

    // Loads the tide data for the whole range the marker can reach, so moving it needs no further requests.
    async refreshTides() {
      if (!session?.isTidal) return;

      if (!session.reference) {
        this.setStatus('The file names no reference port. Use the manual tide under "Tide data".', true);
        return;
      }

      const { startMs, endMs } = dataRange(this.limits);
      const mine = ++tideRequest;
      this.setStatus('Looking up tide times…');

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
      const atMs = parseDateTime(this.manualHw, this.gmtOffset);
      if (Number.isNaN(atMs)) {
        this.setStatus(`Enter the time of the reference tide as ${DATE_FORMAT_HINT}.`, true);
        return;
      }

      tideRequest++;
      this.applyTide(tideService.manual(new Date(atMs), Number(this.manualCoef) || null));
      this.setStatus('Using the manual tide. No tide curve offline.');
      this.render();
    },

    async useOnlineTide() {
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

    // True when the frames for this draw are in memory. Otherwise starts loading them,
    // shows the loading indicator and renders again when they arrive.
    // Models without prefetch (NetCDF-3) are always ready.
    ensureFrames(draw) {
      const model = session.model;
      if (!model.prefetch) return true;

      const ready = model.isReady(draw);
      const ahead = this.playing ? this.playbackStride() : 0;
      if (ready && !ahead) return true;

      // Only the latest blocking request may update or hide the indicator.
      const mine = ready ? frameRequest : ++frameRequest;

      if (!ready) {
        this.framesLoading = true;
        this.framesDone = 0;
        this.framesTotal = 0;
      }

      const onProgress = ready
        ? undefined
        : ({ done, total }) => {
            if (mine !== frameRequest) return;
            this.framesDone = done;
            this.framesTotal = total;
          };

      model
        .prefetch(draw, ahead, onProgress)
        .then(() => {
          if (ready) return;
          if (mine === frameRequest) this.framesLoading = false;
          this.queueRender();
        })
        .catch((error) => {
          if (!ready && mine === frameRequest) this.framesLoading = false;
          this.error = error.message;
        });

      return ready;
    },

    render() {
      if (!view || !session) return;
      if (session.isTidal && !this.centerMs) return;

      const window = this.timeWindow();
      const snap = session.isTidal
        ? session.snapshotAt(this.centerMs, window)
        : session.snapshot(this.sliderIndex, window);

      this.clockLabel = snap.clockLabel;
      this.heightLabel = snap.heightLabel;
      this.nextLabel = snap.nextLabel;
      this.cursor = snap.cursor;
      this.detail = snap.detail;

      if (session.isTidal) {
        this.wave = snap.wave;
        this.days = buildAxis(window.startMs, window.endMs, this.gmtOffset);
      }

      // Keeps the previous arrows on screen until the needed frames have arrived.
      if (snap.draw && !this.ensureFrames(snap.draw)) return;

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
