import assert from 'node:assert/strict';
import { test } from 'node:test';

import { pointPopupPlan } from './point-popup.js';

const current = { speed: 1.0, bearing: 90 };
const series = (n) => Array.from({ length: n }, (_, i) => ({ ms: i, speed: 0.5 }));

test('a fully loaded result shows the current and its curve', () => {
  const plan = pointPopupPlan({
    status: 'ready',
    current,
    series: series(13),
    maxSpeed: 2.5,
  });

  assert.deepEqual(plan, {
    kind: 'current',
    current,
    progress: null,
    curve: { series: series(13), maxSpeed: 2.5 },
  });
});

test('a single-point series is not worth a curve', () => {
  for (const series_ of [series(0), series(1)]) {
    const plan = pointPopupPlan({ status: 'ready', current, series: series_, maxSpeed: 2.5 });

    assert.equal(plan.curve, null);
    assert.equal(plan.progress, null);
  }
});

test('while the curve loads, the current is shown with its progress', () => {
  const plan = pointPopupPlan({ status: 'curve', current, done: 3, total: 9 });

  assert.equal(plan.kind, 'current');
  assert.deepEqual(plan.progress, { done: 3, total: 9 });
  assert.equal(plan.curve, null);
});

test('the bare current keeps the popup at the tapped moment', () => {
  const plan = pointPopupPlan({ status: 'current', current });

  assert.equal(plan.kind, 'current');
  assert.equal(plan.progress, null);
  assert.equal(plan.curve, null);
});

test('every plain status has its own key', () => {
  assert.deepEqual(pointPopupPlan({ status: 'loading' }), { kind: 'note', key: 'busy.framesOne', text: null });
  assert.deepEqual(pointPopupPlan({ status: 'outside' }), { kind: 'note', key: 'point.outside', text: null });
  assert.deepEqual(pointPopupPlan({ status: 'noTide' }), { kind: 'note', key: 'point.noTide', text: null });
  assert.deepEqual(pointPopupPlan({ status: 'land' }), { kind: 'note', key: 'point.land', text: null });
});

test('an error shows its own text, an error without one the generic key', () => {
  assert.deepEqual(pointPopupPlan({ status: 'error', message: 'something failed' }), {
    kind: 'note',
    key: 'point.error',
    text: 'something failed',
  });
  assert.deepEqual(pointPopupPlan({ status: 'error' }), { kind: 'note', key: 'point.error', text: null });
});

test('an unknown status falls back to the generic error', () => {
  assert.deepEqual(pointPopupPlan({ status: 'nonsense' }), { kind: 'note', key: 'point.error', text: null });
});
