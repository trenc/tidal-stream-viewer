// Blends the two coefficient cases of one grid cell.
// The caller handles land and frames that are not loaded by returning null.

export function blendedVector(model, options, y, x) {
  const { frame, depth, low, high, weight } = options;

  const a = model.vectorAt(frame, depth, low, y, x);
  if (!a || low === high) return a;

  // Missing data is safer than a silently wrong arrow.
  if (!Number.isFinite(weight)) return null;

  const b = model.vectorAt(frame, depth, high, y, x);
  if (!b) return null;

  return [a[0] + weight * (b[0] - a[0]), a[1] + weight * (b[1] - a[1])];
}
