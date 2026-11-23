import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dataQuality } from './data-quality.js';
import { planBlend } from './tide-plan.js';

const COEFFS = [45, 95];
const blendFor = (coefficient) => planBlend(COEFFS, coefficient).weight;

test('the coefficient at a published case is ordinary, between the cases too', () => {
  const quality = (coefficient, coefAssumed = false) =>
    dataQuality({ weight: blendFor(coefficient), low: 45, high: 95, coefAssumed });

  assert.equal(quality(45), 'ok');
  assert.equal(quality(70), 'ok');
  assert.equal(quality(95), 'ok');
});

test('just outside the published cases is extrapolated', () => {
  const quality = (coefficient) =>
    dataQuality({ weight: blendFor(coefficient), low: 45, high: 95, coefAssumed: false });

  assert.equal(quality(44), 'extrapolated');
  assert.equal(quality(96), 'extrapolated');
});

test('the clamped coefficient limits stay extrapolated, not ordinary', () => {
  const quality = (coefficient) =>
    dataQuality({ weight: blendFor(coefficient), low: 45, high: 95, coefAssumed: false });

  assert.equal(planBlend(COEFFS, 5).weight, -0.5); // 20 after the clamp
  assert.equal(planBlend(COEFFS, 200).weight, 1.5); // 120 after the clamp
  assert.equal(quality(5), 'extrapolated');
  assert.equal(quality(20), 'extrapolated');
  assert.equal(quality(120), 'extrapolated');
  assert.equal(quality(200), 'extrapolated');
});

test('a missing coefficient is assumed, even when the blend would be ordinary', () => {
  const quality = (coefficient, coefAssumed) =>
    dataQuality({ weight: blendFor(coefficient), low: 45, high: 95, coefAssumed });

  assert.equal(quality(70, true), 'assumed');
});

test('assumed wins over extrapolated', () => {
  assert.equal(
    dataQuality({ weight: blendFor(200), low: 45, high: 95, coefAssumed: true }),
    'assumed'
  );
});

test('equal published cases leave nothing to extrapolate against', () => {
  assert.equal(dataQuality({ weight: 0, low: 70, high: 70, coefAssumed: false }), 'ok');
  assert.equal(dataQuality({ weight: 0, low: 70, high: 70, coefAssumed: true }), 'assumed');
});
