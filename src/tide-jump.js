// The tide event to jump the time marker to. Pure: no DOM, no Alpine.

import { stepBeyond } from './navigation.js';

// api-maree.fr code for high water (pleine mer). Anything else is low water,
// as the markers of the tide curve draw them.
const HIGH_WATER = 'PM';

function matches(event, type) {
  if (type === 'high') return event.type === HIGH_WATER;
  if (type === 'low') return event.type !== HIGH_WATER;
  return true;
}

// The next (direction 1) or previous (direction -1) event of the given type —
// 'high', 'low' or none for both — strictly after or before ms, or null.
// Events may be unsorted; the list is not changed.
export function nextEvent(events, ms, direction, type) {
  const forward = direction > 0;

  return events.reduce((best, event) => {
    const at = Number(event.at);
    if (!matches(event, type)) return best;
    if (forward ? at <= ms : at >= ms) return best;
    if (!best || Math.abs(at - ms) < Math.abs(Number(best.at) - ms)) return event;
    return best;
  }, null);
}

// Where a jump lands, or null when the jump button is off: an event of the
// wanted type must exist, and the step it lands on must lie inside the limits —
// otherwise the marker would silently stop at the window edge. The landing
// step lies beyond the event, so the next jump in the same direction finds
// the following one.
export function jumpTarget(events, centerMs, direction, type, limits, stepMinutes) {
  const event = nextEvent(events, centerMs, direction, type);
  if (!event) return null;

  const at = Number(event.at);
  if (at < limits.minMs || at > limits.maxMs) return null;

  const targetMs = stepBeyond(at, stepMinutes, direction);
  const inside = direction > 0 ? targetMs <= limits.maxMs : targetMs >= limits.minMs;
  return inside ? { at, targetMs } : null;
}
