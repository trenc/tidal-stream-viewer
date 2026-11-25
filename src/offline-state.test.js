import assert from 'node:assert/strict';
import { test } from 'node:test';

import { frameUrls } from './offline-plan.js';
import { stateOf } from './offline-state.js';

const META = { id: 'iroise', nx: 2, ny: 2, nt: 3, coeffs: [45, 95], frame: 'f_c{c}_t{t}.bin', version: 'v1' };

test('nothing cached is none, everything cached is complete', () => {
  assert.deepEqual(stateOf(META, new Set()), { state: 'none', done: 0, total: 6 });
  assert.deepEqual(stateOf(META, new Set(frameUrls(META))), { state: 'complete', done: 6, total: 6 });
});

test('some frames cached is partial with the count', () => {
  const urls = frameUrls(META);
  const cached = new Set([urls[0], urls[4]]);

  assert.deepEqual(stateOf(META, cached), { state: 'partial', done: 2, total: 6 });
});

test('unrelated urls in the cache are ignored', () => {
  const cached = new Set([...frameUrls(META), '/atlas/roscoff/f_c0_t0.bin?v=v1', '/sw.js']);

  assert.deepEqual(stateOf(META, cached).state, 'complete');
});

test('frames of another version count as not downloaded', () => {
  const cached = new Set(frameUrls({ ...META, version: 'v0' }));

  assert.deepEqual(stateOf(META, cached), { state: 'none', done: 0, total: 6 });
});
