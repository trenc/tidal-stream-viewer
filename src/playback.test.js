import assert from 'node:assert/strict';
import { test } from 'node:test';

import { advancePlayback, playbackStride } from './playback.js';

const MS = Date.parse('2026-11-06T10:00Z');
const limits = { minMs: MS - 24 * 3600e3, maxMs: MS + 24 * 3600e3 };

test('tidal playback moves about 30 minutes per tick, never less than one step', () => {
  assert.equal(playbackStride(true, 10), 3);
  assert.equal(playbackStride(true, 15), 2);
  assert.equal(playbackStride(true, 30), 1);
  assert.equal(playbackStride(true, 60), 1);
  assert.equal(playbackStride(true, 120), 1);
});

test('non-tidal playback steps frame by frame', () => {
  assert.equal(playbackStride(false, 60), 1);
  assert.equal(playbackStride(false, 10), 1);
});

test('a tidal tick advances the marker by the stride in steps', () => {
  const step = { centerMs: MS, stepMinutes: 10, limits };
  assert.deepEqual(advancePlayback({ isTidal: true, ...step }), { centerMs: MS + 30 * 60000 });
  assert.deepEqual(advancePlayback({ isTidal: true, centerMs: MS, stepMinutes: 60, limits }), {
    centerMs: MS + 60 * 60000,
  });
});

test('a tidal tick past the limits stops the playback', () => {
  const near = { minMs: limits.minMs, maxMs: MS + 15 * 60000 };
  assert.equal(advancePlayback({ isTidal: true, centerMs: MS, stepMinutes: 10, limits: near }), null);
});

test('a non-tidal tick advances the frame index and wraps at the end', () => {
  const frame = { isTidal: false, centerMs: MS, stepMinutes: 60, limits, sliderMax: 5 };

  assert.deepEqual(advancePlayback({ ...frame, sliderIndex: 2 }), { sliderIndex: 3 });
  assert.deepEqual(advancePlayback({ ...frame, sliderIndex: 5 }), { sliderIndex: 0 });
});
