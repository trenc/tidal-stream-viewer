import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createPointQuery } from './point-query.js';

const START = Date.UTC(2026, 10, 23, 8, 0);
const POINT = { lat: 48.4, lng: -4.6 };
const CELL = { y: 3, x: 4 };
const DRAW = { frame: 5, low: 0, high: 1, weight: 0.5 };

function modelWith({ cell = CELL, vector = [3, 4] } = {}) {
  return {
    cellAt: () => cell,
    isReady: () => true,
    vectorAt: () => vector,
  };
}

function sessionWith(draw = DRAW) {
  return { drawAt: () => draw };
}

function queryWith(overrides = {}) {
  return createPointQuery({
    getModel: () => modelWith(),
    getSession: () => sessionWith(),
    getDepth: () => 2,
    getCenterMs: () => START,
    loadFrames: async () => {},
    t: (key) => key,
    ...overrides,
  });
}

test('a point outside the grid needs no frames or values', async () => {
  let loads = 0;
  const query = queryWith({
    getModel: () => modelWith({ cell: null }),
    loadFrames: async () => {
      loads++;
    },
  });

  const result = await query.query(POINT);

  assert.equal(result.status, 'outside');
  assert.equal(result.current, null);
  assert.equal(result.series.length, 0);
  assert.equal(loads, 0);
});

test('a land cell is reported after its frames are loaded', async () => {
  let loads = 0;
  const query = queryWith({
    getModel: () => modelWith({ vector: null }),
    loadFrames: async () => {
      loads++;
    },
  });

  const result = await query.query(POINT);

  assert.equal(result.status, 'land');
  assert.equal(result.current, null);
  assert.equal(result.maxSpeed, null);
  assert.equal(loads, 1);
});

test('a normal query waits for the frames and returns the 12 hour series', async () => {
  const loaded = [];
  let progress = null;
  const query = queryWith({
    loadFrames: async (draws, onProgress) => {
      loaded.push(...draws);
      onProgress?.({ done: 1, total: 1 });
      progress = { done: 1, total: 1 };
    },
  });

  const result = await query.query(POINT, (value) => {
    progress = value;
  });

  assert.equal(result.status, 'ready');
  assert.equal(result.series.length, 25);
  assert.equal(result.series[0].ms, START);
  assert.equal(result.current.speed, 5);
  assert.equal(result.current.bearing, ((Math.atan2(3, 4) * 180) / Math.PI + 360) % 360);
  assert.equal(result.maxSpeed, 5);
  assert.deepEqual(loaded, [DRAW]);
  assert.deepEqual(progress, { done: 1, total: 1 });
});

test('a newer click wins over a query that is still loading', async () => {
  const resolvers = [];
  const query = queryWith({
    loadFrames: () => new Promise((resolve) => resolvers.push(resolve)),
  });

  const first = query.query(POINT);
  const second = query.query(POINT);

  resolvers[1]();
  const newer = await second;

  resolvers[0]();
  const older = await first;

  assert.equal(newer.status, 'ready');
  assert.equal(older, null);
});

test('the series is read group by group, before the store can evict early frames', async () => {
  // A stand-in for FrameStore: room for 4 frames, oldest evicted.
  const store = [];
  const keep = (key) => {
    if (!store.includes(key)) {
      store.push(key);
      if (store.length > 4) store.shift();
    }
  };
  const has = (key) => store.includes(key);

  const draws = Array.from({ length: 10 }, (_, frame) => ({ frame, low: 0, high: 1, weight: 0.5 }));
  const session = { drawAt: (ms) => draws[Math.round((ms - START) / 1800e3) % 10] };
  const model = {
    cellAt: () => CELL,
    isReady: (draw) => has(`0/${draw.frame}`) && has(`1/${draw.frame}`),
    vectorAt: (frame, _depth, c) => (has(`${c}/${frame}`) ? [3, 4] : null),
  };

  const query = queryWith({
    getModel: () => model,
    getSession: () => session,
    loadFrames: async (group) => {
      for (const draw of group) {
        keep(`0/${draw.frame}`);
        keep(`1/${draw.frame}`);
      }
    },
  });

  const result = await query.query(POINT);

  assert.equal(result.status, 'ready');
  assert.equal(result.series.length, 25);
  for (const point of result.series) {
    assert.equal(point.ready, true, String(point.ms));
    assert.equal(point.speed, 5);
  }
  assert.equal(result.maxSpeed, 5);
});

test('a frame failure is reported as an error in the current language', async () => {
  const query = queryWith({
    loadFrames: async () => {
      throw new Error('offline');
    },
    t: (key) => (key === 'point.error' ? 'No data now' : key),
  });

  const result = await query.query(POINT);

  assert.equal(result.status, 'error');
  assert.equal(result.message, 'No data now');
  assert.equal(result.series.length, 0);
});
