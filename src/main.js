import Alpine from 'alpinejs';
import { registerSW } from 'virtual:pwa-register';

import './style.css';

import { downloadAtlas, loadAtlasIndex } from './atlas.js';
import { parseCurrents } from './netcdf.js';
import { clearVectors, createMapView, drawVectors, fitToBounds } from './map.js';
import { planBlend, planFrame } from './tide-plan.js';
import { buildAxis, buildWave, cursorPosition, heightAt, nextExtremum } from './timeline.js';
import {
  addDays,
  fetchExtrema,
  fetchLevels,
  findSite,
  loadSettings,
  saveSettings,
  TideApiError,
} from './tides.js';

registerSW({ immediate: true });

const MS_TO_KNOTS = 1.943844;
const SPAN_DAYS = 5;
const LEVEL_STEP_MINUTES = 10;

const pad = (n) => String(n).padStart(2, '0');

function toLocalInput(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function utcDay(date) {
  return date.toISOString().slice(0, 10);
}

function roundToStep(date, minutes) {
  const step = minutes * 60000;
  return new Date(Math.round(date.getTime() / step) * step);
}

function formatOffset(minutes) {
  if (minutes === 0) return '±0:00';
  const sign = minutes < 0 ? '−' : '+';
  const abs = Math.abs(minutes);
  return `${sign}${Math.floor(abs / 60)}:${pad(abs % 60)}`;
}

function formatClock(date) {
  return date.toLocaleString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

Alpine.data('currentViewer', () => {
  let view = null;
  let model = null;
  let events = [];
  let extrema = [];
  let levels = [];
  let manualMode = false;
  let timer = null;
  let queued = false;

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
    maxArrows: 900,
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
        model = parseCurrents(buffer);
        events = [];
        extrema = [];
        levels = [];
        manualMode = false;

        this.fileName = name;
        this.info = model.info;
        this.isTidal = model.tidal;
        this.referenceName = model.reference
          ? `${model.reference.type} ${model.reference.port}`
          : 'reference tide';
        this.siteName = '';
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

        if (model.tidal) await this.refreshTides();
      } catch (error) {
        console.error(error);
        model = null;
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

    setupSlider() {
      if (!model.tidal) {
        this.sliderMax = model.timeCount - 1;
        this.sliderIndex = 0;
        return;
      }

      const [first, second] = model.offsets;
      this.stepMinutes = model.timeCount > 1 && first !== second ? Math.abs(second - first) : 30;
      this.sliderMax = Math.round((SPAN_DAYS * 1440) / this.stepMinutes);
      this.sliderIndex = 0;
      this.when = toLocalInput(roundToStep(new Date(), this.stepMinutes));
      this.applyWindow();
    },

    windowBounds() {
      const startMs = new Date(this.when).getTime();
      return { startMs, endMs: startMs + SPAN_DAYS * 864e5 };
    },

    applyWindow() {
      const { startMs, endMs } = this.windowBounds();
      this.days = Number.isNaN(startMs) ? [] : buildAxis(startMs, endMs);
    },

    setStatus(message, isError = false) {
      this.status = message;
      this.statusIsError = isError;
    },

    async setWhen(value) {
      this.when = value;
      this.sliderIndex = 0;
      this.wave = null;
      this.applyWindow();
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

    queueRender() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        this.render();
      });
    },

    setDepth(value) {
      this.depthIndex = Number(value);
      this.render();
    },

    setMaxArrows(value) {
      this.maxArrows = Number(value);
      this.render();
    },

    saveTideSettings() {
      saveSettings({ apiBase: this.apiBase, apiKey: this.apiKey });
      const saved = loadSettings();
      this.apiBase = saved.apiBase;
      this.apiKey = saved.apiKey;
      this.setStatus('Settings saved.');
    },

    async refreshTides() {
      if (!model?.tidal) return;

      const { startMs, endMs } = this.windowBounds();
      if (Number.isNaN(startMs)) {
        this.setStatus('Enter a valid start date and time.', true);
        return;
      }

      if (!model.reference) {
        this.setStatus('The file names no reference port. Use the manual tide under "Tide data".', true);
        return;
      }

      this.setStatus('Looking up tide times…');
      this.wave = null;
      levels = [];

      try {
        const current = loadSettings();
        const site = await findSite(model.reference.port, current);

        if (!site) {
          throw new TideApiError(`No api-maree.fr site named "${model.reference.port}".`);
        }

        this.siteName = site.site_name;

        const start = new Date(startMs);
        const end = new Date(endMs);

        const result = await fetchExtrema(
          site,
          addDays(utcDay(start), -1),
          addDays(utcDay(end), 1),
          current
        );

        const wantedType = model.reference.type === 'LW' ? 'BM' : 'PM';
        extrema = result.events;
        events = extrema
          .filter((item) => item.type === wantedType)
          .map((item) => ({ at: item.at, coef: item.coef }));
        this.tideAttribution = result.attribution;

        try {
          levels = await fetchLevels(site, start, end, LEVEL_STEP_MINUTES, current);
          this.wave = buildWave(levels, extrema, startMs, endMs);
          this.setStatus(events.length ? '' : 'No tide times returned for that period.', !events.length);
        } catch (error) {
          console.error(error);
          this.setStatus(`Tide curve unavailable. ${error.message}`, true);
        }
      } catch (error) {
        console.error(error);
        events = [];
        extrema = [];
        levels = [];
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
      events = [{ at, coef: Number(this.manualCoef) || null }];
      extrema = [];
      levels = [];
      this.wave = null;
      this.setStatus('Using the manual tide. No tide curve offline.');
      this.render();
    },

    async useOnlineTide() {
      manualMode = false;
      await this.refreshTides();
    },

    togglePlay() {
      if (this.playing) return this.stop();
      this.playing = true;

      const stride = model?.tidal ? Math.max(1, Math.round(30 / this.stepMinutes)) : 1;

      timer = setInterval(() => {
        const next = this.sliderIndex + stride;
        this.sliderIndex = next > this.sliderMax ? 0 : next;
        this.render();
      }, 250);
    },

    stop() {
      clearInterval(timer);
      timer = null;
      this.playing = false;
    },

    updateReadout(targetMs, startMs, endMs) {
      const height = levels.length ? heightAt(levels, targetMs) : null;

      if (height === null) {
        this.heightLabel = '';
      } else {
        const later = heightAt(levels, targetMs + 6e5);
        const arrow = later === null ? '' : later > height ? ' ↑' : ' ↓';
        this.heightLabel = `${height.toFixed(2)} m${arrow}`;
      }

      const next = nextExtremum(extrema, targetMs);
      this.nextLabel = next
        ? `Next ${next.type === 'PM' ? 'HW' : 'LW'} ${formatTime(next.at)} · ${next.height.toFixed(2)} m`
        : '';

      this.cursor = cursorPosition(startMs, endMs, targetMs, this.wave, height);
    },

    render() {
      if (!view || !model) return;

      if (!model.tidal) {
        const time = model.times[this.sliderIndex];
        this.clockLabel = time ? time.toISOString().replace(':00.000Z', 'Z').replace('T', ' ') : 'No time axis';
        this.detail = '';

        const drawn = drawVectors(view, model, {
          frame: this.sliderIndex,
          depth: this.depthIndex,
          low: 0,
          high: 0,
          weight: 0,
          maxArrows: this.maxArrows,
        });

        this.visibleCount = drawn.count;
        this.frameMaxKn = (drawn.maxSpeed * MS_TO_KNOTS).toFixed(2);
        return;
      }

      const { startMs, endMs } = this.windowBounds();
      if (Number.isNaN(startMs)) return;

      const targetMs = startMs + this.sliderIndex * this.stepMinutes * 6e4;
      const target = new Date(targetMs);

      this.clockLabel = formatClock(target);
      this.updateReadout(targetMs, startMs, endMs);

      const plan = planFrame(model, events, target);
      if (!plan) {
        clearVectors(view);
        this.visibleCount = 0;
        this.frameMaxKn = '0.00';
        this.detail = 'Waiting for tide times. Check "Tide data" in the sidebar.';
        return;
      }

      const blend = planBlend(model.coeffs, plan.event.coef);

      const drawn = drawVectors(view, model, {
        frame: plan.frame,
        depth: this.depthIndex,
        low: blend.low,
        high: blend.high,
        weight: blend.weight,
        maxArrows: this.maxArrows,
      });

      this.visibleCount = drawn.count;
      this.frameMaxKn = (drawn.maxSpeed * MS_TO_KNOTS).toFixed(2);
      this.detail = this.describe(plan, blend);
    },

    describe(plan, blend) {
      const coef = Number.isFinite(plan.event.coef)
        ? `coef ${plan.event.coef}`
        : 'coef unknown, 70 assumed';
      const mix =
        blend.low === blend.high
          ? ''
          : ` → ${Math.round(blend.weight * 100)} % of the way from neap to spring`;
      const edge = plan.clamped ? ' · beyond ±6 h of this tide: showing the edge frame' : '';

      return `${this.referenceName} ${formatTime(plan.event.at)} (${formatOffset(plan.offset)}) · ${coef}${mix}${edge}`;
    },
  };
});

Alpine.start();
