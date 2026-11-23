import assert from 'node:assert/strict';
import { test } from 'node:test';

import { drawGroups, pointSeries, seriesDraws, seriesTimes, uniqueDraws } from './point-series.js';

const START = Date.UTC(2026, 10, 23, 0, 0);
const CELL = { y: 1, x: 2 };
const DRAW = { frame: 0, low: 0, high: 0, weight: 0 };

function sessionWith(draw) {
  return { drawAt: () => draw };
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
  });
}

test('seriesTimes returns start-to-end times at the requested step', () => {
  assert.deepEqual(seriesTimes(START, 1, 30), [START, START + 1800e3, START + 3600e3]);
  assert.equal(seriesTimes(START, 12, 30).length, 25);
});

test('a 12-hour series at 30 minutes blends every point', () => {
  const times = seriesTimes(START, 12, 30);
  const session = { drawAt: () => ({ frame: 0, low: 0, high: 1, weight: 0.5 }) };
  const model = {
    isReady: () => true,
    vectorAt: (_frame, _depth, coefficient) => (coefficient === 0 ? [2, 0] : [4, 2]),
  };

  const series = pointSeries({ session, model, cell: CELL, times, depth: 0 });
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
    drawAt: (ms) => draws[times.indexOf(ms)],
  };

  assert.deepEqual(seriesDraws(session, times), draws);
});

test('drawGroups collects the times of each distinct draw in first-seen order', () => {
  const a = { frame: 1, low: 0, high: 1, weight: 0.25 };
  const b = { frame: 2, low: 0, high: 1, weight: 0.5 };

  assert.deepEqual(drawGroups([a, null, a, b, a]), [
    { draw: a, indexes: [0, 2, 4] },
    { draw: b, indexes: [3] },
  ]);
  assert.deepEqual(drawGroups([null, undefined]), []);
});

test('uniqueDraws drops duplicates and nulls but keeps the first-seen order', () => {
  const first = { frame: 2, low: 0, high: 1, weight: 0.25 };
  const second = { frame: 3, low: 0, high: 1, weight: 0.5 };
  const sameFrameOtherBlend = { frame: 2, low: 1, high: 1, weight: 0 };

  const unique = uniqueDraws([first, null, first, second, sameFrameOtherBlend, undefined]);

  assert.deepEqual(unique, [first, second, sameFrameOtherBlend]);
  assert.equal(unique[0], first, 'the original object is kept');
});

test('pointSeries uses the given draws and does not ask the session for more', () => {
  let drawCalls = 0;
  const session = {
    drawAt: () => {
      drawCalls++;
      return DRAW;
    },
  };

  const series = pointSeries({
    session,
    model: modelWith([1, 0]),
    cell: CELL,
    times: [START],
    depth: 0,
    draws: [{ frame: 7, low: 0, high: 0, weight: 0 }],
  });

  assert.equal(drawCalls, 0);
  assert.equal(series[0].ready, true);
  assert.equal(series[0].east, 1);
});
