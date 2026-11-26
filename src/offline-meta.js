// Loading the meta.json of every frame atlas for the Menu's Downloads tab,
// plus the row the panel shows for an atlas whose meta could not be loaded.
// Pure: the viewer only gathers the data and renders the rows (offline-rows
// builds the row of an atlas whose meta is there).
import { offlineRow } from './offline-rows.js';

// One meta gets about 8 s before it counts as failed: enough for a slow mobile
// link, short enough that a blocked or hanging request does not hold the panel
// open for minutes. The request itself is not aborted; its result is ignored.
export const META_TIMEOUT_MS = 8000;

// The Cache API exists only on secure contexts (https or localhost). On a plain
// http address the property is missing entirely, so the check must not touch it
// directly — typeof keeps that from throwing.
export function cacheApiAvailable(scope = globalThis) {
  return typeof scope.caches !== 'undefined' && scope.caches !== null;
}

export function metaWithTimeout(promise, ms = META_TIMEOUT_MS) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`meta not loaded within ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Loads the meta of every entry that has none (or whose last load failed) and
// reports every settled entry at once, so the panel can render the rows
// progressively instead of waiting for the whole list.
export async function loadMetasProgressively(entries, metas, { fetchMeta, timeoutMs, onSettled } = {}) {
  const missing = entries.filter((entry) => !metas[entry.id]);
  await Promise.all(
    missing.map(async (entry) => {
      try {
        metas[entry.id] = await metaWithTimeout(fetchMeta(entry), timeoutMs);
      } catch {
        // The failure stays visible: the row shows Retry instead of vanishing.
        metas[entry.id] = null;
      }
      await onSettled?.(entry);
    })
  );
}

// The row of an atlas whose meta could not be loaded: it must stay in the
// panel with a way to retry, not silently disappear between its siblings.
export function failedMetaRow(entry) {
  return {
    id: entry.id,
    label: entry.label,
    warning: '',
    saved: false,
    metaFailed: true,
    size: null,
    stateKey: '',
    stateParams: {},
    buttons: [{ id: 'retry', key: 'atlasList.retry' }],
  };
}

// The explicit empty state of the panel, so it is never silently blank:
// a distinct message for an index without frame atlases and for frame
// atlases whose rows could not be loaded at all. Null while rows exist.
export function downloadsEmptyKey(rowCount, frameCount) {
  if (rowCount > 0) return null;
  return frameCount > 0 ? 'menu.downloads.noneLoaded' : 'menu.downloads.empty';
}
