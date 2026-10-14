// Pure helpers for the time marker: how far it may move, how drags and keys translate into time.
// No Alpine, no DOM.

export const DAY_MS = 864e5;

// Days shown on each side of the marker.
export const VIEW_DAYS = 2;
// How far from today the marker may go, in both directions.
export const LIMIT_DAYS = 7;

export const VIEW_HALF_MS = VIEW_DAYS * DAY_MS;
export const VIEW_SPAN_MS = 2 * VIEW_HALF_MS;

const WHEEL_FACTOR = 0.25;

export function limitsAround(nowMs) {
  return { minMs: nowMs - LIMIT_DAYS * DAY_MS, maxMs: nowMs + LIMIT_DAYS * DAY_MS };
}

// Time range the tide data has to cover: the limits plus what the view shows beyond them.
export function dataRange(limits) {
  return { startMs: limits.minMs - VIEW_HALF_MS, endMs: limits.maxMs + VIEW_HALF_MS };
}

// Keeps the marker inside the limits and on a multiple of the atlas time step.
export function clampAndSnap(ms, limits, stepMinutes) {
  const step = stepMinutes * 60000;
  const lowest = Math.ceil(limits.minMs / step) * step;
  const highest = Math.floor(limits.maxMs / step) * step;
  const snapped = Math.round(ms / step) * step;

  return Math.min(Math.max(snapped, lowest), highest);
}

// Dragging the curve to the right moves the marker to an earlier time.
export function dragCenter(startCenterMs, dxPixels, widthPixels) {
  return startCenterMs - (dxPixels / widthPixels) * VIEW_SPAN_MS;
}

export function wheelDelta(deltaX, deltaY, widthPixels) {
  return ((deltaX + deltaY) / widthPixels) * VIEW_SPAN_MS * WHEEL_FACTOR;
}

// Minutes to move for a key press, or null when the key does nothing.
export function keyboardMinutes(key, shiftKey, stepMinutes) {
  const direction = { ArrowLeft: -1, ArrowRight: 1 }[key];
  if (direction) return direction * (shiftKey ? 60 : stepMinutes);

  return { PageUp: -720, PageDown: 720 }[key] ?? null;
}

// Share (0..100) of the visible width that lies beyond the limits on each side.
export function shadeOf(centerMs, limits) {
  const start = centerMs - VIEW_HALF_MS;
  const end = centerMs + VIEW_HALF_MS;
  const percent = (ms) => Math.min(100, Math.max(0, (ms / VIEW_SPAN_MS) * 100));

  return { left: percent(limits.minMs - start), right: percent(end - limits.maxMs) };
}
