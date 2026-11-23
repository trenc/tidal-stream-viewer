import assert from 'node:assert/strict';
import { test } from 'node:test';

import { pointSeries, seriesDraws, seriesTimes } from './point-series.js';

const START = Date.UTC(2026, 10, 23, 0, 0);
const WINDOW = { startMs: START, endMs: START + 12 * 3600e3, stepMinutes: 30, offsetMinutes: 0 };
const CELL = { y: 1, x: 2 };
const DRAW = { frame: 0, low: 0, high: 0, weight: 0 };

function sessionWith(draw) {
  return { snapshotAt: () => ({ draw }) };
}

function modelWith(vector, { ready = true, withIsReady = true } = {}) {
  const model = {
    vectorAt: () => vector,
  };
  if (withIsReady) model.isReady = () => ready;
  return model;
}

function seriesFor(vector, options) {
  return pointSeries({
    session: sessionWith(DRAW),
    model: modelWith(vector, options),
    cell: CELL,
    times: [START],
    depth: 0,
    timeWindow: WINDOW,
  });
}

test('seriesTimes returns start-to-end times at the requested step', () => {
  assert.deepEqual(seriesTimes(START, 1, 30), [START, START + 1800e3, START + 3600e3]);
  assert.equal(seriesTimes(START, 12, 30).length, 25);
});

test('a 12-hour series at 30 minutes blends every point', () => {
  const times = seriesTimes(START, 12, 30);
  const session = { snapshotAt: () => ({ draw: { frame: 0, low: 0, high: 1, weight: 0.5 } }) };
  const model = {
    isReady: () => true,
    vectorAt: (_frame, _depth, coefficient) => (coefficient === 0 ? [2, 0] : [4, 2]),
  };

  const series = pointSeries({ session, model, cell: CELL, times, depth: 0, timeWindow: WINDOW });
  const bearing = ((Math.atan2(3, 1) * 180) / Math.PI + 360) % 360;

  assert.equal(series.length, times.length);
  assert.deepEqual(series.map((point) => point.ms), times);

  for (const point of series) {
    assert.equal(point.ready, true);
    assert.equal(point.east, 3);
    assert.equal(point.north, 1);
    assert.equal(point.speed, Math.hypot(3, 1));
    assert.equal(point.bearing, bearing);
  }
});

test('a land cell gives null values but the frames are ready', () => {
  assert.deepEqual(seriesFor(null)[0], {
    ms: START,
    ready: true,
    east: null,
    north: null,
    speed: null,
    bearing: null,
  });
});

test('no draw gives ready false and no values', () => {
  let readyCalls = 0;
  let vectorCalls = 0;
  const model = {
    isReady: () => {
      readyCalls++;
      return true;
    },
    vectorAt: () => {
      vectorCalls++;
      return [1, 0];
    },
  };

  const series = pointSeries({
    session: sessionWith(null),
    model,
    cell: CELL,
    times: [START],
    depth: 0,
    timeWindow: WINDOW,
  });

  assert.deepEqual(series[0], {
    ms: START,
    ready: false,
    east: null,
    north: null,
    speed: null,
    bearing: null,
  });
  assert.equal(readyCalls, 0);
  assert.equal(vectorCalls, 0);
});

test('a model without isReady counts as ready', () => {
  const point = seriesFor([1, 0], { withIsReady: false })[0];

  assert.equal(point.ready, true);
  assert.equal(point.east, 1);
  assert.equal(point.north, 0);
});

test('an unready frame gives ready false and no values', () => {
  let vectorCalls = 0;
  const model = {
    isReady: () => false,
    vectorAt: () => {
      vectorCalls++;
      return [1, 0];
    },
  };

  const series = pointSeries({
    session: sessionWith(DRAW),
    model,
    cell: CELL,
    times: [START],
    depth: 0,
    timeWindow: WINDOW,
  });

  assert.deepEqual(series[0], {
    ms: START,
    ready: false,
    east: null,
    north: null,
    speed: null,
    bearing: null,
  });
  assert.equal(vectorCalls, 0);
});

test('bearing follows the set direction', () => {
  const cases = [
    [[1, 0], 90],
    [[0, 1], 0],
    [[-1, 0], 270],
    [[0, -1], 180],
  ];

  for (const [vector, expected] of cases) {
    assert.equal(seriesFor(vector)[0].bearing, expected, String(vector));
  }
});

test('zero speed gives bearing 0, not NaN', () => {
  const point = seriesFor([0, 0])[0];

  assert.equal(point.speed, 0);
  assert.equal(point.bearing, 0);
});

test('seriesDraws returns one draw per time in order', () => {
  const times = [START + 900e3, START, START + 1800e3];
  const draws = [{ frame: 1, low: 0, high: 1, weight: 0.25 }, null, DRAW];
  const session = {
    snapshotAt: (ms) => ({ draw: draws[times.indexOf(ms)] }),
  };

  assert.deepEqual(seriesDraws(session, times, WINDOW), draws);
});
