import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatReleaseDate } from './release-date.js';

test('formats the release dates found in SHOM files as dd/mm/yyyy', () => {
  assert.equal(formatReleaseDate('2026/06/10'), '10/06/2026');
  assert.equal(formatReleaseDate('20251209'), '09/12/2025');
});

test('returns an empty string when there is no usable date', () => {
  assert.equal(formatReleaseDate(''), '');
  assert.equal(formatReleaseDate(undefined), '');
  assert.equal(formatReleaseDate('last spring'), '');
});
