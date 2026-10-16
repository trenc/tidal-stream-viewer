import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createI18n } from './i18n.js';
import { messages } from './locales/index.js';
import { createSession } from './session.js';
import { buildWave } from './timeline.js';

const DAY = 864e5;
const HW = Date.parse('2026-10-14T12:00:00Z');

function sessionWithLongTide(options) {
  const session = createSession(
    {
      tidal: true,
      reference: { port: 'Brest', type: 'HW' },
      offsets: Array.from({ length: 25 }, (_, i) => -360 + i * 30),
      timeCount: 25,
      coeffs: [45, 95],
      times: [],
    },
    options
  );

  const levels = Array.from({ length: 10 * 144 + 1 }, (_, i) => {
    const t = HW - 5 * DAY + i * 600e3;
    const peak = Math.abs(t - (HW + 3 * DAY)) < DAY / 2 ? 8 : 6;
    return { t, h: peak * (0.5 + 0.5 * Math.cos((2 * Math.PI * (t - HW)) / (12.42 * 3600e3))) };
  });

  session.setTide(
    {
      events: [{ at: new Date(HW), coef: 70 }],
      extrema: [{ at: new Date(HW + 3600e3), type: 'PM', height: 6.1, coef: 70 }],
      levels,
    },
    undefined
  );
  return session;
}

const windowAround = (center) => ({
  startMs: center - 2 * DAY,
  endMs: center + 2 * DAY,
  stepMinutes: 5,
  offsetMinutes: 0,
});

function i18nFor(code) {
  const data = new Map([['ui.language', code]]);
  return createI18n({ messages, storage: { getItem: (k) => data.get(k) ?? null, setItem: () => {} }, preferred: [] });
}

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

test('texts and numbers follow the language of the session', () => {
  const english = sessionWithLongTide({ i18n: i18nFor('en') }).snapshotAt(HW, windowAround(HW));
  const french = sessionWithLongTide({ i18n: i18nFor('fr') }).snapshotAt(HW, windowAround(HW));
  const german = sessionWithLongTide({ i18n: i18nFor('de') }).snapshotAt(HW, windowAround(HW));

  assert.match(english.nextLabel, /^Next HW \d\d:\d\d · 6\.10 m$/);
  assert.match(french.nextLabel, /^Prochaine PM \d\d:\d\d · 6,10 m$/);
  assert.match(german.nextLabel, /^Nächstes HW \d\d:\d\d · 6,10 m$/);

  assert.match(english.detail, /^HW Brest /);
  assert.match(french.detail, /^PM Brest /);
  assert.match(french.detail, /coef\. 70/);
  assert.match(german.detail, /Koeff\. 70/);
});

test('the language can change while the session lives', () => {
  const i18n = i18nFor('en');
  const session = sessionWithLongTide({ i18n });

  assert.match(session.snapshotAt(HW, windowAround(HW)).detail, /^HW Brest/);
  i18n.set('de');
  assert.match(session.snapshotAt(HW, windowAround(HW)).detail, /^HW Brest/);
  i18n.set('fr');
  assert.match(session.snapshotAt(HW, windowAround(HW)).detail, /^PM Brest/);
  assert.equal(session.referenceName, 'PM Brest');
});
