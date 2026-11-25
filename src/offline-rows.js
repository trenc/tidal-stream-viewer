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

  // Gigabyte above a gigabyte, so a quota value stays readable.
  const gb = Math.max(estimate.usage, estimate.quota) >= 1e9;
  const factor = gb ? 1e9 : 1e6;
  const unit = gb ? 'GB' : 'MB';

  return {
    key: 'about.offline.storage',
    params: {
      used: unitLabel(estimate.usage / factor, unit),
      quota: unitLabel(estimate.quota / factor, unit),
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
