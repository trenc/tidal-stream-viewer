import assert from 'node:assert/strict';
import { test } from 'node:test';

import { downloadBytes, frameUrl, frameUrls } from './offline-plan.js';

const META = {
  id: 'iroise',
  nx: 2,
  ny: 3,
  nt: 5,
  coeffs: [45, 95],
  frame: 'f_c{c}_t{t}.bin',
  version: '2026/06/10',
  release: '2026/01/01',
};

test('the frame url carries the version', () => {
  assert.equal(frameUrl(META, 0, 3), '/atlas/iroise/f_c0_t3.bin?v=2026/06/10');
});

test('the frame url falls back to the release, then to nothing', () => {
  assert.equal(
    frameUrl({ ...META, version: undefined }, 1, 0),
    '/atlas/iroise/f_c1_t0.bin?v=2026/01/01'
  );
  assert.equal(frameUrl({ ...META, version: undefined, release: undefined }, 1, 0),
    '/atlas/iroise/f_c1_t0.bin?v=');
});

test('the frame url uses the base url of the store', () => {
  assert.equal(frameUrl(META, 0, 0, '/other'), '/other/iroise/f_c0_t0.bin?v=2026/06/10');
});

test('one url per coefficient and time step, coefficients outer, steps inner', () => {
  const urls = frameUrls(META);

  assert.equal(urls.length, META.coeffs.length * META.nt);
  assert.equal(urls[0], frameUrl(META, 0, 0));
  assert.equal(urls[META.nt - 1], frameUrl(META, 0, META.nt - 1));
  assert.equal(urls[META.nt], frameUrl(META, 1, 0));
  assert.equal(urls[urls.length - 1], frameUrl(META, 1, META.nt - 1));
});

test('downloadBytes counts four bytes per cell of every frame', () => {
  assert.equal(downloadBytes(META), 5 * 2 * 2 * 3 * 4);
});
