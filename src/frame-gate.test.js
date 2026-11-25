import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createFrameGate } from './frame-gate.js';

// A load whose answer the test controls.
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Settling a load runs the gate's callbacks on the next microtask.
const settles = async (load) => {
  await load.promise.catch(() => {});
};

function modelWithPrefetch() {
  const loads = [];

  return {
    loads,
    isReady: (draw) => draw.ready,
    prefetch(draw, ahead, onProgress) {
      const load = deferred();
      loads.push({ draw, ahead, onProgress, ...load });
      return load.promise;
    },
  };
}

function gateWith() {
  const calls = { loading: [], progress: [], arrived: 0, errors: [] };

  const gate = createFrameGate({
    onLoading: (loading) => calls.loading.push(loading),
    onProgress: (progress) => calls.progress.push(progress),
    onArrived: () => calls.arrived++,
    onError: (error) => calls.errors.push(error),
  });

  return { gate, calls };
}

const DRAW = { frame: 3, low: 0, high: 1, weight: 0.5, ready: false };

test('a model without prefetch is always ready', () => {
  const { gate, calls } = gateWith();

  assert.equal(gate.ensure({}, DRAW, 0), true);
  assert.deepEqual(calls.loading, []);
});

test('a ready draw without a look-ahead renders immediately', () => {
  const { gate, calls } = gateWith();
  const model = modelWithPrefetch();

  assert.equal(gate.ensure(model, { ...DRAW, ready: true }, 0), true);
  assert.equal(model.loads.length, 0);
});

test('an unready draw blocks, reports its progress and renders on arrival', async () => {
  const { gate, calls } = gateWith();
  const model = modelWithPrefetch();

  assert.equal(gate.ensure(model, DRAW, 0), false);
  assert.deepEqual(calls.loading, [true]);

  model.loads[0].onProgress({ done: 1, total: 2 });
  assert.deepEqual(calls.progress, [{ done: 1, total: 2 }]);

  model.loads[0].resolve();
  await settles(model.loads[0]);
  assert.deepEqual(calls.loading, [true, false]);
  assert.equal(calls.arrived, 1);
  assert.deepEqual(calls.errors, []);
});

test('only the latest blocking request updates the indicator and reports errors', async () => {
  const { gate, calls } = gateWith();
  const model = modelWithPrefetch();

  gate.ensure(model, DRAW, 0);
  gate.ensure(model, { ...DRAW, frame: 4 }, 0);

  // The first request's frames arrive, but the second one owns the indicator.
  model.loads[0].onProgress({ done: 1, total: 2 });
  model.loads[0].resolve();
  await settles(model.loads[0]);
  assert.deepEqual(calls.loading, [true, true]);
  assert.deepEqual(calls.progress, []);
  assert.equal(calls.arrived, 1, 'the arrival still renders');

  model.loads[0].reject(new Error('first failed'));
  await settles(model.loads[0]);
  assert.deepEqual(calls.errors, []);

  model.loads[1].resolve();
  await settles(model.loads[1]);
  assert.deepEqual(calls.loading, [true, true, false]);
  assert.equal(calls.arrived, 2);
});

test('a warmer never blocks, and its failure is shown while it is current', async () => {
  const { gate, calls } = gateWith();
  const model = modelWithPrefetch();

  assert.equal(gate.ensure(model, { ...DRAW, ready: true }, 2), true);
  assert.deepEqual(calls.loading, []);
  assert.equal(model.loads[0].ahead, 2);
  assert.equal(model.loads[0].onProgress, undefined, 'a warmer reports no progress');

  // A second warmer fails while no blocking request has taken over.
  gate.ensure(model, { ...DRAW, ready: true }, 2);
  model.loads[1].reject(new Error('warmer failed'));
  await settles(model.loads[1]);
  assert.equal(calls.errors.length, 1);
  assert.equal(calls.errors[0].message, 'warmer failed');
  assert.deepEqual(calls.loading, [], 'a warmer never touches the loading indicator');

  // The first warmer's arrival still needs no render.
  model.loads[0].resolve();
  await settles(model.loads[0]);
  assert.equal(calls.arrived, 0);
});

test("a warmer's error is shown only until a blocking request takes over", async () => {
  const { gate, calls } = gateWith();
  const model = modelWithPrefetch();

  gate.ensure(model, { ...DRAW, ready: true }, 2);
  gate.ensure(model, DRAW, 0);

  model.loads[0].reject(new Error('warmer failed'));
  await settles(model.loads[0]);
  assert.deepEqual(calls.errors, [], 'the blocking request owns the error reporting');

  model.loads[1].reject(new Error('blocking failed'));
  await settles(model.loads[1]);
  assert.equal(calls.errors.length, 1);
  assert.equal(calls.errors[0].message, 'blocking failed');
  assert.deepEqual(calls.loading, [true, false]);
});

test('a cancelled model keeps its in-flight loads from reporting', async () => {
  const { gate, calls } = gateWith();
  const model = modelWithPrefetch();

  gate.ensure(model, DRAW, 0);
  gate.ensure(model, { ...DRAW, frame: 4 }, 0);
  gate.cancel();

  model.loads[0].resolve();
  await settles(model.loads[0]);
  assert.deepEqual(calls.loading, [true, true], 'the indicator is not hidden by the stale request');
  assert.equal(calls.arrived, 1, 'the arrival still renders');

  model.loads[1].reject(new Error('stale failed'));
  await settles(model.loads[1]);
  assert.deepEqual(calls.errors, []);
  assert.deepEqual(calls.loading, [true, true]);
});
