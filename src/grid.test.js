import assert from 'node:assert/strict';
import { test } from 'node:test';

import { curvilinearCell, regularCell } from './grid.js';

const LATS = [48, 48.1, 48.2];
const LONS = [-5, -4.9, -4.8];

test('a point on a grid cell returns that cell', () => {
  assert.deepEqual(regularCell(48.1, -4.9, LATS, LONS), { y: 1, x: 1 });
});

test('a point between cells returns the nearest one', () => {
  assert.deepEqual(regularCell(48.16, -4.86, LATS, LONS), { y: 2, x: 1 });
});

test('half a cell beyond the edge still returns the edge cell', () => {
  assert.deepEqual(regularCell(48.2, -4.8, LATS, LONS), { y: 2, x: 2 });
  assert.deepEqual(regularCell(48.25, -4.75, LATS, LONS), { y: 2, x: 2 });
  assert.deepEqual(regularCell(47.95, -5.05, LATS, LONS), { y: 0, x: 0 });
});

test('more than half a cell outside the grid returns null', () => {
  assert.equal(regularCell(48.26, -4.9, LATS, LONS), null);
  assert.equal(regularCell(48.1, -5.06, LATS, LONS), null);
  assert.equal(regularCell(49, -4.9, LATS, LONS), null);
});

test('descending latitudes are handled like ascending ones', () => {
  const lats = [48.2, 48.1, 48.0, 47.9];

  assert.deepEqual(regularCell(48.16, -4.9, lats, LONS), { y: 0, x: 1 });
  assert.deepEqual(regularCell(48.14, -4.9, lats, LONS), { y: 1, x: 1 });
  assert.deepEqual(regularCell(47.85, -4.9, lats, LONS), { y: 3, x: 1 });
  assert.equal(regularCell(48.26, -4.9, lats, LONS), null);
});

test('non-finite input or an empty axis gives null', () => {
  assert.equal(regularCell(Number.NaN, -4.9, LATS, LONS), null);
  assert.equal(regularCell(48.1, Infinity, LATS, LONS), null);
  assert.equal(regularCell(48.1, -4.9, [], LONS), null);
});

test('a curvilinear grid returns the nearest cell inside its bounding box', () => {
  const lat = [
    [48, 48.1],
    [48.2, 48.3],
  ];
  const lon = [
    [-5, -4.9],
    [-4.8, -4.7],
  ];
  const latAt = (y, x) => lat[y][x];
  const lonAt = (y, x) => lon[y][x];

  assert.deepEqual(curvilinearCell(48.21, -4.79, 2, 2, latAt, lonAt), { y: 1, x: 0 });
  assert.equal(curvilinearCell(48.5, -4.8, 2, 2, latAt, lonAt), null);
});
