import { hasCoverage } from './atlas-picker.js';
import { shouldRetryOnline } from './atlas-retry.js';
import { atlasMeta, downloadAtlas, loadAtlasIndex, openFrameAtlas } from './atlas.js';
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
import { errorMessage, explain, Msg, msg, offlineFrames, tideLoadStatus, tideStatus } from './messages.js';
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
import { createDownload, DownloadQuotaError } from './offline-download.js';
import { createOfflineFlow } from './offline-flow.js';
import { downloadBytes, frameUrls, obsoleteFrameKeys } from './offline-plan.js';
import {
  META_TIMEOUT_MS,
  cacheApiAvailable,
  downloadsEmptyKey,
  failedMetaRow,
  loadMetasProgressively,
  metaWithTimeout,
} from './offline-meta.js';
import { exceedsQuota, failedWarning, offlineRow, sizeLabel, storageLine, wantsInstallHint } from './offline-rows.js';
import { cachedFrameUrls, stateOf } from './offline-state.js';
import { UnavailableError } from './unavailable-error.js';
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
const DEFAULT_LEVEL = ARROW_LEVELS.find((item) => item.id === DEFAULT_ARROW_LEVEL);

// The colour/length scale is fixed, so the legend steps never change. Four ticks land
// on the scale stops (0/2/4/6 kn) and keep the legend narrow enough for a phone.
const LEGEND_STEPS = legendSteps(SCALE_MAX_KN, 4);

const ARROW_LEVEL_KEY = 'currents.arrowLevel';
const OFFSET_KEY = 'currents.gmtOffset';
const OFFLINE_HINT_KEY = 'currents.offlineHint';
// Batch window for the progressive row rebuilds while metas settle (see loadOfflineRows).
const OFFLINE_REFRESH_MS = 200;

// Cache name of the converted frames, shared with the service worker's runtime
// caching in vite.config.js: downloads write into it, the map reads from it.
const FRAME_CACHE = 'atlas-frames';

// The details panel is the phone's expandable block and the desktop sidebar.
// It starts open where the sidebar has room and collapsed on phones; crossing
// the breakpoint (rotation, window resize) resets to that default.
const DESKTOP_QUERY = '(min-width: 1024px)';

