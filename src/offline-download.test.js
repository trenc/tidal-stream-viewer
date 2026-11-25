import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createDownload, DownloadQuotaError } from './offline-download.js';

const URLS = [
  '/atlas/iroise/f_c0_t0.bin?v=v1',
  '/atlas/iroise/f_c0_t1.bin?v=v1',
  '/atlas/iroise/f_c0_t2.bin?v=v1',
];

const abortError = () => {
  const error = new Error('aborted');
  error.name = 'AbortError';
  return error;
};

// Lets the pool's awaited calls (openCache, cache.match) run before the test continues.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

// A fetch whose calls the test controls one by one.
function scriptedFetch() {
  const calls = [];
  const fetchFn = (url, options) => {
    const call = { url, options };
    call.promise = new Promise((resolve, reject) => {
      call.resolve = (body, ok = true) => resolve({ ok, body });
      call.reject = reject;
    });
    options?.signal?.addEventListener('abort', () => call.reject(abortError()));
    calls.push(call);
    return call.promise;
  };
  return { fetchFn, calls };
}

// A Map-backed stand-in for a Cache.
function fakeCache({ quotaOnPut = false } = {}) {
  const entries = new Map();
  return {
    entries,
    match: async (url) => entries.get(url),
    put: async (url, response) => {
      if (quotaOnPut) {
        const error = new Error('quota');
        error.name = 'QuotaExceededError';
        throw error;
      }
      entries.set(url, response);
    },
  };
}

test('frames already in the cache are counted and not fetched again', async () => {
  const { fetchFn, calls } = scriptedFetch();
  const cache = fakeCache();
  cache.entries.set(URLS[0], { ok: true });
  cache.entries.set(URLS[2], { ok: true });

  const download = createDownload({ openCache: () => cache, fetchFn, urls: URLS });
  await flush();

  assert.equal(calls.length, 1, 'only the missing frame is fetched');
  assert.equal(calls[0].url, URLS[1]);
  calls[0].resolve();

  assert.deepEqual(await download, { done: 3, total: 3, failed: 0 });
});

test('the fetch is plain: only the signal is passed on', async () => {
  const { fetchFn, calls } = scriptedFetch();
  const controller = new AbortController();

  const download = createDownload({
    openCache: () => fakeCache(),
    fetchFn,
    urls: URLS.slice(0, 1),
    signal: controller.signal,
  });
  await flush();
  calls[0].resolve();
  await download;

  assert.deepEqual(calls[0].options, { signal: controller.signal });
});

test('a response that is not ok counts as failed and is not stored', async () => {
  const { fetchFn, calls } = scriptedFetch();
  const cache = fakeCache();

  const download = createDownload({ openCache: () => cache, fetchFn, urls: URLS.slice(0, 1) });
  await flush();
  calls[0].resolve(null, false);

  assert.deepEqual(await download, { done: 0, total: 1, failed: 1 });
  assert.equal(cache.entries.size, 0);
});

test('a rejected fetch counts as failed and the download goes on', async () => {
  const { fetchFn, calls } = scriptedFetch();

  const download = createDownload({ openCache: () => fakeCache(), fetchFn, urls: URLS });
  await flush();
  assert.equal(calls.length, 3, 'every url has a fetch in flight');
  calls[0].reject(new Error('network down'));
  calls[1].resolve();
  calls[2].resolve();

  assert.deepEqual(await download, { done: 2, total: 3, failed: 1 });
});

test('a frame the service worker stored meanwhile is not put again', async () => {
  const { fetchFn, calls } = scriptedFetch();
  const cache = fakeCache();

  const download = createDownload({ openCache: () => cache, fetchFn, urls: URLS.slice(0, 1) });
  await flush();

  const storedBySw = { ok: true };
  cache.entries.set(URLS[0], storedBySw);
  let cancelled = false;
  calls[0].resolve({ cancel: () => (cancelled = true) });

  assert.deepEqual(await download, { done: 1, total: 1, failed: 0 });
  assert.equal(cache.entries.get(URLS[0]), storedBySw, 'the stored response is kept');
  assert.ok(cancelled, 'the unused body is cancelled');
});

test('a pool of concurrency workers, the next url starts when one finishes', async () => {
  const { fetchFn, calls } = scriptedFetch();

  const download = createDownload({ openCache: () => fakeCache(), fetchFn, urls: URLS, concurrency: 2 });
  await flush();

  assert.equal(calls.length, 2, 'two fetches in flight');
  calls[0].resolve();
  await flush();
  assert.equal(calls.length, 3, 'the third starts after the first finishes');

  calls[1].resolve();
  calls[2].resolve();
  assert.deepEqual(await download, { done: 3, total: 3, failed: 0 });
});

test('progress is reported after every frame, cached ones included', async () => {
  const { fetchFn, calls } = scriptedFetch();
  const cache = fakeCache();
  cache.entries.set(URLS[0], { ok: true });

  const progress = [];
  const download = createDownload({
    openCache: () => cache,
    fetchFn,
    urls: URLS,
    concurrency: 1,
    onProgress: (counts) => progress.push(counts),
  });
  await flush();
  calls[0].resolve();
  await flush();
  calls[1].resolve();
  await download;

  assert.deepEqual(progress, [
    { done: 1, total: 3, failed: 0 },
    { done: 2, total: 3, failed: 0 },
    { done: 3, total: 3, failed: 0 },
  ]);
});

test('an abort rejects the download, stops new fetches and keeps stored frames', async () => {
  const { fetchFn, calls } = scriptedFetch();
  const cache = fakeCache();
  cache.entries.set(URLS[0], { ok: true }); // stored by an earlier run
  const controller = new AbortController();

  const download = createDownload({
    openCache: () => cache,
    fetchFn,
    urls: URLS,
    concurrency: 1,
    signal: controller.signal,
  });
  await flush();
  assert.equal(calls[0].url, URLS[1], 'the cached frame was not fetched again');

  controller.abort();

  await assert.rejects(download, (error) => error.name === 'AbortError');
  assert.equal(calls.length, 1, 'no further fetch is started');
  assert.ok(cache.entries.has(URLS[0]), 'the stored frame survives');
});

test('a quota error stops the whole download with the partial counts', async () => {
  const { fetchFn, calls } = scriptedFetch();
  const cache = fakeCache({ quotaOnPut: true });
  cache.entries.set(URLS[0], { ok: true }); // resumed, counts as done

  const download = createDownload({ openCache: () => cache, fetchFn, urls: URLS, concurrency: 1 });
  await flush();
  calls[0].resolve();

  await assert.rejects(download, (error) => {
    assert.ok(error instanceof DownloadQuotaError);
    assert.deepEqual(
      { done: error.done, total: error.total, failed: error.failed },
      { done: 1, total: 3, failed: 0 }
    );
    return true;
  });
  assert.equal(calls.length, 1, 'no fetch is started after the quota error');
});

test('an empty url list resolves with zero counts', async () => {
  const counts = await createDownload({ openCache: () => fakeCache(), fetchFn: () => {}, urls: [] });

  assert.deepEqual(counts, { done: 0, total: 0, failed: 0 });
});
