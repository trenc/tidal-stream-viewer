import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createPointQuery, wirePointQuery } from './point-query.js';

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

test('a normal query reports the current, then progress, then the full series', async () => {
  const loaded = [];
  const updates = [];
  const query = queryWith({
    loadFrames: async (group) => {
      loaded.push(...group);
    },
  });

  const result = await query.query(POINT, (update) => updates.push(update));

  assert.equal(result.status, 'ready');
  assert.equal(result.series.length, 13);
  assert.equal(result.series[0].ms, START);
  assert.equal(result.current.speed, 5);
  assert.equal(result.current.bearing, ((Math.atan2(3, 4) * 180) / Math.PI + 360) % 360);
  assert.equal(result.maxSpeed, 5);
  assert.deepEqual(loaded, [DRAW]);

  assert.deepEqual(updates.map((update) => update.status), ['current', 'curve']);
  assert.equal(updates[0].current.speed, 5);
  assert.equal(updates[1].done, 1);
  assert.equal(updates[1].total, 1);
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
  const session = { drawAt: (ms) => draws[Math.round((ms - START) / 3600e3) % 10] };
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
  assert.equal(result.series.length, 13);
  for (const point of result.series) {
    assert.equal(point.ready, true, String(point.ms));
    assert.equal(point.speed, 5);
  }
  assert.equal(result.maxSpeed, 5);
});

test('a superseded query loads no further draws', async () => {
  const calls = [];
  const resolvers = [];
  const SECOND = { frame: 6, low: 0, high: 1, weight: 0.5 };
  const session = { drawAt: (ms) => (Math.floor((ms - START) / 3600e3) % 2 ? SECOND : DRAW) };

  const query = queryWith({
    getSession: () => session,
    loadFrames: (group) => {
      calls.push(group[0].frame);
      return new Promise((resolve) => resolvers.push(resolve));
    },
  });

  const first = query.query(POINT);
  const second = query.query(POINT);

  const tick = () => new Promise((resolve) => setTimeout(resolve));
  resolvers[1](); // the second query's first group
  await tick(); // the second query now asks for its next group
  resolvers[2](); // the second query's second group
  const newer = await second;

  resolvers[0]();
  const older = await first;

  assert.equal(newer.status, 'ready');
  assert.equal(older, null);
  // first#1, second#1, second#2: after the second click the first query asks for nothing.
  assert.deepEqual(calls, [DRAW.frame, DRAW.frame, SECOND.frame]);
});

test('the current is reported while the later groups are still loading', async () => {
  const events = [];
  const resolvers = [];
  const SECOND = { frame: 6, low: 0, high: 1, weight: 0.5 };
  const session = { drawAt: (ms) => (Math.floor((ms - START) / 3600e3) % 2 ? SECOND : DRAW) };

  const query = queryWith({
    getSession: () => session,
    loadFrames: async (group) => {
      events.push(`load:${group[0].frame}`);
      if (group[0].frame === SECOND.frame) {
        await new Promise((resolve) => resolvers.push(resolve));
      }
    },
  });

  const updates = [];
  const pending = query.query(POINT, (update) => {
    updates.push(update);
    events.push(`update:${update.status}${update.done === undefined ? '' : `:${update.done}`}`);
  });

  // Let everything up to the blocked load run, but no further.
  await new Promise((resolve) => setTimeout(resolve));

  assert.deepEqual(events, ['load:5', 'update:current', 'update:curve:1', 'load:6']);
  assert.equal(updates[0].current.speed, 5);
  assert.equal(updates[1].done, 1);
  assert.equal(updates[1].total, 2);

  resolvers[0]();
  const result = await pending;

  assert.equal(result.status, 'ready');
  assert.deepEqual(events.slice(4), ['update:curve:2']);
  assert.deepEqual(updates.map((update) => update.status), ['current', 'curve', 'curve']);
  assert.equal(updates[2].done, 2);
  assert.equal(updates[2].total, 2);
});

test('with the curve skipped only the current is loaded and returned', async () => {
  const loaded = [];
  const updates = [];
  const SECOND = { frame: 6, low: 0, high: 1, weight: 0.5 };
  const session = { drawAt: (ms) => (Math.floor((ms - START) / 3600e3) % 2 ? SECOND : DRAW) };

  const query = queryWith({
    getSession: () => session,
    curve: false,
    loadFrames: async (group) => {
      loaded.push(...group);
    },
  });

  const result = await query.query(POINT, (update) => updates.push(update));

  assert.deepEqual(loaded, [DRAW]);
  assert.deepEqual(updates.map((update) => update.status), ['current']);
  assert.equal(result.status, 'current');
  assert.equal(result.current.speed, 5);
  assert.deepEqual(result.series, []);
});

test('without tide data the query says so and loads nothing', async () => {
  let loads = 0;
  const query = queryWith({
    getSession: () => ({ drawAt: () => null }),
    loadFrames: async () => {
      loads++;
    },
  });

  const result = await query.query(POINT);

  assert.equal(result.status, 'noTide');
  assert.equal(loads, 0);
  assert.deepEqual(result.series, []);
});

test('cancelling a query stops its loads', async () => {
  const calls = [];
  const resolvers = [];
  const query = queryWith({
    loadFrames: (group) => {
      calls.push(group[0].frame);
      return new Promise((resolve) => resolvers.push(resolve));
    },
  });

  const pending = query.query(POINT);
  query.cancel();
  resolvers[0]();

  assert.equal(await pending, null);
  assert.deepEqual(calls, [DRAW.frame]);
});

test('the wiring the viewer uses stops and aborts a cancelled query', async () => {
  const calls = [];
  const resolvers = [];
  const model = {
    cellAt: () => CELL,
    prefetch: async (draw, ahead, onProgress, signal) => {
      calls.push({ frame: draw.frame, signal });
      if (draw.frame === DRAW.frame) await new Promise((resolve) => resolvers.push(resolve));
    },
  };
  const SECOND = { frame: 6, low: 0, high: 1, weight: 0.5 };
  const session = { drawAt: (ms) => (Math.floor((ms - START) / 3600e3) % 2 ? SECOND : DRAW) };

  const controller = wirePointQuery({
    getModel: () => model,
    getSession: () => session,
    getDepth: () => 0,
    getCenterMs: () => START,
    t: (key) => key,
  });

  const pending = controller.query(POINT);
  controller.cancel();
  resolvers[0]();

  assert.equal(await pending, null);
  assert.deepEqual(calls.map((call) => call.frame), [DRAW.frame], 'no draw after the cancel');
  assert.equal(calls[0].signal.aborted, true, 'the load in flight is aborted');
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
