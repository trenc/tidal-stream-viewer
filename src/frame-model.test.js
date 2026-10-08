import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createFrameModel } from './frame-model.js';
import { FrameStore } from './frame-store.js';

const meta = {
  id: 'atlasT',
  label: 'Test',
  nt: 3,
  ny: 2,
  nx: 2,
  coeffs: [45, 95],
  offsets: [-30, 0, 30],
  reference: null,
  depths: [],
  lat: [48, 48.1],
  lon: [-5, -4.9],
  scale: 0.001,
  sentinel: -32768,
  maxSpeedKn: 3.89,
  release: 'r1',
  frame: 'f_c{c}_t{t}.bin',
};

function setup(maxFrames = 48) {
  const calls = [];
  const fetchFn = async (url) => {
    calls.push(url);
    const [, c] = url.match(/f_c(\d+)_t/);
    const data = Int16Array.from([1000 * (Number(c) + 1), 500, -32768, -32768, 0, 0, 2000, -1000]);
    return { ok: true, status: 200, arrayBuffer: async () => data.buffer };
  };
  const store = new FrameStore({ fetchFn, maxFrames });
  return { calls, store, model: createFrameModel(meta, store) };
}

const draw = (frame, low = 0, high = 1) => ({ frame, low, high, weight: 0.5 });

test('a frame is not ready until prefetched, then vectors and land decode', async () => {
  const { model } = setup();
  assert.equal(model.isReady(draw(0, 0, 0)), false);
  assert.equal(model.vectorAt(0, 0, 0, 0, 0), null);

  await model.prefetch(draw(0, 0, 0));
  assert.ok(model.isReady(draw(0, 0, 0)));
  assert.deepEqual(model.vectorAt(0, 0, 0, 0, 0), [1, 0.5]);
  assert.equal(model.vectorAt(0, 0, 0, 0, 1), null);
});

test('a neap/spring draw loads both coefficient frames once', async () => {
  const { model, calls } = setup();
  await model.prefetch(draw(1));
  await model.prefetch(draw(1));

  assert.equal(calls.length, 2);
  assert.deepEqual(model.vectorAt(1, 0, 1, 0, 0), [2, 0.5]);
});

test('the least recently used frame is evicted', async () => {
  const { model } = setup(2);
  await model.prefetch(draw(0, 0, 0));
  await model.prefetch(draw(1, 0, 0));
  await model.prefetch(draw(2, 0, 0));

  assert.equal(model.isReady(draw(0, 0, 0)), false);
  assert.ok(model.isReady(draw(2, 0, 0)));
});

test('prefetch with ahead warms a later frame', async () => {
  const { model } = setup();
  await model.prefetch(draw(0, 0, 0), 2);
  await new Promise(setImmediate);

  assert.ok(model.isReady(draw(2, 0, 0)));
});

test('model exposes the contract session and map rely on', () => {
  const { model } = setup();

  assert.equal(model.tidal, true);
  assert.deepEqual(model.bounds, [[48, -5], [48.1, -4.9]]);
  assert.ok(Math.abs(model.maxSpeed - 3.89 / 1.943844) < 1e-9);
});
