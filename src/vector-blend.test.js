import assert from 'node:assert/strict';
import { test } from 'node:test';

import { blendedVector } from './vector-blend.js';

function modelWith(first, second, calls = []) {
  return {
    vectorAt(_frame, _depth, coefficient) {
      calls.push(coefficient);
      return coefficient === 0 ? first : second;
    },
  };
}

const options = (weight, low = 0, high = 1) => ({ frame: 2, depth: 1, low, high, weight });

test('weight 0, 0.5 and 1 blend the two coefficient cases', () => {
  const model = modelWith([1, 2], [3, 4]);

  assert.deepEqual(blendedVector(model, options(0), 0, 0), [1, 2]);
  assert.deepEqual(blendedVector(model, options(0.5), 0, 0), [2, 3]);
  assert.deepEqual(blendedVector(model, options(1), 0, 0), [3, 4]);
});

test('equal extremes return the first vector without reading the second', () => {
  const calls = [];
  const model = modelWith([5, 6], [7, 8], calls);
  const vector = blendedVector(model, options(0.5, 0, 0), 0, 0);

  assert.deepEqual(vector, [5, 6]);
  assert.ok(vector.every(Number.isFinite));
  assert.deepEqual(calls, [0]);
});

test('a missing vector on either side gives no vector', () => {
  assert.equal(blendedVector(modelWith(null, [1, 2]), options(0.5), 0, 0), null);
  assert.equal(blendedVector(modelWith([1, 2], null), options(0.5), 0, 0), null);
});

test('a non-finite weight gives no vector', () => {
  const model = modelWith([1, 2], [3, 4]);

  for (const weight of [Number.NaN, Infinity, -Infinity]) {
    assert.equal(blendedVector(model, options(weight), 0, 0), null, String(weight));
  }
});
