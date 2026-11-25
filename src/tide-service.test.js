import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createTideService } from './tide-service.js';
import { TideApiError, addDays } from './tides.js';

const site = { site_id: 'brest', site_name: 'Brest' };
const DAY = 864e5;

const extremum = (type, at, coef) => ({ type, at, coef, height: 5 });

// A tide API that records what it was asked for. found null simulates an
// unknown port; levelsFail makes the height curve request throw.
function fakeApi({ found = site, extrema = [], levels = [], levelsFail = false } = {}) {
  const calls = { port: null, extrema: [], levels: [] };

  return {
    calls,
    TideApiError,
    addDays,
    async findSite(port) {
      calls.port = port;
      return found;
    },
    async fetchExtrema(asked, fromDay, toDay) {
      calls.extrema.push([asked, fromDay, toDay]);
      return { attribution: 'Credit.', statusNotice: 'Notice.', events: extrema };
    },
    async fetchLevels(asked, from, to, stepMinutes) {
      calls.levels.push([asked, from.getTime(), to.getTime(), stepMinutes]);
      if (levelsFail) throw new TideApiError('offline', 'offline');
      return levels;
    },
  };
}

const START = Date.UTC(2026, 10, 6, 10);
const END = Date.UTC(2026, 10, 10, 10);

test('the reference port is looked up and only its wanted waters become events', async () => {
  const api = fakeApi({
    extrema: [
      extremum('PM', new Date('2026-11-06T21:50Z'), 78),
      extremum('BM', new Date('2026-11-07T04:00Z'), null),
    ],
  });

  const data = await createTideService(api).load({ port: 'Brest', type: 'HW' }, START, END, 10);

  assert.equal(api.calls.port, 'Brest');
  assert.equal(data.siteName, 'Brest');
  assert.deepEqual(data.events, [{ at: new Date('2026-11-06T21:50Z'), coef: 78 }]);
  assert.equal(data.events.length, 1);
  // All extrema are kept for the curve markers, whatever their type.
  assert.equal(data.extrema.length, 2);
  assert.equal(data.attribution, 'Credit.');
  assert.equal(data.statusNotice, 'Notice.');
  assert.equal(data.levelsError, null);
});

test('a low-water reference keeps the low waters as events', async () => {
  const api = fakeApi({
    extrema: [extremum('PM', new Date('2026-11-06T21:50Z'), 78), extremum('BM', new Date('2026-11-07T04:00Z'), null)],
  });

  const data = await createTideService(api).load({ port: 'Brest', type: 'LW' }, START, END, 10);

  assert.deepEqual(data.events, [{ at: new Date('2026-11-07T04:00Z'), coef: null }]);
});

test('the extrema cover the window plus a day on each side', async () => {
  const api = fakeApi();

  await createTideService(api).load({ port: 'Brest', type: 'HW' }, START, END, 10);

  assert.deepEqual(api.calls.extrema, [[site, addDays('2026-11-06', -1), addDays('2026-11-10', 1)]]);
});

test('the height curve covers exactly the requested window and step', async () => {
  const api = fakeApi();

  await createTideService(api).load({ port: 'Brest', type: 'HW' }, START, END, 10);

  assert.deepEqual(api.calls.levels, [[site, START, END, 10]]);
});

test('a failed height curve still returns the extrema and reports the failure', async () => {
  const api = fakeApi({
    extrema: [extremum('PM', new Date('2026-11-06T21:50Z'), 78)],
    levelsFail: true,
  });

  const data = await createTideService(api).load({ port: 'Brest', type: 'HW' }, START, END, 10);

  assert.deepEqual(data.levels, []);
  assert.ok(data.levelsError instanceof TideApiError);
  assert.deepEqual(data.events, [{ at: new Date('2026-11-06T21:50Z'), coef: 78 }]);
});

test('a port the API does not know is an error naming the port', async () => {
  const api = fakeApi({ found: null });

  await assert.rejects(
    createTideService(api).load({ port: 'Nowhere', type: 'HW' }, START, END, 10),
    (error) =>
      error instanceof TideApiError &&
      error.code === 'noSite' &&
      error.params.port === 'Nowhere' &&
      /Nowhere/.test(error.message)
  );
});

test('a manual tide is one event and nothing else', () => {
  const at = new Date('2026-11-06T21:50Z');

  assert.deepEqual(createTideService(fakeApi()).manual(at, 78), {
    siteName: '',
    extrema: [],
    events: [{ at, coef: 78 }],
    levels: [],
    attribution: '',
    statusNotice: '',
    levelsError: null,
  });
});

test('a manual tide without a coefficient carries null', () => {
  const at = new Date('2026-11-06T21:50Z');

  assert.deepEqual(createTideService(fakeApi()).manual(at, null).events, [{ at, coef: null }]);
});
