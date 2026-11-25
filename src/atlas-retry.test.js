import assert from 'node:assert/strict';
import { test } from 'node:test';

import { shouldRetryOnline } from './atlas-retry.js';

test('the online event retries only while the atlas list has failed', () => {
  assert.equal(shouldRetryOnline({ failed: true, retriedOnline: false }), true);
  assert.equal(shouldRetryOnline({ failed: false, retriedOnline: false }), false, 'a loaded list is not retried');
});

test('the online event retries once; after that the retry button is the way', () => {
  assert.equal(shouldRetryOnline({ failed: true, retriedOnline: true }), false);
});
