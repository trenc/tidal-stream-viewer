import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FrameStore } from './frame-store.js';

const META = { id: 'iroise', nx: 2, ny: 2, frame: 'f_c{c}_t{t}.bin', version: 'v1' };
const BODY = new Int16Array(8).buffer; // nx * ny * 4 = 16 bytes

const abortError = () => {
  const error = new Error('aborted');
  error.name = 'AbortError';
  return error;
};

// A fetch whose calls the test controls one by one.
function scriptedFetch() {
  const calls = [];
  const fetchFn = (url, options) => {
    const call = { url, options };
    call.promise = new Promise((resolve, reject) => {
      call.resolve = (body) => resolve({ ok: true, arrayBuffer: async () => body });
      call.reject = reject;
    });
    options?.signal?.addEventListener('abort', () => call.reject(abortError()));
    calls.push(call);
    return call.promise;
  };
  return { fetchFn, calls };
}

test('concurrent loads share one fetch and the finished frame is cached', async () => {
  const { fetchFn, calls } = scriptedFetch();
  const store = new FrameStore({ baseUrl: '/atlas', fetchFn });

  const first = store.load(META, 0, 5);
  const second = store.load(META, 0, 5);
  assert.equal(calls.length, 1, 'one fetch for both callers');

  calls[0].resolve(BODY);
  const frame = await first;

  assert.equal(frame.length, 8);
  assert.equal(await second, frame, 'the same frame object');
  assert.equal(await store.load(META, 0, 5), frame, 'served from the cache');
  assert.equal(calls.length, 1);
});

test('a load started with a signal is aborted when the signal aborts', async () => {
  const { fetchFn, calls } = scriptedFetch();
  const store = new FrameStore({ baseUrl: '/atlas', fetchFn });
  const controller = new AbortController();

  const load = store.load(META, 0, 5, controller.signal);
  controller.abort();

  await assert.rejects(load, (error) => error.name === 'AbortError');
  assert.equal(calls.length, 1, 'the aborted fetch is not retried by itself');
});

test('a caller that joins an aborted fetch fetches the frame for itself', async () => {
  const { fetchFn, calls } = scriptedFetch();
  const store = new FrameStore({ baseUrl: '/atlas', fetchFn });
  const controller = new AbortController();

  const starter = store.load(META, 0, 5, controller.signal);
  const joiner = store.load(META, 0, 5); // no signal: e.g. the timeline joined the request
  assert.equal(calls.length, 1);

  controller.abort();
  await assert.rejects(starter, (error) => error.name === 'AbortError');

  calls[1].resolve(BODY); // the joiner's own retry
  assert.equal((await joiner).length, 8);
  assert.equal(calls.length, 2);
});

test('a joiner whose own signal is aborted is not retried', async () => {
  const { fetchFn, calls } = scriptedFetch();
  const store = new FrameStore({ baseUrl: '/atlas', fetchFn });
  const starterController = new AbortController();
  const joinerController = new AbortController();

  const starter = store.load(META, 0, 5, starterController.signal);
  const joiner = store.load(META, 0, 5, joinerController.signal);

  starterController.abort();
  joinerController.abort();
  await assert.rejects(joiner, (error) => error.name === 'AbortError');
  await assert.rejects(starter, (error) => error.name === 'AbortError');
  assert.equal(calls.length, 1, 'no retry for a caller that is gone anyway');
});
