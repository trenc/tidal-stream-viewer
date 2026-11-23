import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadFrames } from './load-frames.js';

const DRAW = { frame: 0, low: 0, high: 0, weight: 0 };

function modelRecording(calls) {
  return {
    prefetch: async (draw, ahead, onProgress, signal) => {
      calls.push({ frame: draw.frame, signal });
    },
  };
}

test('loadFrames loads the draws in order and stops when isCurrent turns false', async () => {
  const calls = [];
  const model = modelRecording(calls);

  await loadFrames(model, [DRAW, { ...DRAW, frame: 1 }, { ...DRAW, frame: 2 }], () => true);
  assert.deepEqual(calls.map((call) => call.frame), [0, 1, 2]);

  await loadFrames(model, [{ ...DRAW, frame: 3 }, { ...DRAW, frame: 4 }], () => false);
  assert.deepEqual(calls.map((call) => call.frame), [0, 1, 2], 'no draw after the stop');
});

test('loadFrames hands the signal of the query to every prefetch', async () => {
  const calls = [];
  const signal = new AbortController().signal;

  await loadFrames(modelRecording(calls), [DRAW], () => true, signal);

  assert.equal(calls[0].signal, signal);
});

test('loadFrames without a model or without prefetch loads nothing', async () => {
  const calls = [];

  await loadFrames(null, [DRAW], () => true);
  await loadFrames({}, [DRAW], () => true);

  assert.deepEqual(calls, []);
});
