import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SPEED_LEGEND, speedColour, speedFraction } from './speed-scale.js';

const KN = 1 / 1.943844;

test('stop colours are the same for every atlas', () => {
  assert.equal(speedColour(0), 'rgb(96, 165, 250)');
  assert.equal(speedColour(1 * KN), 'rgb(34, 211, 238)');
  assert.equal(speedColour(2 * KN), 'rgb(74, 222, 128)');
  assert.equal(speedColour(4 * KN), 'rgb(250, 204, 21)');
  assert.equal(speedColour(6 * KN), 'rgb(248, 113, 113)');
});

test('speeds above the scale keep the top colour and full arrow length', () => {
  assert.equal(speedColour(20), 'rgb(248, 113, 113)');
  assert.equal(speedFraction(20), 1);
});

test('arrow length fraction grows linearly with speed in knots', () => {
  assert.equal(speedFraction(0), 0);
  assert.ok(Math.abs(speedFraction(3 * KN) - 0.5) < 1e-9);
});

test('legend ticks and gradient come from the same stops', () => {
  assert.deepEqual(SPEED_LEGEND.ticks.map((tick) => tick.label), ['0', '1', '2', '4', '6+']);
  assert.equal(SPEED_LEGEND.ticks[0].left, 0);
  assert.equal(SPEED_LEGEND.ticks[4].left, 100);
  assert.ok(SPEED_LEGEND.gradient.startsWith('linear-gradient(to right, rgb(96,165,250) 0.0%'));
});
