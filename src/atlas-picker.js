// Choosing an atlas by place. Pure functions, no DOM and no Leaflet.
// An index entry has bbox [south, west, north, east] and resolutionM (grid size in metres).

export function hasCoverage(entry) {
  return Array.isArray(entry.bbox) && entry.bbox.length === 4;
}

// Atlases whose area contains the point, finest grid first.
export function covering(entries, lat, lon) {
  return entries
    .filter(
      (entry) =>
        hasCoverage(entry) &&
        lat >= entry.bbox[0] &&
        lat <= entry.bbox[2] &&
        lon >= entry.bbox[1] &&
        lon <= entry.bbox[3]
    )
    .sort(
      (a, b) =>
        (a.resolutionM ?? Infinity) - (b.resolutionM ?? Infinity) || a.label.localeCompare(b.label)
    );
}

export function bestAt(entries, lat, lon) {
  return covering(entries, lat, lon)[0] ?? null;
}

// Leaflet bounds [[south, west], [north, east]]
export function boundsOf(entry) {
  return [
    [entry.bbox[0], entry.bbox[1]],
    [entry.bbox[2], entry.bbox[3]],
  ];
}

// One box around all atlases, or null when none has a position.
export function allBounds(entries) {
  const boxes = entries.filter(hasCoverage).map((entry) => entry.bbox);
  if (!boxes.length) return null;

  return [
    [Math.min(...boxes.map((b) => b[0])), Math.min(...boxes.map((b) => b[1]))],
    [Math.max(...boxes.map((b) => b[2])), Math.max(...boxes.map((b) => b[3]))],
  ];
}
