// Decides when the app may look for a new service worker. Pure, so tests can cover it;
// the service worker wiring itself lives in main.js.

export const CHECK_INTERVAL_MS = 60 * 60 * 1000;

// True when enough time has passed since the last check; 0 (or worse) means never checked.
export function shouldCheckUpdate(lastCheckMs, nowMs, intervalMs = CHECK_INTERVAL_MS) {
  if (!(lastCheckMs > 0)) return true;
  return nowMs - lastCheckMs >= intervalMs;
}
