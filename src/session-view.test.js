import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createSession } from './session.js';
import { buildWave } from './timeline.js';

const DAY = 864e5;
const HW = Date.parse('2026-10-14T12:00:00Z');

function sessionWithLongTide() {
  const session = createSession({
    tidal: true,
    reference: { port: 'Brest', type: 'HW' },
    offsets: Array.from({ length: 25 }, (_, i) => -360 + i * 30),
    timeCount: 25,
    coeffs: [45, 95],
    times: [],
  });

  // 10 days of 10-minute levels around HW, rising to 8 m on day +3 and 6 m elsewhere.
  const levels = Array.from({ length: 10 * 144 + 1 }, (_, i) => {
    const t = HW - 5 * DAY + i * 600e3;
    const peak = Math.abs(t - (HW + 3 * DAY)) < DAY / 2 ? 8 : 6;
    return { t, h: peak * (0.5 + 0.5 * Math.cos((2 * Math.PI * (t - HW)) / (12.42 * 3600e3))) };
  });

  session.setTide({ events: [{ at: new Date(HW), coef: 70 }], extrema: [], levels });
  return session;
}

const windowAround = (center) => ({
  startMs: center - 2 * DAY,
  endMs: center + 2 * DAY,
  stepMinutes: 5,
  offsetMinutes: 0,
});

test('the marker is in the middle of the window', () => {
  const session = sessionWithLongTide();
  const snap = session.snapshotAt(HW, windowAround(HW));

  assert.equal(snap.cursor.x, 50);
  assert.equal(snap.clockLabel, 'Wed 14/10/2026 12:00 GMT');
  assert.notEqual(snap.heightLabel, '');
});

test('the curve keeps its height scale while the window moves', () => {
  const session = sessionWithLongTide();

  const early = session.snapshotAt(HW, windowAround(HW)).wave;
  const late = session.snapshotAt(HW + 3 * DAY, windowAround(HW + 3 * DAY)).wave;

  assert.equal(early.min, late.min);
  assert.equal(early.max, late.max);
  assert.ok(early.max > 7.9, 'the scale covers the higher tides of later days');
});

test('without a scale the curve follows the visible heights', () => {
  const levels = [
    { t: 0, h: 1 },
    { t: 600e3, h: 3 },
    { t: 1200e3, h: 2 },
  ];

  const wave = buildWave(levels, [], 0, 1200e3);
  assert.equal(wave.min, 1);
  assert.equal(wave.max, 3);

  const scaled = buildWave(levels, [], 0, 1200e3, 0, { min: 0, max: 10 });
  assert.equal(scaled.min, 0);
  assert.equal(scaled.max, 10);
});
