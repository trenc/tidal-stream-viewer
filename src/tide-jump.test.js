import assert from 'node:assert/strict';
import { test } from 'node:test';

import { nextEvent } from './tide-jump.js';

const hw = (iso) => ({ type: 'PM', at: new Date(iso), height: 5, coef: 70 });
const lw = (iso) => ({ type: 'BM', at: new Date(iso), height: 1, coef: 70 });

// One tide after the other, covering a cycle that crosses midnight.
const tides = () => [
  lw('2026-11-05T15:20Z'),
  hw('2026-11-05T21:30Z'),
  lw('2026-11-06T03:40Z'),
  hw('2026-11-06T09:50Z'),
  lw('2026-11-06T15:20Z'),
  hw('2026-11-06T21:50Z'),
  lw('2026-11-07T04:00Z'),
];

const MS = Date.parse('2026-11-06T10:00Z');

test('the next high and low water are found among unsorted events', () => {
  const events = tides().reverse();

  assert.deepEqual(nextEvent(events, MS, 1, 'high'), hw('2026-11-06T21:50Z'));
  assert.deepEqual(nextEvent(events, MS, 1, 'low'), lw('2026-11-06T15:20Z'));
  assert.deepEqual(nextEvent(events, MS, -1, 'high'), hw('2026-11-06T09:50Z'));
  assert.deepEqual(nextEvent(events, MS, -1, 'low'), lw('2026-11-06T03:40Z'));
});

test('without a type the next event in either direction is the nearest one', () => {
  const events = tides().reverse();

  assert.deepEqual(nextEvent(events, MS, 1), lw('2026-11-06T15:20Z'));
  assert.deepEqual(nextEvent(events, MS, -1), hw('2026-11-06T09:50Z'));
});

test('an event exactly at the marker time is skipped', () => {
  const events = tides().reverse();
  const atHw = Date.parse('2026-11-06T09:50Z');

  assert.deepEqual(nextEvent(events, atHw, 1, 'high'), hw('2026-11-06T21:50Z'));
  assert.deepEqual(nextEvent(events, atHw, -1, 'high'), hw('2026-11-05T21:30Z'));
});

test('a jump crosses midnight', () => {
  const events = tides().reverse();
  const late = Date.parse('2026-11-06T23:00Z');

  assert.deepEqual(nextEvent(events, late, 1, 'low'), lw('2026-11-07T04:00Z'));
  assert.deepEqual(nextEvent(events, late, -1, 'high'), hw('2026-11-06T21:50Z'));
});

// A DST change shifts the local clock, never UTC. The jump compares UTC milliseconds.
test('a jump across a DST change uses UTC', () => {
  const events = [hw('2026-03-28T13:00Z'), lw('2026-03-28T19:30Z'), hw('2026-03-29T01:10Z')];
  const before = Date.parse('2026-03-28T15:00Z'); // Europe changed clocks the same night
  const after = Date.parse('2026-03-29T05:00Z');

  assert.deepEqual(nextEvent(events, before, 1, 'high'), hw('2026-03-29T01:10Z'));
  assert.deepEqual(nextEvent(events, after, -1, 'low'), lw('2026-03-28T19:30Z'));
});

test('without events there is nothing to jump to', () => {
  assert.equal(nextEvent([], MS, 1, 'high'), null);
  assert.equal(nextEvent([], MS, -1, 'low'), null);
});

test('a type that is missing yields null in both directions', () => {
  const only = tides().filter((event) => event.type === 'PM');

  assert.equal(nextEvent(only, MS, 1, 'low'), null);
  assert.equal(nextEvent(only, MS, -1, 'low'), null);
  assert.deepEqual(nextEvent(only, MS, 1, 'high'), hw('2026-11-06T21:50Z'));
});

test('the input list is left alone', () => {
  const events = tides().reverse();
  const before = events.map((event) => ({ ...event, at: event.at.getTime() }));

  nextEvent(events, MS, 1, 'high');
  nextEvent(events, MS, -1, 'low');
  nextEvent(events, MS, 1);

  assert.deepEqual(
    events.map((event) => ({ ...event, at: event.at.getTime() })),
    before
  );
});
