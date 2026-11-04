import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  OFFSET_OPTIONS,
  browserOffset,
  dayLabel,
  formatClock,
  formatDateTime,
  gmtLabel,
  nearestOffset,
  parseDateTime,
} from './clock.js';
import { createSession } from './session.js';
import { buildAxis } from './timeline.js';

test('parses dd/mm/yyyy hh:mm in the chosen offset', () => {
  assert.equal(parseDateTime('08/10/2026 12:30', 120), Date.UTC(2026, 9, 8, 10, 30));
  assert.equal(parseDateTime('08/10/2026 12:30', -330), Date.UTC(2026, 9, 8, 18, 0));
  assert.equal(parseDateTime('8/10/2026', 0), Date.UTC(2026, 9, 8, 0, 0));
});

test('dots work as separators too', () => {
  assert.equal(parseDateTime('08.10.2026 12:30', 120), parseDateTime('08/10/2026 12:30', 120));
});

test('rejects malformed and impossible dates', () => {
  for (const text of ['31/02/2026 10:00', '2026-10-08', '08/10/2026 25:00', '08/13/2026', '08/10/2026 10:60', '']) {
    assert.ok(Number.isNaN(parseDateTime(text, 0)), text);
  }
});

test('formats back to the same text', () => {
  const ms = parseDateTime('08/10/2026 12:30', 120);
  assert.equal(formatDateTime(ms, 120), '08/10/2026 12:30');
  assert.equal(formatDateTime(ms, 0), '08/10/2026 10:30');
});

test('labels offsets and builds the clock string in English by default', () => {
  assert.equal(gmtLabel(0), 'GMT');
  assert.equal(gmtLabel(120), 'GMT+2');
  assert.equal(gmtLabel(-210), 'GMT-3:30');
  assert.equal(gmtLabel(345), 'GMT+5:45');
  assert.equal(formatClock(Date.UTC(2026, 9, 8, 10, 30), 120), 'Thu 08/10/2026 12:30 GMT+2');
});

test('weekday names follow the language', () => {
  const ms = Date.UTC(2026, 9, 8, 10, 30);

  assert.ok(formatClock(ms, 120, 'fr').startsWith('jeu'));
  assert.ok(formatClock(ms, 120, 'de').startsWith('Do'));
  assert.ok(dayLabel(ms, 120, 'fr').startsWith('jeu'));
  assert.ok(dayLabel(ms, 120, 'de').endsWith('08/10'));
});

test('nearestOffset snaps to a listed zone', () => {
  assert.equal(nearestOffset(125), 120);
  assert.ok(OFFSET_OPTIONS.some((option) => option.minutes === 345));
});

test('a corrupted stored value falls back to the browser zone, not to the first option', () => {
  assert.ok(nearestOffset(NaN) === browserOffset());
  assert.ok(nearestOffset(NaN) !== -720);
});

test('day separators fall on midnight of the chosen offset', () => {
  const start = parseDateTime('08/10/2026 12:00', 120);
  const days = buildAxis(start, start + 48 * 3600e3, 120);

  assert.deepEqual(days.map((day) => day.label), ['Fri 09/10', 'Sat 10/10']);
  assert.deepEqual(days.map((day) => day.x), [25, 75]);
});

test('the session shows times in the chosen offset', () => {
  const HW = Date.parse('2026-10-08T12:00:00Z');
  const window = { startMs: HW, endMs: HW + 5 * 24 * 3600e3, stepMinutes: 30, offsetMinutes: 120 };
  const session = createSession({
    tidal: true,
    reference: { port: 'Concarneau', type: 'HW' },
    offsets: Array.from({ length: 25 }, (_, i) => -360 + i * 30),
    timeCount: 25,
    coeffs: [45, 95],
    times: [],
  });
  session.setTide({ events: [{ at: new Date(HW), coef: 70 }], extrema: [], levels: [] }, window);

  const snap = session.snapshot(0, window);
  assert.equal(snap.clockLabel, 'Thu 08/10/2026 14:00 GMT+2');
  assert.match(snap.detail, /HW Concarneau 14:00/);
});
