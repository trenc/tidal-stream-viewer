// The hash sync: keeps the address bar in step with the open atlas, the map
// view and the time marker, and applies a pasted link to the open page. The
// hash format itself lives in url-state.js; this module owns when to read and
// write it. The location, the history, the atlas opening and the map view are
// injected, so tests drive the sync directly.

import { buildHash, hashAction, parseHash } from './url-state.js';

export function createHashSync({
  readState,
  write,
  read,
  knownAtlasIds,
  currentAtlasId,
  openAtlas,
  applyView,
  showChooser,
  throttleMs,
}) {
  let timer = null;
  // False while the state of a link is being restored: no write may cover the link up.
  let ready = true;
  // Counts overlapping opens, so a link pasted after a slower one wins.
  let openCount = 0;

  function schedule() {
    if (timer !== null) return;

    timer = setTimeout(() => {
      timer = null;
      writeCurrent();
    }, throttleMs);
  }

  function writeCurrent() {
    if (!ready) return;

    const state = readState();
    // Without an open atlas there is nothing worth a link.
    if (!state.atlas) return;

    write(buildHash(state));
  }

  // Applies the parts of a parsed hash once its atlas is open.
  function applyFromLink(state) {
    applyView(state);
    ready = true;
    schedule();
  }

  // Opens the atlas a link names, then applies the parts of the hash the open
  // atlas can use — or falls back to the map when it failed to open.
  async function openFromLink(state) {
    ready = false;
    const open = ++openCount;

    const isOpen = await openAtlas(state.atlas);
    // A newer link has taken over: this open applies nothing.
    if (open !== openCount) return;

    if (isOpen) applyFromLink(state);
    else {
      showChooser();
      ready = true;
    }
  }

  return {
    // The boot decision: a link may name an atlas; otherwise the areas are
    // shown and the user taps one.
    async boot() {
      const state = parseHash(read());

      if (knownAtlasIds().includes(state.atlas)) await openFromLink(state);
      else {
        showChooser();
        ready = true;
      }
    },

    // A pasted link changes only the hash of the open page: open its atlas, or move view and time.
    onHashChange() {
      const state = parseHash(read());
      const action = hashAction(state, currentAtlasId(), knownAtlasIds());

      if (action === 'ignore') return;

      if (action === 'open') {
        openFromLink(state);
        return;
      }

      applyFromLink(state);
    },

    // Keeps the address bar in step with the atlas, the map and the marker.
    // Throttled, with a trailing write, so dragging the timeline does not
    // rewrite it on every frame.
    schedule,
  };
}
