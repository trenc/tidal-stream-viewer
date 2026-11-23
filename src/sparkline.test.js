import assert from 'node:assert/strict';
import { test } from 'node:test';

import { markerX, sparklinePath } from './sparkline.js';

test('a flat curve spans the width halfway up', () => {
  assert.equal(
    sparklinePath([3, 3, 3], 100, 20),
    'M0.0 10.0 L50.0 10.0 L100.0 10.0'
  );
});

test('values are spread over width and height', () => {
  assert.equal(
    sparklinePath([0, 5, 10], 100, 20),
    'M0.0 20.0 L50.0 10.0 L100.0 0.0'
  );
});

test('given bounds set the vertical scale', () => {
  assert.equal(
    sparklinePath([0, 5, 10], 100, 20, { min: 0, max: 20 }),
    'M0.0 20.0 L50.0 15.0 L100.0 10.0'
  );
});

test('a null starts a new segment at its own horizontal position', () => {
  assert.equal(
    sparklinePath([0, 10, null, 5, 0], 100, 20, { min: 0, max: 10 }),
    'M0.0 20.0 L25.0 0.0 M75.0 10.0 L100.0 20.0'
  );
});

test('fewer than two finite values give no path', () => {
  assert.equal(sparklinePath([], 100, 20), '');
  assert.equal(sparklinePath([4], 100, 20), '');
  assert.equal(sparklinePath([null, 4, null], 100, 20), '');
});

test('the marker sits at the ends of the curve and in the middle', () => {
  assert.equal(markerX(0, 25, 220), 0);
  assert.equal(markerX(24, 25, 220), 220);
  assert.equal(markerX(12, 25, 220), 110);
});

test('a single value puts the marker at the start', () => {
  assert.equal(markerX(0, 1, 220), 0);
});

test('the marker stays inside the curve when the index is out of range', () => {
  assert.equal(markerX(-3, 25, 220), 0);
  assert.equal(markerX(30, 25, 220), 220);
});
