import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MS_TO_KNOTS, arrowLengthPx, speedColour } from './speed-scale.js';
import { legendSteps } from './speed-legend.js';

test('the default legend has five readable ticks from 0 to the maximum', () => {
  const steps = legendSteps(6);

  assert.deepEqual(steps.map((step) => step.knots), [0, 1.5, 3, 5, 6]);
  assert.deepEqual(steps.map((step) => step.lengthPx), [10, 17.5, 25, 35, 40]);
});

test('a custom count is honoured', () => {
  assert.deepEqual(legendSteps(6, 4).map((step) => step.knots), [0, 2, 4, 6]);
});

test('a tiny maximum still gives a readable legend', () => {
  assert.deepEqual(legendSteps(0.2).map((step) => step.knots), [0, 0.5, 1]);
});

test('a zero or non-finite maximum falls back to the minimum', () => {
  for (const max of [0, -3, NaN, Infinity]) {
    assert.deepEqual(legendSteps(max).map((step) => step.knots), [0, 0.5, 1], `max ${max}`);
  }
});

test('ticks ascend strictly and never repeat', () => {
  for (const max of [0.4, 1, 2.5, 3.7, 6, 12]) {
    const knots = legendSteps(max).map((step) => step.knots);

    for (let i = 1; i < knots.length; i++) {
      assert.ok(knots[i] > knots[i - 1], `max ${max}: ${knots}`);
    }
  }
});

test('colours and lengths are those of the arrows on the map', () => {
  for (const step of legendSteps(6)) {
    const speedMs = step.knots / MS_TO_KNOTS;

    assert.equal(step.colour, speedColour(speedMs));
    assert.equal(step.lengthPx, arrowLengthPx(speedMs));
  }
});
