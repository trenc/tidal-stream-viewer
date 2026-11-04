// Date and time helpers for a fixed GMT offset chosen by the user (minutes east of UTC).
// Values are shifted by the offset and read with the UTC getters, which also handles
// half-hour and 45-minute zones. Weekday names come from the browser's Intl for the chosen language.

const MINUTE = 60000;
// dd/mm/yyyy, with an optional hh:mm. Dots are accepted as well, as many people type 08.10.2026.
const INPUT_PATTERN = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/;

const OFFSET_MINUTES = [
  -720, -660, -600, -570, -540, -480, -420, -360, -300, -240, -210, -180, -120, -60,
  0, 60, 120, 180, 210, 240, 270, 300, 330, 345, 360, 390, 420, 480, 525, 540, 570,
  600, 630, 660, 720, 765, 780, 840,
];

const pad = (n) => String(n).padStart(2, '0');
const shifted = (ms, offsetMinutes) => new Date(ms + offsetMinutes * MINUTE);

function weekdayOf(ms, offsetMinutes, locale) {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(
    shifted(ms, offsetMinutes)
  );
}

export function gmtLabel(offsetMinutes) {
  if (offsetMinutes === 0) return 'GMT';

  const sign = offsetMinutes < 0 ? '-' : '+';
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return minutes ? `GMT${sign}${hours}:${pad(minutes)}` : `GMT${sign}${hours}`;
}

export const OFFSET_OPTIONS = OFFSET_MINUTES.map((minutes) => ({ minutes, label: gmtLabel(minutes) }));

export function browserOffset() {
  return -new Date().getTimezoneOffset();
}

export function nearestOffset(minutes) {
  // A corrupted stored value must not fall back to the first option (GMT−12).
  if (!Number.isFinite(minutes)) minutes = browserOffset();
  return OFFSET_MINUTES.reduce((best, candidate) =>
    Math.abs(candidate - minutes) < Math.abs(best - minutes) ? candidate : best
  );
}

export function formatDate(ms, offsetMinutes) {
  const d = shifted(ms, offsetMinutes);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

export function formatTime(ms, offsetMinutes) {
  const d = shifted(ms, offsetMinutes);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function formatDateTime(ms, offsetMinutes) {
  return `${formatDate(ms, offsetMinutes)} ${formatTime(ms, offsetMinutes)}`;
}

// "Thu 08/10/2026 12:30 GMT+2"
export function formatClock(ms, offsetMinutes, locale = 'en') {
  return `${weekdayOf(ms, offsetMinutes, locale)} ${formatDateTime(ms, offsetMinutes)} ${gmtLabel(offsetMinutes)}`;
}

// "Thu 08/10"
export function dayLabel(ms, offsetMinutes, locale = 'en') {
  const d = shifted(ms, offsetMinutes);
  return `${weekdayOf(ms, offsetMinutes, locale)} ${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}`;
}

// Parses "dd/mm/yyyy" or "dd/mm/yyyy hh:mm" written in the given offset. Returns epoch ms or NaN.
export function parseDateTime(text, offsetMinutes) {
  const match = INPUT_PATTERN.exec(String(text ?? '').trim());
  if (!match) return NaN;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const hour = match[4] === undefined ? 0 : Number(match[4]);
  const minute = match[5] === undefined ? 0 : Number(match[5]);

  const local = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const valid =
    local.getUTCFullYear() === year &&
    local.getUTCMonth() === month - 1 &&
    local.getUTCDate() === day &&
    hour < 24 &&
    minute < 60;

  return valid ? local.getTime() - offsetMinutes * MINUTE : NaN;
}
