import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DAY_MS,
  clampAndSnap,
  dataRange,
  dragCenter,
  keyboardMinutes,
  limitsAround,
  shadeOf,
  wheelDelta,
} from './navigation.js';

const NOW = Date.UTC(2026, 9, 14, 8, 22);

test('the marker may go 7 days either side of now', () => {
  assert.deepEqual(limitsAround(NOW), { minMs: NOW - 7 * DAY_MS, maxMs: NOW + 7 * DAY_MS });
});

test('tide data is needed 2 days beyond the limits, because the view shows them', () => {
  const range = dataRange(limitsAround(NOW));
  assert.equal(range.startMs, NOW - 9 * DAY_MS);
  assert.equal(range.endMs, NOW + 9 * DAY_MS);
});

test('the marker snaps to the atlas step and stops at the limits', () => {
  const limits = limitsAround(NOW);
  const step = 5 * 60000;

  assert.equal(clampAndSnap(NOW + 123456, limits, 5) % step, 0);
  assert.ok(clampAndSnap(NOW + 30 * DAY_MS, limits, 5) <= limits.maxMs);
  assert.ok(clampAndSnap(NOW - 30 * DAY_MS, limits, 5) >= limits.minMs);
  assert.equal(clampAndSnap(NOW + 30 * DAY_MS, limits, 30) % (30 * 60000), 0);
});

test('dragging right moves to an earlier time, across the whole width for 4 days', () => {
  assert.equal(dragCenter(NOW, 100, 800), NOW - 0.125 * 4 * DAY_MS);
  assert.equal(dragCenter(NOW, -800, 800), NOW + 4 * DAY_MS);
});

test('wheel and keys move in the expected directions and sizes', () => {
  assert.ok(wheelDelta(0, 100, 800) > 0);
  assert.ok(wheelDelta(0, -100, 800) < 0);

  assert.equal(keyboardMinutes('ArrowRight', false, 5), 5);
  assert.equal(keyboardMinutes('ArrowLeft', false, 30), -30);
  assert.equal(keyboardMinutes('ArrowRight', true, 5), 60);
  assert.equal(keyboardMinutes('PageDown', false, 5), 720);
  assert.equal(keyboardMinutes('PageUp', false, 5), -720);
  assert.equal(keyboardMinutes('x', false, 5), null);
});

test('the area beyond the limits is shaded only when the view reaches it', () => {
  const limits = limitsAround(NOW);

  assert.deepEqual(shadeOf(NOW, limits), { left: 0, right: 0 });

  const atEnd = shadeOf(limits.maxMs, limits);
  assert.equal(atEnd.left, 0);
  assert.equal(atEnd.right, 50);

  const atStart = shadeOf(limits.minMs, limits);
  assert.equal(atStart.left, 50);
  assert.equal(atStart.right, 0);
});