function prefersDetailsOpen() {
  return window.matchMedia?.(DESKTOP_QUERY)?.matches ?? true;
}

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
  let frameError = null; // the error the frame gate last showed, cleared on its own recovery
  let hasDrawn = false; // a draw of this atlas reached the map at least once
  let retriedOnline = false; // the automatic atlas list retry is spent once used
  let offlineMetas = null; // id → meta.json, or null when its load failed
  let offlineRetrying = new Set(); // ids whose failed meta is being loaded again
  let offlineRefreshTimer = null; // batches the progressive row rebuilds
  let offlineControllers = {}; // id → AbortController of a running download
  let offlineProgress = {}; // id → counts of a running download
  let offlineWarnings = {}; // id → warning text of a row
  const offlineFlow = createOfflineFlow();

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
    drawStale: false,
    needsTide: false,
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
    detailsOpen: prefersDetailsOpen(),

    atlases: [],
    hasCoverage: false,
    atlasListFailed: false,
    atlasId: '',
    atlasProgress: 0,

    // The offline-atlases section of the Menu sheet.
    offlineRows: [],
    offlineBusy: false,
    offlineStorage: '',
    offlineHint: false,

    // The Menu sheet: a search over the atlas labels, the active tab and the
    // Saved chip of the open atlas in the header.
    menuTab: 'atlases',
    menuTabs: ['atlases', 'downloads', 'more'],
    menuQuery: '',
    atlasSaved: false,

    manualHw: '',
    manualCoef: '70',

    gmtOffset: storedOffset(),
    offsetOptions: OFFSET_OPTIONS,

    supportUrl: SUPPORT_URL,
    supportHint: false,

    t(key, params) {
      // The empty state of the Downloads panel is null while rows exist; its
      // x-text still evaluates (x-show only hides), so a null key must not
      // reach interpolate().
      return key ? this.$store.i18n.t(key, params) : '';
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

    // The label of the open atlas, shown in the header next to the Change button.
    get atlasLabel() {
      return this.atlases.find((atlas) => atlas.id === this.atlasId)?.label ?? '';
    },

    // The header error strip gains a Downloads shortcut when the message is
    // about missing offline data (the offline.* keys).
    get errorOpensDownloads() {
      return typeof this.error?.key === 'string' && this.error.key.startsWith('offline.');
    },

    // The explicit empty state of the Downloads tab: a message when the index
    // has no frame atlases, or when none of them could be loaded. Null while
    // rows exist (a failed row counts as a row — it carries its own Retry).
    get downloadsEmpty() {
      return downloadsEmptyKey(
        this.offlineRows.length,
        this.atlases.filter((entry) => entry.kind === 'frames').length
      );
    },

    // The Cache API is missing on insecure addresses (plain http off
    // localhost): nothing can be stored, so the panel says so instead of
    // offering buttons that die silently on tap.
    get downloadsBlocked() {
      return !cacheApiAvailable(window);
    },

    // Label-only atlas search, case- and accent-insensitive (NFD, marks stripped).
    get filteredAtlases() {
      const q = this.menuQuery.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
      if (!q) return this.atlases;
      return this.atlases.filter((atlas) =>
        atlas.label.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().includes(q)
      );
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

    // Any map warning is showing (quality, stale data or a missing tide).
    get hasWarning() {
      return !this.busy && (this.quality !== 'ok' || this.drawStale || this.needsTideVisible);
    },

    // The needsTide chip shows only without a working tide and no load running.
    get needsTideVisible() {
      return !this.busy && this.needsTide && (this.statusIsError || !this.status);
    },

    // The wide warning chips (missing tide, stale data) span the map bottom:
    // on small screens the legend yields to them entirely. The narrow quality
    // chip stays right of the legend, so both fit.
    get yieldLegend() {
      return !this.busy && (this.needsTideVisible || this.drawStale);
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
      this.wireFrameGate();

      recordVisit(localStorage, Date.now());
      this.supportHint = shouldShowHint(localStorage, Date.now());

      this.trackDetailsPreference();

      this.$watch('$store.i18n.language', () => this.languageChanged());

      this.$nextTick(() => {
        if (!this.setupMap()) return;

        this.setupHashSync();
        this.wireGlobalListeners();

        this.loadAtlasList();
      });
    },

    wireFrameGate() {
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
        onArrived: () => {
          // The frames of a draw arrived, so whatever is on the map is current.
          this.drawStale = false;
          this.queueRender();
        },
        onError: (error) => {
          if (error instanceof UnavailableError) this.explainFrameFailure();
          else {
            // Remembered so only this error is cleared by its own recovery;
            // another error that took the box in between keeps it.
            frameError = errorMessage(error);
            this.error = frameError;
            this.drawStale = hasDrawn;
          }
        },
        onRecovered: () => this.clearFrameError(),
      });
    },

    trackDetailsPreference() {
      const desktopQuery = window.matchMedia?.(DESKTOP_QUERY);
      if (desktopQuery?.addEventListener) {
        desktopQuery.addEventListener('change', (event) => {
          this.detailsOpen = event.matches;
        });
      }
    },

    setupMap() {
      const container = document.getElementById('current-map');
      if (!container) {
        console.error('Missing <div id="current-map"> in index.html');
        return false;
      }

      view = createMapView(container, () => this.render(), (key, params) => this.t(key, params));

      // The layers control checkbox for the legend box.
      onLegendToggle(view, (visible) => (this.legendVisible = visible));

      // The map's height follows the layout (phone, desktop, timeline text), so tell Leaflet when it changes.
      new ResizeObserver(() => view.map.invalidateSize()).observe(container);

      onPointClick(view, (latlng) => this.queryPoint(latlng));
      onPopupClose(view, () => pointQuery?.cancel());
      return true;
    },

    setupHashSync() {
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
    },

    wireGlobalListeners() {
      // Pasting a link only changes the hash of the open page; apply it without a reload.
      window.addEventListener('hashchange', () => hashSync.onHashChange());

      // A first visit offline leaves the atlas list unloaded: when the browser
      // reports the connection back, retry once without waiting for the button.
      window.addEventListener('online', () => {
        if (!shouldRetryOnline({ failed: this.atlasListFailed, retriedOnline })) return;
        retriedOnline = true;
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

    // Loads the list and shows the atlas areas on the map. After a failure the
    // message stays and the retry button appears; the map itself still works.
    async loadAtlasList() {
      try {
        this.atlases = await loadAtlasIndex();
      } catch (error) {
        console.warn(error);
        this.atlases = [];
        this.atlasListFailed = true;
        this.error = msg('atlasList.failed');
        return;
      }

      this.atlasListFailed = false;
      this.error = null;

      this.hasCoverage = this.atlases.some(hasCoverage);
      setCoverage(
        view,
        this.atlases,
        (id) => this.selectAtlas(id),
        (key, params) => this.t(key, params)
      );

      // Frame entries of atlas versions that are no longer current would stay
      // cached until their year is over: delete them once, best effort.
      this.cleanupOldFrames();

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
      this.atlasSaved = false;
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

      // Fire-and-forget: the Saved chip is derived from the open atlas's own
      // meta alone and never delays the open.
      this.refreshAtlasSaved();
    },

    async openBuffer(buffer, name) {
      await this.openModel(() => parseCurrents(buffer), name);
    },

    // makeModel returns a model (or a promise of one); errors are reported here for both sources.
    async openModel(makeModel, name) {
      this.resetOpenState();

      try {
        const model = await makeModel();
        session = createSession(model, { i18n: this.$store.i18n });
        // A new atlas means a new reference port: a tide load still in flight for
        // the old one must not apply here.
        tideService.cancel();

        this.adoptModel(model, name);

        this.rebuildPointQuery();

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

    // Clears everything the previous atlas may still have drawn or loaded.
    resetOpenState() {
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
      hasDrawn = false;
      this.drawStale = false;
      this.needsTide = false;
      if (view) {
        closePopup(view);
        clearVectors(view);
      }
      pointQuery?.cancel();
    },

    // Copies the model's facts into the reactive state (a session is not reactive).
    adoptModel(model, name) {
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
    },

    rebuildPointQuery() {
      pointQuery = wirePointQuery({
        getModel: () => session.model,
        getSession: () => session,
        getDepth: () => this.depthIndex,
        getCenterMs: () => this.centerMs,
        t: (key, params) => this.t(key, params),
        curve: !navigator.connection?.saveData,
      });
    },

    // Drops the frame gate's message, but only if that message still owns the
    // error box: another error that took the box in between keeps it. Alpine
    // reads the stored message back through its reactive proxy, so the check
    // compares by value, not by identity.
    clearFrameError() {
      if (
        frameError &&
        this.error?.key === frameError.key &&
        this.error?.params?.text === frameError.params?.text
      ) {
        this.error = null;
      }
      frameError = null;
    },

    // Frames of the current moment could not be fetched: say so in the
    // user's language, and look into the frame cache to recognise a partial
    // download, whose wording tells how to finish it.
    async explainFrameFailure() {
      const generic = offlineFrames('none');
      frameError = generic;
      this.error = generic;
      this.drawStale = hasDrawn;

      try {
        // meta.json is served from the index cache offline, so the look works.
        const entry = this.atlases.find((atlas) => atlas.id === this.atlasId);
        if (!entry) return;

        const meta = await atlasMeta(entry);
        if (this.error?.key !== generic.key) return; // a newer message owns the box

        const cache = await caches.open(FRAME_CACHE);
        const { state } = stateOf(meta, cachedFrameUrls(await cache.keys()));
        if (state !== 'partial' || this.error?.key !== generic.key) return;

        frameError = offlineFrames(state);
        this.error = frameError;
      } catch {
        // The generic offline message stays.
      }
    },

    // Offline atlases (the Menu sheet). The rows show what the pure
    // offline-rows module decides; this section only gathers the data.

    openMenu(section) {
      this.menuTab = this.menuTabs.includes(section) ? section : 'atlases';
      this.$refs.menu.showModal();
      // Every open refreshes the rows (missing metas retry, so an offline
      // visit does not leave the list empty); a deep link jumps to Downloads.
      this.loadOfflineRows();
      if (this.menuTab === 'downloads') {
        this.$nextTick(() => {
          document.getElementById('menu-panel-downloads')?.scrollIntoView({ block: 'start' });
        });
      }
    },

    // Arrow keys move focus and activate the neighbour tab (roving tabindex).
    menuTabStep(delta) {
      const next = this.menuTabs[(this.menuTabs.indexOf(this.menuTab) + delta + this.menuTabs.length) % this.menuTabs.length];
      this.menuTab = next;
      this.$nextTick(() => document.getElementById('menu-tab-' + next)?.focus());
    },

    closeMenu() {
      this.$refs.menu.close();
    },

    // A dialog cannot open a second modal while the first is up, so About
    // opens only after the Menu sheet has closed.
    openAboutFromMenu() {
      this.closeMenu();
      this.$nextTick(() => this.openAbout());
    },

    openAbout() {
      this.$refs.about.showModal();
    },

    // The Saved chip: derived from the open atlas's own meta alone — the full
    // meta list is only fetched when Menu → Downloads is opened — and derived
    // from the frame cache, so an eviction or a version change clears it.
    async refreshAtlasSaved() {
      const entry = this.atlases.find((atlas) => atlas.id === this.atlasId);
      if (!entry || entry.kind !== 'frames') {
        this.atlasSaved = false;
        return;
      }

      try {
        // The open session already holds the meta: reuse it and only fetch
        // when the Saved chip runs before the model exists (or the fetch
        // failed), so a normal open makes no extra request.
        const meta = session?.model?.meta ?? offlineMetas?.[entry.id] ?? (await atlasMeta(entry));
        const cache = await caches.open(FRAME_CACHE);
        const stored = stateOf(meta, cachedFrameUrls(await cache.keys()));
        if (this.atlasId === entry.id) this.atlasSaved = stored.state === 'complete';
      } catch {
        this.atlasSaved = false;
      }
    },

    // Per-row Saved label for the Menu's atlas list.
    offlineSaved(id) {
      return this.offlineRows.some((row) => row.id === id && row.saved);
    },

    // meta.json of each frame atlas carries the size and the frame list of a
    // row. It is fetched through the NetworkFirst route, so one online look
    // caches them all and later Downloads visits work offline. Metas that
    // failed before (offline first visit) retry on every open. Every meta
    // renders as soon as it settles, so one blocked request cannot hold the
    // whole panel back; a failed one keeps its row with a Retry.
    async loadOfflineRows() {
      // A load already in flight works on the same metas; a Retry tap during
      // it would only double the requests and reset the retry markers.
      if (this.offlineBusy) return;
      this.offlineBusy = true;
      try {
        offlineMetas ??= {};
        const entries = this.atlases.filter((entry) => entry.kind === 'frames');
        // Failed metas retry on every open; their rows stay in the panel
        // (with Retry) while the retry runs.
        offlineRetrying = new Set(entries.filter((entry) => offlineMetas[entry.id] === null).map((entry) => entry.id));
        await this.refreshOfflineRows();
        await loadMetasProgressively(entries, offlineMetas, {
          fetchMeta: (entry) => atlasMeta(entry),
          timeoutMs: META_TIMEOUT_MS,
          // Every settle re-renders the rows. The rebuild is scheduled, not
          // awaited: awaiting a shared timer here would abandon all but the
          // last settle's promise and leave offlineBusy stuck, so no later
          // open or Retry would ever refresh again.
          onSettled: (entry) => {
            offlineRetrying.delete(entry.id);
            clearTimeout(offlineRefreshTimer);
            offlineRefreshTimer = setTimeout(() => {
              offlineRefreshTimer = null;
              this.refreshOfflineRows();
            }, OFFLINE_REFRESH_MS);
          },
        });
        clearTimeout(offlineRefreshTimer);
        offlineRefreshTimer = null;
        await this.refreshOfflineRows();
      } finally {
        clearTimeout(offlineRefreshTimer);
        offlineRefreshTimer = null;
        offlineRetrying = new Set();
        this.offlineBusy = false;
      }
    },

    async refreshOfflineRows() {
      if (!offlineMetas) return;

      let cachedUrls;
      try {
        const cache = await caches.open(FRAME_CACHE);
        cachedUrls = cachedFrameUrls(await cache.keys());
      } catch {
        // No cache access (blocked storage, very old browser): the rows stay,
        // only the saved state cannot be read (everything looks undownloaded).
        cachedUrls = new Set();
      }

      const cacheOk = cacheApiAvailable(window);
      this.offlineRows = this.atlases
        .filter((entry) => entry.kind === 'frames' && offlineMetas[entry.id] !== undefined)
        .map((entry) => this.buildOfflineRow(entry, cachedUrls, cacheOk));

      const line = storageLine(await this.storageEstimate());
      this.offlineStorage = line ? this.t(line.key, line.params) : '';

      // A download finished or a remove happened: the header chip follows the rows.
      const open = this.offlineRows.find((row) => row.id === this.atlasId);
      if (open) this.atlasSaved = open.saved;
    },

    // What one row of the panel shows: pure offline-rows builds it, this only gathers the data.
    buildOfflineRow(entry, cachedUrls, cacheOk) {
      const meta = offlineMetas[entry.id];
      if (!meta) return failedMetaRow(entry);

      const stored = stateOf(meta, cachedUrls);
      const counts = offlineProgress[entry.id] ?? stored;

      return {
        id: entry.id,
        label: entry.label,
        warning: offlineWarnings[entry.id] ?? '',
        saved: stored.state === 'complete',
        metaFailed: false,
        ...offlineRow({
          state: stored.state,
          done: counts.done,
          total: counts.total,
          bytes: downloadBytes(meta),
          confirming: offlineFlow.isConfirming(entry.id),
          running: offlineFlow.isRunning(entry.id),
          metered: Boolean(navigator.connection?.saveData),
        }),
        // Without the Cache API nothing can be stored or read: no buttons
        // that only die on tap (the panel says why instead).
        ...(cacheOk ? {} : { buttons: [] }),
      };
    },

    // estimate() is a hint, not a promise; Chrome reports usage + 10 GB as the quota.
    async storageEstimate() {
      try {
        return (await navigator.storage?.estimate?.()) ?? null;
      } catch {
        return null;
      }
    },

    offlineButton(row, id) {
      if (id === 'download') this.confirmOfflineDownload(row.id);
      else if (id === 'cancel') offlineControllers[row.id]?.abort();
      else if (id === 'remove') this.removeOfflineDownload(row.id);
      else if (id === 'retry') this.loadOfflineRows();
    },

    // Two taps: the first arms the confirmation with the exact size, the second
    // starts. The flow refuses a second start while one is going.
    confirmOfflineDownload(id) {
      if (offlineFlow.tap(id)) this.startOfflineDownload(id);
      else this.refreshOfflineRows();
    },

    async startOfflineDownload(id) {
      const entry = this.atlases.find((atlas) => atlas.id === id);
      const meta = offlineMetas?.[id];
      if (!entry || !meta) {
        offlineFlow.finish(id);
        this.refreshOfflineRows();
        return;
      }

      // Without the Cache API the download below would die on its first
      // caches.open (ReferenceError) and only console.warn: the row must say
      // why nothing is happening.
      if (!cacheApiAvailable(window)) {
        offlineFlow.finish(id);
        offlineWarnings[id] = this.t('menu.downloads.noStorage');
        this.refreshOfflineRows();
        return;
      }

      // Running before the first await: Cancel shows immediately, and a cancel
      // during the preparation (persist, estimate) aborts before any fetch.
      const controller = new AbortController();
      offlineControllers[id] = controller;
      this.refreshOfflineRows();

      try {
        this.askForDurableStorage();

        delete offlineWarnings[id];
        await this.warnIfQuotaExceeded(id, downloadBytes(meta));

        const counts = await createDownload({
          openCache: () => caches.open(FRAME_CACHE),
          fetchFn: (...args) => fetch(...args),
          urls: frameUrls(meta),
          signal: controller.signal,
          onProgress: (progress) => this.updateOfflineProgress(id, progress),
        });

        this.settleOfflineDownload(id, counts);
      } catch (error) {
        this.reportOfflineDownloadFailure(id, meta, error);
      } finally {
        delete offlineControllers[id];
        delete offlineProgress[id];
        offlineFlow.finish(id);
        await this.refreshOfflineRows();
      }
    },

    // Ask for durable storage at the moment the user saves data. Firefox
    // answers only after the user has answered its permission prompt, so
    // the download must not wait for the reply.
    askForDurableStorage() {
      try {
        navigator.storage?.persist?.()?.catch(() => {});
      } catch {
        // Best effort.
      }
    },

    // estimate() is a hint, not a promise; Chrome reports usage + 10 GB as the quota.
    async warnIfQuotaExceeded(id, bytes) {
      const estimate = await this.storageEstimate();
      if (exceedsQuota(bytes, estimate)) {
        offlineWarnings[id] = this.t('about.offline.quota', {
          size: sizeLabel(bytes),
          free: sizeLabel(Math.max(0, estimate.quota - estimate.usage)),
        });
      }
    },

    // What a finished download says: the failure warning, or the install hint.
    settleOfflineDownload(id, counts) {
      const failed = failedWarning(counts);
      if (failed) {
        offlineWarnings[id] = this.t(failed.key, failed.params);
      } else if (counts.done === counts.total) {
        this.maybeShowOfflineHint();
      }
    },

    reportOfflineDownloadFailure(id, meta, error) {
      if (error instanceof DownloadQuotaError) {
        offlineWarnings[id] = this.t('about.offline.quota', {
          size: sizeLabel(downloadBytes(meta)),
          free: sizeLabel(0),
        });
      } else if (error?.name !== 'AbortError') {
        console.warn('Atlas download failed:', error);
      }
    },

    // Only the running row changes; no cache scan per frame.
    updateOfflineProgress(id, progress) {
      offlineProgress[id] = progress;
      const row = this.offlineRows.find((item) => item.id === id);
      if (!row) return;

      row.stateKey = 'about.offline.statePartial';
      row.stateParams = { done: progress.done, total: progress.total };
    },

    // Deletes the frames of one atlas; meta.json stays (it is small and lives
    // in the index cache anyway).
    async removeOfflineDownload(id) {
      try {
        const cache = await caches.open(FRAME_CACHE);
        const prefix = `/atlas/${id}/f_c`;
        for (const key of await cache.keys()) {
          if (new URL(key.url).pathname.startsWith(prefix)) await cache.delete(key);
        }
      } catch {
        // Nothing to remove.
      }

      delete offlineWarnings[id];
      offlineFlow.finish(id);
      await this.refreshOfflineRows();
    },

    async cleanupOldFrames() {
      const versionsById = Object.fromEntries(this.atlases.map((entry) => [entry.id, entry.version]));
      try {
        const cache = await caches.open(FRAME_CACHE);
        for (const key of obsoleteFrameKeys(await cache.keys(), versionsById)) {
          await cache.delete(key);
        }
      } catch {
        // Never block the start for cache bookkeeping.
      }
    },

    // Browsers may clear the storage of a site unused for a week; installed
    // apps are exempt. One dismiss is remembered for good.
    maybeShowOfflineHint() {
      const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches ?? false;
      const dismissed = localStorage.getItem(OFFLINE_HINT_KEY) !== null;
      this.offlineHint = wantsInstallHint(standalone, dismissed);
    },

    dismissOfflineHint() {
      localStorage.setItem(OFFLINE_HINT_KEY, String(Date.now()));
      this.offlineHint = false;
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

    // Details panel (the phone's expandable block and the desktop sidebar).
    // Expanding shrinks the map instead of covering it. The ResizeObserver on
    // the map container already invalidates Leaflet's size; the explicit call
    // only removes any ordering doubt on the first frame.
    toggleDetails() {
      this.detailsOpen = !this.detailsOpen;
      this.$nextTick(() => view?.map.invalidateSize());
    },

    // The needsTide warning's action on the map: open the details and point
    // the keyboard at "Tide data", so the reference stays actionable even when
    // the panel starts collapsed.
    openTideData() {
      this.detailsOpen = true;
      this.$nextTick(() => {
        view?.map.invalidateSize();
        document.getElementById('tide-data')?.querySelector('summary')?.focus();
      });
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
      const level = ARROW_LEVELS.find((item) => item.id === this.arrowLevel) ?? DEFAULT_LEVEL;
      return level.arrows;
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

      this.adoptSnapshot(snap, timeWindow);
      this.drawFrame(snap);
    },

    // Copies the snapshot's readouts into the reactive state (a session is not reactive).
    adoptSnapshot(snap, timeWindow) {
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
    },

    drawFrame(snap) {
      // Keeps the previous arrows on screen until the needed frames have arrived.
      const ahead = this.playing ? playbackStride(session?.isTidal, this.stepMinutes) : 0;
      if (snap.draw && !frameGate.ensure(session.model, snap.draw, ahead)) return;

      if (!snap.draw) {
        clearVectors(view);
        this.frameMax = 0;
        // Nothing can be drawn without a tide: say so on the map instead of
        // leaving it silently empty (the sidebar detail alone is too easy to miss).
        this.needsTide = session.isTidal && !session.hasTide;
        return;
      }
      this.needsTide = false;

      const drawn = drawVectors(view, session.model, {
        ...snap.draw,
        depth: this.depthIndex,
        maxArrows: this.arrowBudget(),
      });

      hasDrawn = true;
      this.drawStale = false;
      this.frameMax = drawn.maxSpeed * MS_TO_KNOTS;
      // The shown data is current again, so an offline message of this gate is
      // stale — even when the draw came from memory and no gate event fired.
      this.clearFrameError();
      hashSync.schedule();
    },
  };
}
