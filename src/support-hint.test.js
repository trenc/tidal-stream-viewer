import assert from 'node:assert/strict';
import { test } from 'node:test';

import { QUIET_DAYS, SHOW_AFTER_DAYS, dismissHint, recordVisit, shouldShowHint } from './support-hint.js';

const DAY = 864e5;
const START = Date.parse('2026-10-14T09:00:00Z');

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
  };
}

function useOnDays(storage, count) {
  for (let i = 0; i < count; i++) recordVisit(storage, START + i * DAY);
}

test('opening the app several times on one day counts once', () => {
  const storage = memoryStorage();

  recordVisit(storage, START);
  recordVisit(storage, START + 3600e3);
  assert.equal(recordVisit(storage, START + 7200e3), 1);
});

test('the hint appears only after the app was used on enough different days', () => {
  const storage = memoryStorage();

  useOnDays(storage, SHOW_AFTER_DAYS - 1);
  assert.equal(shouldShowHint(storage, START + 10 * DAY), false);

  recordVisit(storage, START + (SHOW_AFTER_DAYS - 1) * DAY);
  assert.equal(shouldShowHint(storage, START + (SHOW_AFTER_DAYS - 1) * DAY), true);
});

test('a dismissed hint stays away for the quiet period, then may return', () => {
  const storage = memoryStorage();
  useOnDays(storage, SHOW_AFTER_DAYS);

  const dismissedAt = START + 10 * DAY;
  dismissHint(storage, dismissedAt);

  assert.equal(shouldShowHint(storage, dismissedAt + 1000), false);
  assert.equal(shouldShowHint(storage, dismissedAt + (QUIET_DAYS - 1) * DAY), false);
  assert.equal(shouldShowHint(storage, dismissedAt + (QUIET_DAYS + 1) * DAY), true);
});
