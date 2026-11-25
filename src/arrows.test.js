import assert from 'node:assert/strict';
import { test } from 'node:test';

import { sampleArrows, samplingStep } from './arrows.js';

// A grid whose rows double as latitudes and columns as longitudes, so a
// "viewport" is simply a rectangle of row/column indices. vectorAt returns
// null for land cells.
function gridModel({ ny, nx, vectorAt }) {
  return {
    ny,
    nx,
    vectorAt,
    latAt: (y) => y,
    lonAt: (y, x) => x,
  };
}

// low === high makes the blend return the low case directly.
const options = (maxArrows) => ({ frame: 0, depth: 0, low: 0, high: 0, weight: 0, maxArrows });

test('the sampling step follows the visible area, never below one', () => {
  assert.equal(samplingStep(0, 100), 1);
  assert.equal(samplingStep(100, 100), 1);
  assert.equal(samplingStep(200, 100), 2);
  assert.equal(samplingStep(250, 100), 2);
  assert.equal(samplingStep(10000, 100), 10);
});

test('every cell is drawn when all arrows fit the budget', () => {
  const model = gridModel({ ny: 3, nx: 3, vectorAt: () => [3, 4] });
  const { cells, maxSpeed } = sampleArrows(model, options(100), () => true);

  assert.equal(cells.length, 9);
  assert.equal(maxSpeed, 5);
  assert.deepEqual(cells[4], { lat: 1, lon: 1, east: 3, north: 4, speed: 5 });
});

test('a dense visible grid is sampled down to the budget', () => {
  const model = gridModel({ ny: 6, nx: 6, vectorAt: () => [3, 4] });
  const { cells } = sampleArrows(model, options(9), () => true);

  // visible = 36, so the step is 2: every other row and column.
  assert.equal(cells.length, 9);
  assert.deepEqual(
    cells.map(({ lat, lon }) => [lat, lon]),
    [0, 2, 4].flatMap((y) => [0, 2, 4].map((x) => [y, x]))
  );
});

test('the frame strength covers the whole grid, the arrows only the viewport', () => {
  const model = gridModel({
    ny: 4,
    nx: 4,
    vectorAt: (_f, _d, _c, y, _x) => (y === 3 ? [10, 0] : [3, 4]),
  });
  const inside = (lat) => lat < 3;
  const { cells, maxSpeed } = sampleArrows(model, options(100), inside);

  assert.equal(maxSpeed, 10); // the strong cell lies outside and is still counted
  assert.ok(cells.every(({ lat }) => lat < 3));
  assert.equal(cells.length, 12);
});

test('land cells are neither counted nor drawn', () => {
  const model = gridModel({
    ny: 4,
    nx: 4,
    vectorAt: (_f, _d, _c, _y, x) => (x === 0 ? null : [3, 4]),
  });
  const { cells, maxSpeed } = sampleArrows(model, options(100), () => true);

  assert.equal(cells.length, 12);
  assert.equal(maxSpeed, 5);
});

test('sampled cells outside the viewport are skipped at their step position', () => {
  const model = gridModel({ ny: 5, nx: 5, vectorAt: () => [3, 4] });
  const inside = (lat) => lat < 2;
  const { cells } = sampleArrows(model, options(100), inside);

  assert.ok(cells.every(({ lat }) => lat < 2));
  assert.equal(cells.length, 10);
});
