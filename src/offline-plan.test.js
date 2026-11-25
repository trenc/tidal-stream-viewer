import assert from 'node:assert/strict';
import { test } from 'node:test';

import { downloadBytes, frameUrl, frameUrls, obsoleteFrameKeys } from './offline-plan.js';

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

const VERSIONS = { iroise: '2026/06/10', roscoff: '2025/12/10' };
const key = (id, version) => `/atlas/${id}/f_c0_t0.bin${version ? `?v=${version}` : ''}`;

test('a frame key of an older version is obsolete', () => {
  assert.deepEqual(obsoleteFrameKeys([key('iroise', '2025/06/10')], VERSIONS), [
    key('iroise', '2025/06/10'),
  ]);
});

test('a frame key of the current version stays, a key without a version is obsolete', () => {
  const keys = [key('iroise', '2026/06/10'), key('roscoff'), '/atlas/other/f_c0_t0.bin?v=1'];

  assert.deepEqual(obsoleteFrameKeys(keys, { ...VERSIONS, other: '1' }), [key('roscoff')]);
});

test('unknown atlas ids and non-atlas urls are ignored', () => {
  const keys = [
    key('unknown', 'old'),
    '/atlas/index.json?v=1',
    'https://a.tile.openstreetmap.org/6/33/21.png',
  ];

  assert.deepEqual(obsoleteFrameKeys(keys, VERSIONS), []);
});

test('accepts cache Request objects and returns them unchanged', () => {
  const request = { url: `https://tides.example${key('iroise', 'old')}` };
  const keys = [request, { url: `https://tides.example${key('iroise', VERSIONS.iroise)}` }];

  assert.deepEqual(obsoleteFrameKeys(keys, VERSIONS), [request]);
});

test('malformed keys and empty input give nothing', () => {
  assert.deepEqual(obsoleteFrameKeys(['::_not a url', null, { no: 'url' }], VERSIONS), []);
  assert.deepEqual(obsoleteFrameKeys([], VERSIONS), []);
  assert.deepEqual(obsoleteFrameKeys(null, VERSIONS), []);
  assert.deepEqual(obsoleteFrameKeys([key('iroise', 'old')], {}), []);
});

