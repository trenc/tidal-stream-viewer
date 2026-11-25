import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createSession } from './session.js';
import { nextEvent } from './tide-jump.js';

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

test('the slider reads the atlas step from the offsets, e.g. 60 minutes', () => {
  const model = tidalModel({
    offsets: Array.from({ length: 13 }, (_, i) => -360 + i * 60),
    timeCount: 13,
  });
  const session = createSession(model);
  assert.deepEqual(session.sliderConfig(5), { stepMinutes: 60, sliderMax: 120 });
});

test('an atlas without a readable step falls back to 60 minutes', () => {
  const session = createSession(tidalModel({ offsets: [-360], timeCount: 1 }));
  assert.deepEqual(session.sliderConfig(5), { stepMinutes: 60, sliderMax: 120 });
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

test('the snapshot classifies a coefficient between the published cases as ordinary', () => {
  const session = sessionWith([{ at: new Date(HW), coef: 70 }]);
  assert.equal(session.snapshot(0, windowAt(HW)).quality, 'ok');
});

test('the snapshot classifies a coefficient beyond the published cases as extrapolated', () => {
  const session = sessionWith([{ at: new Date(HW), coef: 96 }]);
  assert.equal(session.snapshot(0, windowAt(HW)).quality, 'extrapolated');
});

test('the snapshot classifies an unknown coefficient as assumed', () => {
  const session = sessionWith([{ at: new Date(HW), coef: null }]);
  assert.equal(session.snapshot(0, windowAt(HW)).quality, 'assumed');
});

test('while waiting for tide times the snapshot carries no quality', () => {
  const session = createSession(tidalModel());
  assert.equal('quality' in session.snapshot(0, windowAt(HW)), false);
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

test('a series without a time axis says so, one with times shows plain UTC', () => {
  const window = { startMs: 0, endMs: 1000, stepMinutes: 30 };
  const base = { tidal: false, offsets: [], timeCount: 1, coeffs: [45, 95], reference: null };

  const empty = createSession({ ...base, times: [] });
  assert.equal(empty.snapshot(0, window).clockLabel, 'No time axis');

  const dated = createSession({ ...base, times: [new Date('2026-11-06T10:00:00Z')] });
  assert.equal(dated.snapshot(0, window).clockLabel, '2026-11-06 10:00Z');
});

test('drawAt gives the same draw as snapshotAt for several times', () => {
  const session = sessionWith([{ at: new Date(HW), coef: 70 }]);
  const times = [HW - 8 * HOUR, HW, HW + 3 * HOUR, HW + 20 * HOUR];

  for (const ms of times) {
    assert.deepEqual(session.drawAt(ms), session.snapshotAt(ms, windowAt(ms)).draw, String(ms));
  }
});

test('drawAt does not change the wave', () => {
  const levels = Array.from({ length: 13 }, (_, i) => ({ t: HW + i * 600e3, h: 2 + i * 0.5 }));
  const session = sessionWith([{ at: new Date(HW), coef: 70 }], levels);
  const wave = session.wave;

  session.drawAt(HW + 3 * HOUR);

  assert.equal(session.wave, wave);
});

test('a time far outside the atlas offsets gives the clamped edge frame', () => {
  const session = sessionWith([{ at: new Date(HW), coef: 70 }]);

  assert.deepEqual(session.drawAt(HW + 24 * HOUR), {
    frame: 24,
    low: 0,
    high: 1,
    weight: 0.5,
  });
});

test('without tide times drawAt has nothing to draw', () => {
  assert.equal(createSession(tidalModel()).drawAt(HW), null);
});

test('clearTide removes tide data and the wave', () => {
  const levels = Array.from({ length: 13 }, (_, i) => ({ t: HW + i * 600e3, h: 2 + i * 0.5 }));
  const session = sessionWith([{ at: new Date(HW), coef: 70 }], levels);

  assert.notEqual(session.wave, null);
  session.clearTide();

  assert.equal(session.wave, null);
  assert.equal(session.snapshot(0, windowAt(HW)).draw, null);
});

test('the session hands out the reference extrema for reading', () => {
  const extrema = [
    { type: 'PM', at: new Date(HW), height: 5.2, coef: 70 },
    { type: 'BM', at: new Date(HW + 6 * HOUR), height: 1.1, coef: 70 },
  ];
  const session = createSession(tidalModel());
  assert.deepEqual(session.tideExtrema, []);

  session.setTide({ events: [], extrema, levels: [] }, windowAt(HW));
  assert.deepEqual(session.tideExtrema, extrema);

  // Reading them to find a jump target leaves the session's list alone.
  nextEvent(session.tideExtrema, HW, 1, 'low');
  assert.deepEqual(session.tideExtrema, extrema);
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
  // Hourly frames: the step is read from the real times, not assumed.
  assert.equal(session.sliderConfig(5).stepMinutes, 60);

  const snap = session.snapshot(1, {});
  assert.equal(snap.draw.frame, 1);
  assert.equal(snap.clockLabel, '2026-10-08 01:00Z');
});

test('a non-tidal series without times falls back to 60 minutes', () => {
  const session = createSession({
    tidal: false,
    reference: null,
    times: [null],
    timeCount: 1,
    coeffs: [],
  });

  assert.deepEqual(session.sliderConfig(5), { stepMinutes: 60, sliderMax: 0 });
});

test('the session reports whether tide data has arrived', () => {
  const session = createSession(tidalModel());
  assert.equal(session.hasTide, false);

  session.setTide({ events: [], extrema: [], levels: [] }, windowAt(HW));
  assert.equal(session.hasTide, false, 'no events is no tide');

  session.setTide({ events: [{ at: new Date(HW), coef: 70 }], extrema: [], levels: [] }, windowAt(HW));
  assert.equal(session.hasTide, true);
});
