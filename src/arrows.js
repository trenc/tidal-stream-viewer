// Which grid cells carry an arrow, and how strong the frame is. Pure: the map
// adapter turns the choice into polylines. contains(lat, lon) reports whether
// a cell lies in the padded viewport.

import { blendedVector } from './vector-blend.js';

// The sampling step keeps the drawn arrows near the budget: denser when more
// of the grid is visible, so zooming in shows more arrows.
export function samplingStep(visible, maxArrows) {
  return Math.max(1, Math.ceil(Math.sqrt(visible / maxArrows)));
}

// One pass over the whole grid for the frame strength and the visible count,
// then the sampled cells inside the viewport.
// options: { frame, depth, low, high, weight, maxArrows } — passed to the blend.
export function sampleArrows(model, options, contains) {
  let maxSpeed = 0;
  let visible = 0;

  for (let y = 0; y < model.ny; y++) {
    for (let x = 0; x < model.nx; x++) {
      const vector = blendedVector(model, options, y, x);
      if (!vector) continue;

      maxSpeed = Math.max(maxSpeed, Math.hypot(vector[0], vector[1]));
      if (contains(model.latAt(y, x), model.lonAt(y, x))) visible++;
    }
  }

  const step = samplingStep(visible, options.maxArrows);
  const cells = [];

  for (let y = 0; y < model.ny; y += step) {
    for (let x = 0; x < model.nx; x += step) {
      const vector = blendedVector(model, options, y, x);
      if (!vector) continue;

      const lat = model.latAt(y, x);
      const lon = model.lonAt(y, x);
      if (!contains(lat, lon)) continue;

      const [east, north] = vector;
      cells.push({ lat, lon, east, north, speed: Math.hypot(east, north) });
    }
  }

  return { cells, maxSpeed };
}
