import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createSession } from './session.js';

const HW = Date.parse('2026-10-08T12:00:00Z');
const HOUR = 3600e3;

function tidalModel(overrides = {}) {
  return {
    tidal: true,
    reference: { port: 'Concarneau', type: 'HW' },
    offsets: Array.from({ length: 25 }, (_, i) => -360 + i * 30),
    timeCount: 25,
    coeffs: [45, 95],
    times: [],
    ...overrides,
  };
}

function windowAt(startMs) {
  return { startMs, endMs: startMs + 5 * 24 * HOUR, stepMinutes: 30 };
}

function sessionWith(events, levels = []) {
  const session = createSession(tidalModel());
  session.setTide({ events, extrema: [], levels }, windowAt(HW));
  return session;
}

test('slider covers 5 days in file-sized steps', () => {
  const session = createSession(tidalModel());
  assert.deepEqual(session.sliderConfig(5), { stepMinutes: 30, sliderMax: 240 });
});

test('at the reference tide the centre frame is used and coefficient 70 blends 50 %', () => {
  const session = sessionWith([{ at: new Date(HW), coef: 70 }]);
  const { draw } = session.snapshot(0, windowAt(HW));

  assert.equal(draw.frame, 12);
  assert.equal(draw.low, 0);
  assert.equal(draw.high, 1);
  assert.equal(draw.weight, 0.5);
});

test('times beyond ±6 h of the nearest tide show the edge frame and say so', () => {
  const session = sessionWith([{ at: new Date(HW), coef: 70 }]);
  const snap = session.snapshot(0, windowAt(HW + 8 * HOUR));

  assert.equal(snap.draw.frame, 24);
  assert.match(snap.detail, /beyond ±6 h/);
});

test('the nearest of several tides is used', () => {
  const secondHw = HW + (12 * 60 + 25) * 60e3;
  const session = sessionWith([
    { at: new Date(HW), coef: 60 },
    { at: new Date(secondHw), coef: 80 },
  ]);

  // 7 h after the first tide is 5 h 25 min before the second: offset -325 → frame 1.
  const snap = session.snapshot(0, windowAt(HW + 7 * HOUR));
  assert.equal(snap.draw.frame, 1);
  assert.equal(snap.draw.weight, (80 - 45) / 50);
});

test('an unknown coefficient assumes 70 and says so', () => {
  const session = sessionWith([{ at: new Date(HW), coef: null }]);
  const snap = session.snapshot(0, windowAt(HW));

  assert.equal(snap.draw.weight, 0.5);
  assert.match(snap.detail, /unknown/);
});

test('height label shows the value and a rising arrow, and the cursor is placed', () => {
  const levels = Array.from({ length: 13 }, (_, i) => ({ t: HW + i * 600e3, h: 2 + i * 0.5 }));
  const session = sessionWith([{ at: new Date(HW), coef: 70 }], levels);
  const snap = session.snapshot(0, windowAt(HW));

  assert.equal(snap.heightLabel, '2.00 m ↑');
  assert.equal(snap.cursor.x, 0);
  assert.notEqual(snap.cursor.y, null);
});

test('without tide times nothing is drawn', () => {
  const session = createSession(tidalModel());
  const snap = session.snapshot(0, windowAt(HW));

  assert.equal(snap.draw, null);
  assert.match(snap.detail, /Waiting/);
});

test('clearTide removes tide data and the wave', () => {
  const levels = Array.from({ length: 13 }, (_, i) => ({ t: HW + i * 600e3, h: 2 + i * 0.5 }));
  const session = sessionWith([{ at: new Date(HW), coef: 70 }], levels);

  assert.notEqual(session.wave, null);
  session.clearTide();

  assert.equal(session.wave, null);
  assert.equal(session.snapshot(0, windowAt(HW)).draw, null);
});

test('a non-tidal series maps the slider index to the frame', () => {
  const session = createSession({
    tidal: false,
    reference: null,
    times: [new Date('2026-10-08T00:00:00Z'), new Date('2026-10-08T01:00:00Z')],
    timeCount: 2,
    coeffs: [],
  });

  assert.equal(session.sliderConfig(5).sliderMax, 1);

  const snap = session.snapshot(1, {});
  assert.equal(snap.draw.frame, 1);
  assert.equal(snap.clockLabel, '2026-10-08 01:00Z');
});
