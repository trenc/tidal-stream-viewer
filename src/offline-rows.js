// What one row of the offline-atlases list in the About dialog shows: the size,
// the state text and the buttons, as locale keys with values. Pure: the
// template only renders the rows and dispatches the button ids.

const unitLabel = (value, unit) =>
  `${value >= 10 ? Math.round(value) : Math.round(value * 10) / 10} ${unit}`;

// Always the one unit MB, as the offline frame sizes are conversation-sized.
export function sizeLabel(bytes) {
  return unitLabel(bytes / 1e6, 'MB');
}

export function offlineRow({ state, done = 0, total = 0, bytes, confirming = false, running = false, metered = false }) {
  let buttons;
  if (running) {
    buttons = [{ id: 'cancel', key: 'about.offline.cancel' }];
  } else if (state === 'complete') {
    buttons = [{ id: 'remove', key: 'about.offline.remove' }];
  } else {
    // Two taps: the first shows the exact size, the second starts.
    buttons = [
      confirming
        ? {
            id: 'download',
            key: metered ? 'about.offline.confirmMetered' : 'about.offline.confirm',
            params: { size: sizeLabel(bytes) },
          }
        : { id: 'download', key: state === 'partial' ? 'about.offline.finish' : 'about.offline.download' },
    ];
    if (state === 'partial') buttons.push({ id: 'remove', key: 'about.offline.remove' });
  }

  return {
    size: sizeLabel(bytes),
    stateKey: running || state === 'partial'
      ? 'about.offline.statePartial'
      : state === 'complete'
        ? 'about.offline.stateComplete'
        : 'about.offline.stateNone',
    stateParams: { done, total },
    buttons,
  };
}

// True when the download is bigger than what the browser reports as free.
// estimate() is a hint (Chrome reports usage + 10 GB as the quota), so this
// only warns and never blocks.
export function exceedsQuota(bytes, estimate) {
  if (!estimate || !Number.isFinite(estimate.quota)) return false;
  return bytes > estimate.quota - (Number.isFinite(estimate.usage) ? estimate.usage : 0);
}

export function storageLine(estimate) {
  if (!estimate || !Number.isFinite(estimate.usage) || !Number.isFinite(estimate.quota)) return null;

  // The unit is chosen per value, so 42 MB used never reads "0 GB" against a
  // multi-GB quota.
  const line = (bytes) => (bytes >= 1e9 ? unitLabel(bytes / 1e9, 'GB') : unitLabel(bytes / 1e6, 'MB'));

  return {
    key: 'about.offline.storage',
    params: {
      used: line(estimate.usage),
      quota: line(estimate.quota),
    },
  };
}

// Browsers may clear the storage of a site they have not seen for a week;
// installed apps are exempt. A completed download on a plain tab deserves the
// hint, until it is dismissed once.
export function wantsInstallHint(standalone, dismissed) {
  return !standalone && !dismissed;
}

// A download that ended with failures must not look complete: without a
// connection the missing frames are exactly the ones the map will need.
export function failedWarning(counts) {
  return counts.failed > 0
    ? { key: 'about.offline.failed', params: { count: counts.failed } }
    : null;
}

// The row of an atlas whose meta.json could not be loaded: it must stay in
// the panel with a way to retry, not silently disappear between its
// siblings. The size and state are unknown, but a removal stays possible —
// the frame cache can be cleared by id without the meta — so a Remove is
// offered exactly when the cache holds frames of this atlas.
export function failedMetaRow(entry, cachedFrameCount = 0) {
  const buttons = [{ id: 'retry', key: 'atlasList.retry' }];
  if (cachedFrameCount > 0) buttons.push({ id: 'remove', key: 'about.offline.remove' });

  return {
    id: entry.id,
    label: entry.label,
    warning: null,
    saved: false,
    metaFailed: true,
    size: null,
    stateKey: '',
    stateParams: {},
    buttons,
  };
}

// The explicit empty state of the Downloads panel, so it is never silently
// blank: a distinct message for an index without frame atlases and for frame
// atlases whose rows could not be loaded at all. Null while rows exist.
export function downloadsEmptyKey(rowCount, frameCount) {
  if (rowCount > 0) return null;
  return frameCount > 0 ? 'menu.downloads.noneLoaded' : 'menu.downloads.empty';
}
