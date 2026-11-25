import { hasCoverage } from './atlas-picker.js';
import { downloadAtlas, loadAtlasIndex, openFrameAtlas } from './atlas.js';
import {
  OFFSET_OPTIONS,
  browserOffset,
  formatDateTime,
  formatPickerValue,
  gmtLabel,
  nearestOffset,
  parseDateTime,
} from './clock.js';
import { createFrameGate } from './frame-gate.js';
import { createHashSync } from './hash-sync.js';
import {
  clearVectors,
  closePopup,
  createMapView,
  drawVectors,
  fitToBounds,
  fitToCoverage,
  onLegendToggle,
  onPointClick,
  onPopupClose,
  setCoverage,
  setCoverageVisible,
  showPointPopup,
  updateLayerLabels,
} from './map.js';
import { errorMessage, explain, Msg, msg, tideLoadStatus, tideStatus } from './messages.js';
import {
  LIMIT_DAYS,
  VIEW_HALF_MS,
  buttonMinutes,
  clampAndSnap,
  dataRange,
  dragCenter,
  keyboardMinutes,
  limitsAround,
  shadeOf,
  wheelDelta,
} from './navigation.js';
import { parseCurrents } from './netcdf.js';
import { advancePlayback, createPlayback, playbackStride } from './playback.js';
import { wirePointQuery } from './point-query.js';
import { formatReleaseDate } from './release-date.js';
import { legendSteps } from './speed-legend.js';
import { MS_TO_KNOTS, SCALE_MAX_KN } from './speed-scale.js';
import { createSession } from './session.js';
import { SUPPORT_URL, dismissHint, recordVisit, shouldShowHint } from './support-hint.js';
import { jumpTarget } from './tide-jump.js';
import { createTideService } from './tide-service.js';
import { buildAxis } from './timeline.js';

const LEVEL_STEP_MINUTES = 10;
const NOTICE_MS = 5000;
const HASH_WRITE_MS = 500;

const ARROW_LEVELS = [
  { id: 'overview', arrows: 200 },
  { id: 'standard', arrows: 1500 },
  { id: 'fine', arrows: 3000 },
];
const DEFAULT_ARROW_LEVEL = 'overview';

// The colour/length scale is fixed, so the legend steps never change. Four ticks land
// on the scale stops (0/2/4/6 kn) and keep the legend narrow enough for a phone.
const LEGEND_STEPS = legendSteps(SCALE_MAX_KN, 4);

