import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Msg, errorMessage, explain, msg, offlineFrames, tideLoadStatus, tideStatus } from './messages.js';
import { UnavailableError } from './unavailable-error.js';
import { TideApiError } from './tides.js';

test('a message is a key with values, rendered later', () => {
  const message = msg('status.limited', { days: 7 });

  assert.ok(message instanceof Msg);
  assert.equal(message.key, 'status.limited');
  assert.deepEqual(message.params, { days: 7 });
  assert.deepEqual(msg('status.noTimes').params, {});
});

test('a tide error carries its own key and values', () => {
  const error = new TideApiError('rate limited', 'rateLimited', { minutes: 30 });
  const message = errorMessage(error);

  assert.equal(message.key, 'tideError.rateLimited');
  assert.deepEqual(message.params, { minutes: 30 });
});

test('any other error is shown as raw text', () => {
  const message = errorMessage(new Error('boom'));

  assert.equal(message.key, 'error.raw');
  assert.equal(message.params.text, 'boom');
  assert.equal(errorMessage(new TideApiError('without a code')).params.text, 'without a code');
});

test('an unreadable NetCDF file is explained in plain words', () => {
  for (const message of ['not a valid NetCDF file', 'bad magic number', 'unsupported version']) {
    assert.equal(explain(new Error(message)).key, 'error.unsupported');
  }
  assert.equal(explain(new Error('boom')).key, 'error.raw');
});

test('tide data without a curve is a warning, without times an error, else no status', () => {
  const noCurve = tideStatus({ events: [{ at: new Date() }], levelsError: new Error('offline') });
  assert.equal(noCurve.key, 'status.curveUnavailable');
  assert.equal(noCurve.params.message.key, 'error.raw');

  assert.equal(tideStatus({ events: [] }).key, 'status.noTimes');

  assert.equal(tideStatus({ events: [{ at: new Date() }] }), null);
});

test('a failed tide load maps tide errors and anything else', () => {
  const tide = tideLoadStatus(new TideApiError('no such port', 'noSite', { port: 'Brest' }));
  assert.equal(tide.key, 'tideError.noSite');

  const other = tideLoadStatus(new Error('network down'));
  assert.equal(other.key, 'status.tideFailed');
  assert.equal(other.params.message, 'network down');
});

test('only a fetch failure of the atlas store becomes an offline message', () => {
  const unavailable = new UnavailableError('/atlas/x/meta.json?v=1', new TypeError('Failed to fetch'));

  assert.equal(explain(unavailable).key, 'offline.atlas');
});

test('an unrelated TypeError stays a raw error, even inside explain()', () => {
  const bug = new TypeError('Cannot read properties of null (reading "foo")');

  assert.equal(explain(bug).key, 'error.raw');
  assert.equal(explain(bug).params.text, 'Cannot read properties of null (reading "foo")');
});

test('http, malformed-data and other errors stay distinguishable from offline', () => {
  const http = new Error('Frame f_c0_t0.bin not available (HTTP 404).');
  const malformed = new Error('Frame f.bin has 3 bytes, expected 4. Wrong path or stale file?');

  assert.equal(explain(http).key, 'error.raw');
  assert.equal(explain(malformed).key, 'error.raw');
  assert.equal(explain(new Error('not a valid NetCDF file')).key, 'error.unsupported');
});

test('the offline frames message explains a known partial download', () => {
  assert.equal(offlineFrames('partial').key, 'offline.framesPartial');
  assert.equal(offlineFrames('none').key, 'offline.frames');
  assert.equal(offlineFrames('complete').key, 'offline.frames');
});
