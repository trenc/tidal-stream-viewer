import assert from 'node:assert/strict';
import { test } from 'node:test';

import { clampAndSnap, limitsAround } from './navigation.js';
import { buildHash, hashAction, parseHash } from './url-state.js';

const MS = Date.UTC(2026, 10, 23, 11, 30);
const FULL = { atlas: 'iroise', lat: 48.3904, lon: -4.4861, zoom: 10, ms: MS };

test('a full state round-trips', () => {
  const hash = buildHash(FULL);

  assert.equal(hash, '#a=iroise&lat=48.3904&lon=-4.4861&zoom=10&t=2026-11-23T11:30Z');
  assert.deepEqual(parseHash(hash), FULL);
});

test('garbage values give an empty state', () => {
  assert.deepEqual(parseHash('#a=../etc&lat=nope&lon=200&zoom=99&t=not-a-time'), {});
});

test('valid parts survive when the others are invalid', () => {
  assert.deepEqual(parseHash('#a=iroise&lat=48.39&lon=200&zoom=9&t=nope'), {
    atlas: 'iroise',
    zoom: 9,
  });
});

test('an empty hash gives an empty state', () => {
  assert.deepEqual(parseHash(''), {});
  assert.deepEqual(parseHash('#'), {});
  assert.deepEqual(parseHash(null), {});
});

test('a latitude without a longitude is ignored, and the other way round', () => {
  assert.deepEqual(parseHash('#lat=48.3&zoom=10'), { zoom: 10 });
  assert.deepEqual(parseHash('#lon=-4.5'), {});
  assert.equal(buildHash({ lat: 48.3 }), '#');
  assert.equal(buildHash({ lon: -4.5 }), '#');
});

test('an atlas id with unsafe characters is rejected', () => {
  assert.deepEqual(parseHash('#a=iroise%2F..%2Fetc&zoom=10'), { zoom: 10 });
  assert.deepEqual(parseHash('#a=bad%20id'), {});
  assert.equal(buildHash({ atlas: 'bad id' }), '#');
  assert.equal(buildHash({ atlas: 'x'.repeat(81) }), '#');
});

test('zero values are kept, not treated as missing', () => {
  const state = { atlas: 'iroise', lat: 0, lon: 0, zoom: 0, ms: 0 };

  assert.equal(buildHash(state), '#a=iroise&lat=0.0000&lon=0.0000&zoom=0&t=1970-01-01T00:00Z');
  assert.deepEqual(parseHash(buildHash(state)), state);
});

test('coordinates, zoom and the atlas id are range-checked', () => {
  assert.deepEqual(parseHash('#lat=90&lon=180&zoom=18'), { lat: 90, lon: 180, zoom: 18 });
  assert.deepEqual(parseHash('#lat=-90&lon=-180&zoom=0'), { lat: -90, lon: -180, zoom: 0 });

  assert.deepEqual(parseHash('#lat=90.0001&lon=180&zoom=18'), { zoom: 18 });
  assert.deepEqual(parseHash('#lat=0&lon=180.0001&zoom=18'), { zoom: 18 });
  assert.deepEqual(parseHash('#zoom=19'), {});
  assert.deepEqual(parseHash('#zoom=-1'), {});
  assert.equal(buildHash({ zoom: 10.5 }), '#');
});

test('a position without a zoom is still written and read', () => {
  const hash = buildHash({ lat: 48.3904, lon: -4.4861 });

  assert.equal(hash, '#lat=48.3904&lon=-4.4861');
  assert.deepEqual(parseHash(hash), { lat: 48.3904, lon: -4.4861 });
});

test('seconds are accepted when reading, but written as whole minutes', () => {
  const withSeconds = Date.UTC(2026, 10, 23, 11, 30, 45);

  assert.deepEqual(parseHash('#t=2026-11-23T11:30:45Z'), { ms: withSeconds });
  assert.equal(buildHash({ ms: withSeconds }), '#t=2026-11-23T11:30Z');
});

test('impossible or non-UTC times are ignored', () => {
  for (const value of [
    '2026-02-31T10:00Z',
    '2026-11-23T25:00Z',
    '2026-11-23T11:60Z',
    '2026-11-23T11:30',
    '2026-11-23 11:30Z',
    'garbage',
  ]) {
    assert.deepEqual(parseHash(`#t=${value}`), {}, value);
  }
});

test('unknown parameters are ignored', () => {
  assert.deepEqual(parseHash('#x=1&zoom=10&foo=bar'), { zoom: 10 });
});

test('the time is written and read as UTC, whatever the time zone', () => {
  const previous = process.env.TZ;
  process.env.TZ = 'Pacific/Kiritimati';

  try {
    assert.equal(buildHash({ ms: MS }), '#t=2026-11-23T11:30Z');
    assert.deepEqual(parseHash('#t=2026-11-23T11:30Z'), { ms: MS });
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test('a hash time just outside the limits is clamped by the existing helper', () => {
  const limits = limitsAround(MS);
  const stepMinutes = 5;

  for (const ms of [limits.maxMs + 60000, limits.minMs - 60000]) {
    const state = parseHash(buildHash({ ms }));
    const clamped = clampAndSnap(state.ms, limits, stepMinutes);

    assert.ok(clamped >= limits.minMs && clamped <= limits.maxMs);
    assert.equal(clamped, ms > limits.maxMs ? limits.maxMs : limits.minMs);
  }
});

test('hashAction sorts a pasted link into ignore, open and move', () => {
  assert.equal(hashAction({}, 'iroise', ['iroise']), 'ignore', 'no atlas in the hash');
  assert.equal(hashAction({ atlas: 'ghost' }, 'iroise', ['iroise']), 'ignore', 'unknown atlas');
  assert.equal(hashAction({ atlas: 'abers' }, 'iroise', ['iroise', 'abers']), 'open');
  assert.equal(hashAction({ atlas: 'iroise' }, 'iroise', ['iroise']), 'move');
  assert.equal(hashAction({ atlas: 'iroise' }, '', ['iroise']), 'open', 'no atlas open yet');
});
