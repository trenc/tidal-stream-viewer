// One gentle hint to support the project, shown after the app was used on a few different days.
// Everything stays in the browser: a day counter and the time of the last dismissal.

export const SUPPORT_URL = 'https://ko-fi.com/tommyschmucker';

export const SHOW_AFTER_DAYS = 5;
export const QUIET_DAYS = 90;

const DAYS_KEY = 'support.days';
const LAST_DAY_KEY = 'support.lastDay';
const DISMISSED_KEY = 'support.dismissedAt';

const DAY_MS = 864e5;
const dayOf = (nowMs) => new Date(nowMs).toISOString().slice(0, 10);
const numberAt = (storage, key) => Number(storage.getItem(key) ?? 0) || 0;

// Counts a day on which the app was opened; opening it several times a day counts once.
export function recordVisit(storage, nowMs) {
  const today = dayOf(nowMs);
  if (storage.getItem(LAST_DAY_KEY) === today) return numberAt(storage, DAYS_KEY);

  const days = numberAt(storage, DAYS_KEY) + 1;
  storage.setItem(DAYS_KEY, String(days));
  storage.setItem(LAST_DAY_KEY, today);
  return days;
}

export function shouldShowHint(storage, nowMs) {
  if (numberAt(storage, DAYS_KEY) < SHOW_AFTER_DAYS) return false;

  const dismissedAt = storage.getItem(DISMISSED_KEY);
  return dismissedAt === null || nowMs - Number(dismissedAt) > QUIET_DAYS * DAY_MS;
}

export function dismissHint(storage, nowMs) {
  storage.setItem(DISMISSED_KEY, String(nowMs));
}
