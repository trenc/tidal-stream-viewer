import assert from 'node:assert/strict';
import { test } from 'node:test';

import { jumpTarget, nextEvent } from './tide-jump.js';

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

// The marker may move seven days around now; the jump must stay inside.
const limits = { minMs: Date.parse('2026-11-05T10:00Z'), maxMs: Date.parse('2026-11-07T10:00Z') };
const STEP = 60;
const ms = (iso) => Date.parse(iso);

test('a jump lands on the step beyond the event', () => {
  const events = tides().reverse();

  assert.deepEqual(jumpTarget(events, MS, 1, 'high', limits, STEP), {
    at: ms('2026-11-06T21:50Z'),
    targetMs: ms('2026-11-06T22:00Z'),
  });
  assert.deepEqual(jumpTarget(events, MS, -1, 'high', limits, STEP), {
    at: ms('2026-11-06T09:50Z'),
    targetMs: ms('2026-11-06T09:00Z'),
  });
});

test('the step beyond the event lets the next jump find the following one', () => {
  const events = tides().reverse();
  const back = jumpTarget(events, MS, -1, 'high', limits, STEP);

  assert.deepEqual(nextEvent(events, back.targetMs, -1, 'high'), hw('2026-11-05T21:30Z'));
});

test('a jump whose landing step leaves the limits is disabled', () => {
  const events = tides().reverse();
  const tight = { minMs: limits.minMs, maxMs: ms('2026-11-06T21:55Z') };

  // The event itself lies inside, but the landing step would leave the window.
  assert.equal(jumpTarget(events, MS, 1, 'high', tight, STEP), null);
  assert.deepEqual(jumpTarget(events, MS, -1, 'high', tight, STEP), {
    at: ms('2026-11-06T09:50Z'),
    targetMs: ms('2026-11-06T09:00Z'),
  });
});

test('an event outside the limits is no jump target', () => {
  const events = tides().reverse();
  const short = { minMs: limits.minMs, maxMs: MS + 2 * 3600e3 };

  assert.equal(jumpTarget(events, MS, 1, 'high', short, STEP), null);
});

test('without events or without a matching type there is no jump target', () => {
  const events = tides().reverse();
  const onlyHigh = tides().filter((event) => event.type === 'PM');

  assert.equal(jumpTarget([], MS, 1, 'high', limits, STEP), null);
  assert.equal(jumpTarget(onlyHigh, MS, 1, 'low', limits, STEP), null);
});
