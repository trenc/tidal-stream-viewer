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
  release: 'r1',
  frame: 'f_c{c}_t{t}.bin',
};

function setup(maxFrames = 48, metaOverride = {}) {
  const calls = [];
  const fullMeta = { ...meta, ...metaOverride };
  const fetchFn = async (url) => {
    calls.push(url);
    const [, c] = url.match(/f_c(\d+)_t/);
    const data = Int16Array.from([1000 * (Number(c) + 1), 500, -32768, -32768, 0, 0, 2000, -1000]);
    return { ok: true, status: 200, arrayBuffer: async () => data.buffer };
  };
  const store = new FrameStore({ fetchFn, maxFrames });
  return { calls, store, model: createFrameModel(fullMeta, store) };
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

test('prefetch reports progress for the frames it needs', async () => {
  const { model } = setup();
  const seen = [];

  await model.prefetch(draw(1), 0, (progress) => seen.push({ ...progress }));

  assert.deepEqual(seen[0], { done: 0, total: 2 });
  assert.deepEqual(seen[seen.length - 1], { done: 2, total: 2 });
});

test('model exposes the contract session and map rely on', () => {
  const { model } = setup();

  assert.equal(model.tidal, true);
  assert.deepEqual(model.bounds, [[48, -5], [48.1, -4.9]]);
});

test('frame URLs bust the SW cache with meta.version when present, the release for older metas', async () => {
  const { model, calls } = setup(48, { version: 'nc-0123456789ab' });
  await model.prefetch(draw(0, 0, 0));
  assert.equal(calls[0], '/atlas/atlasT/f_c0_t0.bin?v=nc-0123456789ab');

  const { model: without, calls: oldCalls } = setup();
  await without.prefetch(draw(0, 0, 0));
  assert.equal(oldCalls[0], '/atlas/atlasT/f_c0_t0.bin?v=r1');
});
