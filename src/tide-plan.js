const COEFF_MIN = 20;
const COEFF_MAX = 120;
const COEFF_FALLBACK = 70;

export function nearestIndex(values, target) {
  let best = 0;
  values.forEach((value, i) => {
    if (Math.abs(value - target) < Math.abs(values[best] - target)) best = i;
  });
  return best;
}

// Picks the nearest reference tide and the matching atlas frame for a clock time.
export function planFrame(model, events, target) {
  if (!events.length) return null;

  const event = events.reduce((best, candidate) =>
    Math.abs(candidate.at - target) < Math.abs(best.at - target) ? candidate : best
  );

  const offset = Math.round((target - event.at) / 60000);
  const first = Math.min(...model.offsets);
  const last = Math.max(...model.offsets);
  const clamped = Math.min(Math.max(offset, first), last);

  return {
    event,
    offset,
    clamped: clamped !== offset,
    frame: nearestIndex(model.offsets, clamped),
  };
}

// Linear blend between the lowest (neap) and highest (spring) coefficient case.
export function planBlend(coeffs, coefficient) {
  if (coeffs.length < 2) return { low: 0, high: 0, weight: 0 };

  const order = coeffs.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const low = order[0];
  const high = order[order.length - 1];

  const known = Number.isFinite(coefficient);
  const clamped = Math.min(Math.max(known ? coefficient : COEFF_FALLBACK, COEFF_MIN), COEFF_MAX);

  return {
    low: low.index,
    high: high.index,
    weight: (clamped - low.value) / (high.value - low.value),
  };
}
