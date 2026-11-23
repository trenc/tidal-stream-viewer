import assert from 'node:assert/strict';
import { test } from 'node:test';

import { planBlend } from './tide-plan.js';

test('equal coefficients blend to a finite zero weight', () => {
  assert.equal(planBlend([70, 70], 70).weight, 0);
  assert.ok(Number.isFinite(planBlend([70, 70], 70).weight));
});

test('equal coefficients with another coefficient stay finite, not Infinity', () => {
  assert.ok(Number.isFinite(planBlend([70, 70], 90).weight));
});

test('equal coefficients with an unknown coefficient use the fallback and stay finite', () => {
  const blend = planBlend([70, 70, 70], NaN);
  assert.ok(Number.isFinite(blend.weight));
});

test('distinct coefficients blend the way they always did', () => {
  const blend = planBlend([40, 100], 70);
  assert.equal(blend.low, 0);
  assert.equal(blend.high, 1);
  assert.equal(blend.weight, 0.5);
});

test('an empty or single-element array returns the untouched zero blend', () => {
  assert.deepEqual(planBlend([], 70), { low: 0, high: 0, weight: 0 });
  assert.deepEqual(planBlend([70], 70), { low: 0, high: 0, weight: 0 });
});