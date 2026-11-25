// Pure grid helpers for point queries. No DOM and no Leaflet.

// Index of the nearest value on a grid axis (latitudes or longitudes), or null when
// the target is more than half a cell away. The axis may ascend or descend.
// (tide-plan.js answers a different question with the nearest reference offset.)
function nearestAxisIndex(values, target) {
  const size = values.length;
  if (size === 1) return values[0] === target ? 0 : null;

  const ascending = values[0] < values[size - 1];
  let low = 0;
  let high = size - 1;

  while (high - low > 1) {
    const middle = (low + high) >> 1;
    const before = ascending ? values[middle] <= target : values[middle] >= target;
    if (before) low = middle;
    else high = middle;
  }

  const lowDistance = Math.abs(values[low] - target);
  const highDistance = Math.abs(values[high] - target);
  const index = highDistance < lowDistance ? high : low;
  const step = Math.abs(values[high] - values[low]);

  return Math.abs(values[index] - target) <= step / 2 ? index : null;
}

// Nearest cell of a regular grid, or null when the point lies more than half a cell outside it.
export function regularCell(lat, lon, latitudes, longitudes) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (!latitudes?.length || !longitudes?.length) return null;

  const y = nearestAxisIndex(latitudes, lat);
  const x = nearestAxisIndex(longitudes, lon);
  return y === null || x === null ? null : { y, x };
}

// Nearest cell of a curvilinear grid, or null outside the grid's bounding box.
export function curvilinearCell(lat, lon, ny, nx, latAt, lonAt) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  let best = null;
  let bestDistance = Infinity;
  let south = Infinity;
  let north = -Infinity;
  let west = Infinity;
  let east = -Infinity;

  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      const cellLat = latAt(y, x);
      const cellLon = lonAt(y, x);
      if (!Number.isFinite(cellLat) || !Number.isFinite(cellLon)) continue;

      south = Math.min(south, cellLat);
      north = Math.max(north, cellLat);
      west = Math.min(west, cellLon);
      east = Math.max(east, cellLon);

      const distance = (cellLat - lat) ** 2 + (cellLon - lon) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { y, x };
      }
    }
  }

  if (!best || lat < south || lat > north || lon < west || lon > east) return null;
  return best;
}
