import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CHECK_INTERVAL_MS, shouldCheckUpdate } from './app-update.js';

test('the first check always runs', () => {
  assert.equal(shouldCheckUpdate(0, 1000), true);
  assert.equal(shouldCheckUpdate(undefined, 1000), true);
});

test('a check within the hour is skipped', () => {
  assert.equal(shouldCheckUpdate(1000, 1000 + CHECK_INTERVAL_MS - 1), false);
});

test('an hour after the last check it runs again', () => {
  assert.equal(shouldCheckUpdate(1000, 1000 + CHECK_INTERVAL_MS), true);
});

test('a broken last check time counts as never checked', () => {
  assert.equal(shouldCheckUpdate(NaN, 1000), true);
  assert.equal(shouldCheckUpdate(-5, 1000), true);
});

test('a custom interval is honoured', () => {
  assert.equal(shouldCheckUpdate(2000, 2999, 1000), false);
  assert.equal(shouldCheckUpdate(2000, 3000, 1000), true);
});
