import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  META_TIMEOUT_MS,
  cacheApiAvailable,
  loadMetasProgressively,
  metaWithTimeout,
} from './offline-meta.js';

const ENTRIES = [
  { id: 'a', label: 'Atlas A', kind: 'frames' },
  { id: 'b', label: 'Atlas B', kind: 'frames' },
  { id: 'c', label: 'Atlas C', kind: 'frames' },
];

test('a hanging meta counts as failed after the timeout', async () => {
  const never = new Promise(() => {});
  await assert.rejects(metaWithTimeout(never, 10), /not loaded within/);
});

test('a meta that settles in time passes through, and its timer is freed', async () => {
  const value = { id: 'a' };
  assert.equal(await metaWithTimeout(Promise.resolve(value), 5000), value);
  assert.equal(await metaWithTimeout(Promise.reject(new Error('boom')), 5000).catch((e) => e.message), 'boom');
});

test('the loader keeps the default timeout of about 8 s', () => {
  assert.equal(META_TIMEOUT_MS, 8000);
});

test('the Cache API is detected on the scope, and its absence is not an error', () => {
  assert.equal(cacheApiAvailable({ caches: { open: () => {} } }), true);
  assert.equal(cacheApiAvailable({}), false);
  assert.equal(cacheApiAvailable({ caches: undefined }), false);
  assert.equal(cacheApiAvailable({ caches: null }), false);
});

test('blocked meta.json: every entry ends with a null meta, one settle per entry', async () => {
  const metas = {};
  const settled = [];
  const attempts = [];

  await loadMetasProgressively(ENTRIES, metas, {
    fetchMeta: (entry) => {
      attempts.push(entry.id);
      return Promise.reject(new TypeError('Failed to fetch'));
    },
    onSettled: (entry) => {
      settled.push(entry.id);
    },
  });

  assert.deepEqual(attempts.sort(), ['a', 'b', 'c']);
  assert.deepEqual(settled.sort(), ['a', 'b', 'c']);
  assert.deepEqual(Object.values(metas), [null, null, null]);
});

test('rows render progressively: each settled meta is reported before the others finish', async () => {
  const metas = {};
  const seenAfterEach = [];
  const pending = {
    a: () => new Promise((resolve) => setTimeout(() => resolve({ id: 'a' }), 30)),
    b: () => Promise.resolve({ id: 'b' }),
    c: () => new Promise((resolve) => setTimeout(() => resolve({ id: 'c' }), 10)),
  };

  await loadMetasProgressively(ENTRIES, metas, {
    fetchMeta: (entry) => pending[entry.id](),
    onSettled: () => {
      seenAfterEach.push(Object.keys(metas).filter((id) => metas[id]));
    },
  });

  assert.deepEqual(seenAfterEach[0], ['b']);
  assert.deepEqual(seenAfterEach[1], ['b', 'c']);
  assert.deepEqual([...seenAfterEach.at(-1)].sort(), ['a', 'b', 'c']);
});