const ARROW_LEVEL_KEY = 'currents.arrowLevel';
const OFFSET_KEY = 'currents.gmtOffset';

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
  let pointQuery = null;
  let playback = null;
  let frameGate = null;
  let queued = false;
  let drag = null;
  let freeCenter = null; // unsnapped position while scrolling, so small wheel steps add up
  let noticeTimer = null;
  let hashSync = null;

  const tideService = createTideService();

  return {
    loading: false,
    framesLoading: false,
    framesDone: 0,
    framesTotal: 0,
    error: null,
    errorInfo: '',
    notice: null,
    fileName: '',
    release: '',
    hasData: false,
    isTidal: false,
    referenceName: '',
    siteName: '',
    stepMinutes: 60, // Placeholder until the atlas reports its own step (setupSlider).
    sliderMax: 0,
    sliderIndex: 0,
    centerMs: 0,
    limits: { minMs: 0, maxMs: 0 },
    limitDays: LIMIT_DAYS,
    days: [],
    wave: null,
    // Mirror of session.tideExtrema: session is a module variable Alpine cannot
    // track, so the jump buttons need it here to update when tide data arrives.
    tideJumpEvents: [],
    cursor: { x: 50, y: null },
    clockLabel: '',
    heightLabel: '',
    nextLabel: '',
    detail: '',
    quality: 'ok',
    status: null,
    statusIsError: false,
    tideAttribution: '',
    tideNotice: '',
    depthIndex: 0,
    depthLabels: [],
    arrowLevels: ARROW_LEVELS,
    arrowLevel: storedArrowLevel(),
    legendSteps: LEGEND_STEPS,
    legendVisible: true,
    frameMax: 0,
    playing: false,
    dragging: false,

    atlases: [],
    hasCoverage: false,
    atlasId: '',
    atlasProgress: 0,

    manualHw: '',
    manualCoef: '70',

    gmtOffset: storedOffset(),
    offsetOptions: OFFSET_OPTIONS,

    supportUrl: SUPPORT_URL,
    supportHint: false,

    // Texts

    t(key, params) {
      return this.$store.i18n.t(key, params);
    },

    // Turns a message (and messages inside its values) into text in the current language.
    text(message) {
      if (!message) return '';

      const params = {};
      for (const [name, value] of Object.entries(message.params ?? {})) {
        params[name] = value instanceof Msg ? this.text(value) : value;
      }

      return this.t(message.key, params);
    },

    get errorText() {
      return this.text(this.error);
    },

    get statusText() {
      return this.text(this.status);
    },

    get noticeText() {
      return this.text(this.notice);
    },

    get offsetLabel() {
      return gmtLabel(this.gmtOffset);
    },

    get frameMaxLabel() {
      return this.$store.i18n.number(this.frameMax, 2);
    },

    // The ± buttons step at least 30 minutes, whatever the atlas step.
    get buttonStep() {
      return buttonMinutes(this.stepMinutes);
    },

    // Legend ticks in knots: one decimal only when the value needs it, in the user's language.
    legendLabel(knots) {
      return this.$store.i18n.number(knots, Number.isInteger(knots) ? 0 : 1);
    },

    get timelineNote() {
      return this.t('timeline.note', {
        site: this.siteName || this.t('timeline.fallbackSite'),
        zone: this.offsetLabel,
        days: this.limitDays,
      });
    },

    // The time under the marker, as text in the chosen time zone.
    get when() {
      return this.centerMs ? formatDateTime(this.centerMs, this.gmtOffset) : '';
    },

    // The same moment, as the value of an <input type="datetime-local"> (the isTidal go-to field).
    get pickerWhen() {
      return this.centerMs ? formatPickerValue(this.centerMs, this.gmtOffset) : '';
    },

    // The atlas window, so the picker can grey out the days outside it before a useful time.
    get limitsMinPicker() {
      return this.limits.minMs ? formatPickerValue(this.limits.minMs, this.gmtOffset) : null;
    },

    get limitsMaxPicker() {
      return this.limits.maxMs ? formatPickerValue(this.limits.maxMs, this.gmtOffset) : null;
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
          ? this.t('busy.frames', { done: this.framesDone, total: this.framesTotal })
          : this.t('busy.framesOne');
      }

      const percent =
        this.atlasProgress > 0 && this.atlasProgress < 1 ? ` ${Math.round(this.atlasProgress * 100)} %` : '';
      return this.t('busy.opening', { percent });
    },

    // The depth list of a file, "Level 1", "Niveau 1" ... or the depth in metres.
    levelLabels(model) {
      return Array.from({ length: model.depthCount }, (_, i) =>
        model.depths[i] !== undefined
          ? `${this.$store.i18n.number(model.depths[i], 1)} m`
          : this.t('depth.level', { n: i })
      );
    },

    // A tap on the map: the current at that point and the next 12 hours, from the marker time.
    async queryPoint(latlng) {
      if (!this.hasData || !session?.isTidal || !pointQuery) return;

      const text = {
        t: (key, params) => this.t(key, params),
        number: (value, digits) => this.$store.i18n.number(value, digits),
        offsetMinutes: this.gmtOffset,
      };
      const render = (result) => {
        showPointPopup(view, latlng, result, text);
      };

      render({ status: 'loading' });
      const result = await pointQuery.query(latlng, render);
      if (result) render(result);
    },

    init() {
      playback = createPlayback(() => this.tick());

      frameGate = createFrameGate({
        onLoading: (loading) => {
          this.framesLoading = loading;
          if (loading) {
            this.framesDone = 0;
            this.framesTotal = 0;
          }
        },
        onProgress: ({ done, total }) => {
          this.framesDone = done;
          this.framesTotal = total;
        },
        onArrived: () => this.queueRender(),
        onError: (error) => {
          this.error = errorMessage(error);
        },
      });

      recordVisit(localStorage, Date.now());
      this.supportHint = shouldShowHint(localStorage, Date.now());

      this.$watch('$store.i18n.language', () => this.languageChanged());

      this.$nextTick(() => {
        const container = document.getElementById('current-map');
        if (!container) {
          console.error('Missing <div id="current-map"> in index.html');
          return;
        }
        view = createMapView(container, () => this.render(), (key, params) => this.t(key, params));

        // The layers control checkbox for the legend box.
        onLegendToggle(view, (visible) => (this.legendVisible = visible));

        // The map's height follows the layout (phone, desktop, timeline text), so tell Leaflet when it changes.
        new ResizeObserver(() => view.map.invalidateSize()).observe(container);

        onPointClick(view, (latlng) => this.queryPoint(latlng));
        onPopupClose(view, () => pointQuery?.cancel());

        // The address-bar hash: linked atlases open from it, and it follows the open atlas, the map and the marker.
        hashSync = createHashSync({
          readState: () => {
            const center = view.map.getCenter();
            return {
              atlas: this.hasData ? this.atlasId : null,
              lat: center.lat,
              lon: center.lng,
              zoom: view.map.getZoom(),
              ms: session?.isTidal ? this.centerMs : null,
            };
          },
          write: (hash) => history.replaceState(history.state, '', hash),
          read: () => location.hash,
          knownAtlasIds: () => this.atlases.map((atlas) => atlas.id),
          currentAtlasId: () => this.atlasId,
          openAtlas: async (id) => {
            await this.selectAtlas(id);
            return this.hasData;
          },
          // The map-specific part of a link: position, zoom and marker time.
          applyView: (state) => {
            if (!view || !this.hasData) return;

            if (state.lat !== undefined && state.lon !== undefined) {
              view.map.setView([state.lat, state.lon], state.zoom ?? view.map.getZoom(), {
                animate: false,
              });
            } else if (state.zoom !== undefined) {
              view.map.setZoom(state.zoom, { animate: false });
            }

            if (state.ms !== undefined && session?.isTidal) this.moveTo(state.ms);
          },
          showChooser: () => {
            if (this.hasCoverage) this.chooseOnMap();
          },
          throttleMs: HASH_WRITE_MS,
        });

        // Pasting a link only changes the hash of the open page; apply it without a reload.
        window.addEventListener('hashchange', () => hashSync.onHashChange());

        this.loadAtlasList();
      });
    },

    // Everything that was computed once in the old language is computed again.
    languageChanged() {
      if (view) updateLayerLabels(view, (key, params) => this.t(key, params));

      if (session) {
        this.referenceName = session.referenceName;
        this.depthLabels = this.levelLabels(session.model);
      }

      this.render();
    },

    dismissSupportHint() {
      dismissHint(localStorage, Date.now());
      this.supportHint = false;
    },

    showNotice(message) {
      this.notice = message;
      clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => {
        this.notice = null;
      }, NOTICE_MS);
    },

    // Atlas loading and choosing

    // Loads the list and shows the atlas areas on the map.
    async loadAtlasList() {
      try {
        this.atlases = await loadAtlasIndex();
      } catch (error) {
        console.warn(error);
        this.atlases = [];
      }

      this.hasCoverage = this.atlases.some(hasCoverage);
      setCoverage(
        view,
        this.atlases,
        (id) => this.selectAtlas(id),
        (key, params) => this.t(key, params)
      );

      // A link may name an atlas; otherwise the areas are shown and the user taps one.
      await hashSync.boot();
    },

    // Shows the outline of every atlas on the map, to tap the one you want.
    chooseOnMap() {
      if (!view) return;
      setCoverageVisible(view, true);
      fitToCoverage(view, this.atlases);
    },

    async selectAtlas(id) {
      const entry = this.atlases.find((atlas) => atlas.id === id);
      if (!entry) return;

      this.atlasId = id;
      this.error = null;
      this.errorInfo = '';
      this.loading = true;
      this.atlasProgress = 0;
      // A new atlas means a new reference port: the previous jump targets are gone.
      this.tideJumpEvents = [];

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
        this.error = errorMessage(error);
      }

      if (this.hasData) setCoverageVisible(view, false);
    },

    async openBuffer(buffer, name) {
      await this.openModel(() => parseCurrents(buffer), name);
    },

    // makeModel returns a model (or a promise of one); errors are reported here for both sources.
    async openModel(makeModel, name) {
      this.stop();
      this.error = null;
      this.errorInfo = '';
      this.loading = true;
      // The new model loads its own frames: a load still in flight for the old
      // atlas must neither update the indicator nor report an error.
      frameGate?.cancel();
      drag = null;
      freeCenter = null;
      this.framesLoading = false;
      this.hasData = false;
      if (view) {
        closePopup(view);
        clearVectors(view);
      }
      pointQuery?.cancel();

      try {
        const model = await makeModel();
        session = createSession(model, { i18n: this.$store.i18n });
        // A new atlas means a new reference port: a tide load still in flight for
        // the old one must not apply here.
        tideService.cancel();

        this.fileName = name;
        this.release = formatReleaseDate(model.release);
        this.isTidal = session.isTidal;
        this.referenceName = session.referenceName;
        this.siteName = '';
        this.tideAttribution = '';
        this.tideNotice = '';
        this.wave = null;
        this.quality = 'ok';
        this.depthIndex = 0;
        this.depthLabels = this.levelLabels(model);
        this.frameMax = 0;
        this.setStatus(null);
        this.setupSlider();
        this.hasData = true;

        pointQuery = wirePointQuery({
          getModel: () => session.model,
          getSession: () => session,
          getDepth: () => this.depthIndex,
          getCenterMs: () => this.centerMs,
          t: (key, params) => this.t(key, params),
          curve: !navigator.connection?.saveData,
        });

        fitToBounds(view, model.bounds);
        this.render();

        if (session.isTidal) await this.refreshTides();
      } catch (error) {
        console.error(error);
        session = null;
        this.errorInfo = error.info || '';
        this.error = explain(error);
      } finally {
        this.loading = false;
      }
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
      this.setStatus(null);
      this.moveTo(Date.now());
    },

    // input is the picker field, so its content can be replaced by the time actually used.
    setWhen(value, input) {
      const ms = parseDateTime(value, this.gmtOffset);

      if (Number.isNaN(ms)) {
        this.setStatus(msg('status.enterTime'), true);
        if (input) input.value = this.pickerWhen;
        return;
      }

      const inside = ms >= this.limits.minMs && ms <= this.limits.maxMs;
      this.setStatus(inside ? null : msg('status.limited', { days: LIMIT_DAYS }));

      this.moveTo(ms);
      if (input) input.value = this.pickerWhen;
    },

    // Jumping the marker to the high and low waters of the reference port.

    canJump(direction, type) {
      return (
        jumpTarget(this.tideJumpEvents ?? [], this.centerMs, direction, type, this.limits, this.stepMinutes) !== null
      );
    },

    jumpTo(direction, type) {
      const jump = jumpTarget(
        this.tideJumpEvents ?? [],
        this.centerMs,
        direction,
        type,
        this.limits,
        this.stepMinutes
      );
      if (!jump) return;

      this.stop();
      this.moveTo(jump.targetMs);
    },

    // Keeps the same moments in time and rewrites the typed manual tide in the new zone.
    setOffset(value) {
      const next = nearestOffset(Number(value));
      const manualMs = parseDateTime(this.manualHw, this.gmtOffset);

      this.gmtOffset = next;
      localStorage.setItem(OFFSET_KEY, String(next));

      if (!Number.isNaN(manualMs)) this.manualHw = formatPickerValue(manualMs, next);

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

    tick() {
      const next = advancePlayback({
        isTidal: session?.isTidal,
        centerMs: this.centerMs,
        stepMinutes: this.stepMinutes,
        limits: this.limits,
        sliderIndex: this.sliderIndex,
        sliderMax: this.sliderMax,
      });

      if (!next) {
        this.stop();
        return;
      }

      if (next.centerMs !== undefined) this.moveTo(next.centerMs);
      else {
        this.sliderIndex = next.sliderIndex;
        this.render();
      }
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

    setStatus(message = null, isError = false) {
      this.status = message;
      this.statusIsError = isError;
    },

    applyTide(data) {
      this.siteName = data.siteName;
      this.tideAttribution = data.attribution;
      this.tideNotice = data.statusNotice;
      session.setTide(data);
      this.tideJumpEvents = data.extrema;

      const status = tideStatus(data);
      this.setStatus(status, status !== null);
    },

    // Loads the tide data for the whole range the marker can reach, so moving it needs no further requests.
    // A load superseded by a newer one (or by the manual tide) resolves to null.
    async refreshTides() {
      if (!session?.isTidal) return;

      if (!session.reference) {
        this.setStatus(msg('status.noReference'), true);
        return;
      }

      const { startMs, endMs } = dataRange(this.limits);
      this.setStatus(msg('status.looking'));

      try {
        const data = await tideService.load(session.reference, startMs, endMs, LEVEL_STEP_MINUTES);
        if (!data) return;
        this.applyTide(data);
      } catch (error) {
        console.error(error);
        session.clearTide();
        this.tideJumpEvents = [];
        this.setStatus(tideLoadStatus(error), true);
      }

      this.render();
    },

    useManualTide() {
      const atMs = parseDateTime(this.manualHw, this.gmtOffset);
      if (Number.isNaN(atMs)) {
        this.setStatus(msg('status.enterReferenceTime'), true);
        return;
      }

      this.applyTide(tideService.manual(new Date(atMs), Number(this.manualCoef) || null));
      this.setStatus(msg('status.manual'));
      this.render();
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
      if (session.isTidal && !this.centerMs) return;

      const timeWindow = this.timeWindow();
      const snap = session.isTidal
        ? session.snapshotAt(this.centerMs, timeWindow)
        : session.snapshot(this.sliderIndex, timeWindow);

      this.clockLabel = snap.clockLabel;
      this.heightLabel = snap.heightLabel;
      this.nextLabel = snap.nextLabel;
      this.cursor = snap.cursor;
      this.detail = snap.detail;
      this.quality = snap.quality ?? 'ok';

      if (session.isTidal) {
        this.wave = snap.wave;
        this.days = buildAxis(
          timeWindow.startMs,
          timeWindow.endMs,
          this.gmtOffset,
          this.$store.i18n.language
        );
      }

      // Keeps the previous arrows on screen until the needed frames have arrived.
      const ahead = this.playing ? playbackStride(session?.isTidal, this.stepMinutes) : 0;
      if (snap.draw && !frameGate.ensure(session.model, snap.draw, ahead)) return;

      if (!snap.draw) {
        clearVectors(view);
        this.frameMax = 0;
        return;
      }

      const drawn = drawVectors(view, session.model, {
        ...snap.draw,
        depth: this.depthIndex,
        maxArrows: this.arrowBudget(),
      });

      this.frameMax = drawn.maxSpeed * MS_TO_KNOTS;
      hashSync.schedule();
    },
  };
}
