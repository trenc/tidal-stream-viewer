// Blends the two coefficient cases of one grid cell.
// The caller handles land and frames that are not loaded by returning null.

export function blendedVector(model, options, y, x) {
  const { frame, depth, low, high, weight } = options;

  const a = model.vectorAt(frame, depth, low, y, x);
  if (!a || low === high) return a;

  const b = model.vectorAt(frame, depth, high, y, x);
  if (!b) return null;

  // A non-finite weight must not leak NaN or Infinity into the arrows.
  const t = Number.isFinite(weight) ? weight : 0;
  return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
}
