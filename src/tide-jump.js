// The tide event to jump the time marker to. Pure: no DOM, no Alpine.

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
