import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  allBounds,
  boundsOf,
  covering,
  hasCoverage,
} from './atlas-picker.js';

const iroise = { id: 'iroise', label: 'Iroise (560) · 250 m · 5 min', bbox: [47.74, -5.36, 48.7, -4.22], resolutionM: 250 };
const abers = { id: 'abers', label: 'Abers (563) · 500 m · 30 min', bbox: [48.6, -4.22, 50.1, -3.5], resolutionM: 500 };
const wide = { id: 'wide', label: 'Manche (500) · 1000 m · 60 min', bbox: [47, -6, 51, -3], resolutionM: 1000 };
const noBox = { id: 'old', label: 'Old file' };

const entries = [wide, abers, noBox, iroise];

test('entries without a position are ignored', () => {
  assert.equal(hasCoverage(noBox), false);
  assert.equal(hasCoverage(iroise), true);
  assert.ok(!covering(entries, 48.2, -4.8).some((entry) => entry.id === 'old'));
});

test('where atlases overlap, the finest grid comes first, and outside every area there is none', () => {
  assert.deepEqual(covering(entries, 48.2, -4.8).map((entry) => entry.id), ['iroise', 'wide']);
  assert.deepEqual(covering(entries, 48.65, -4.22).map((entry) => entry.id), ['iroise', 'abers', 'wide']);
  assert.deepEqual(covering(entries, 40, 0), []);
});

test('bounds for Leaflet and the box around all atlases', () => {
  assert.deepEqual(boundsOf(abers), [[48.6, -4.22], [50.1, -3.5]]);
  assert.deepEqual(allBounds(entries), [[47, -6], [51, -3]]);
  assert.equal(allBounds([noBox]), null);
});
