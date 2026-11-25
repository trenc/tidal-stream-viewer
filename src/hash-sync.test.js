import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createHashSync } from './hash-sync.js';

const THROTTLE_MS = 500;

// An atlas open whose answer the test controls.
function deferred() {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

// Settling an open lets the sync continue on the next microtask.
const settles = async (open) => {
  await open.promise;
};

// Every dep records its calls; page stands in for the open atlas, the map and the marker.
function kit({ hash = '', known = ['iroise', 'abers'], current = '' } = {}) {
  const calls = { writes: [], openIds: [], views: [], chooser: 0 };
  const opens = [];
  const page = { hash, current, atlas: null, lat: 0, lon: 0, zoom: 0, ms: null };

  const sync = createHashSync({
    readState: () => ({ atlas: page.atlas, lat: page.lat, lon: page.lon, zoom: page.zoom, ms: page.ms }),
    write: (hashWritten) => calls.writes.push(hashWritten),
    read: () => page.hash,
    knownAtlasIds: () => known,
    currentAtlasId: () => page.current,
    openAtlas: (id) => {
      calls.openIds.push(id);
      const open = deferred();
      opens.push(open);
      return open.promise;
    },
    applyView: (state) => calls.views.push(state),
    showChooser: () => {
      calls.chooser += 1;
    },
    throttleMs: THROTTLE_MS,
  });

  return { sync, calls, opens, page };
}

test('writes are throttled into one trailing write with the latest state', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { sync, calls, page } = kit();
  page.atlas = 'iroise';

  sync.schedule();
  page.lat = 48.5; // the state moves on while the write waits
  sync.schedule();
  sync.schedule();

  assert.deepEqual(calls.writes, [], 'nothing is written inside the window');
  t.mock.timers.tick(THROTTLE_MS);
  assert.deepEqual(calls.writes, ['#a=iroise&lat=48.5000&lon=0.0000&zoom=0']);
});

test('after a write the next window starts fresh', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { sync, calls, page } = kit();
  page.atlas = 'iroise';

  sync.schedule();
  t.mock.timers.tick(THROTTLE_MS);
  assert.equal(calls.writes.length, 1);

  page.zoom = 9;
  sync.schedule();
  t.mock.timers.tick(THROTTLE_MS);
  assert.deepEqual(calls.writes, ['#a=iroise&lat=0.0000&lon=0.0000&zoom=0', '#a=iroise&lat=0.0000&lon=0.0000&zoom=9']);
});

test('nothing is written while no atlas is open', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { sync, calls, page } = kit();
  page.atlas = null;

  sync.schedule();
  t.mock.timers.tick(THROTTLE_MS);
  assert.deepEqual(calls.writes, []);
});

test('nothing is written while a link is being restored', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { sync, calls, opens, page } = kit({ hash: '#a=abers' });
  page.atlas = 'iroise'; // the atlas opened before the link arrived stays on screen

  const booted = sync.boot();
  sync.schedule(); // a render while the linked atlas opens
  t.mock.timers.tick(THROTTLE_MS);
  assert.deepEqual(calls.writes, [], 'the pasted link is not covered up by a write');

  opens[0].resolve(true);
  await booted;

  // The restore itself releases the write with a trailing schedule.
  t.mock.timers.tick(THROTTLE_MS);
  assert.deepEqual(calls.writes, ['#a=iroise&lat=0.0000&lon=0.0000&zoom=0']);
});

test('boot opens the linked atlas and applies its view', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { sync, calls, opens } = kit({ hash: '#a=abers&lat=48.3&lon=-4.5' });

  const booted = sync.boot();
  assert.deepEqual(calls.openIds, ['abers']);
  assert.deepEqual(calls.views, []);

  opens[0].resolve(true);
  await booted;

  assert.deepEqual(calls.views, [{ atlas: 'abers', lat: 48.3, lon: -4.5 }]);
  assert.equal(calls.chooser, 0);
});

test('boot shows the chooser when the link names no atlas or none known', async () => {
  for (const hash of ['#a=ghost', '#lat=48.3&lon=-4.5', '']) {
    const { sync, calls } = kit({ hash });
    await sync.boot();
    assert.equal(calls.chooser, 1, hash);
    assert.deepEqual(calls.openIds, [], hash);
    assert.deepEqual(calls.views, [], hash);
  }
});

test('a hash that names no known atlas is ignored', () => {
  const { sync, calls } = kit({ hash: '#a=ghost&lat=48.3&lon=-4.5' });

  sync.onHashChange();
  assert.deepEqual(calls.openIds, []);
  assert.deepEqual(calls.views, []);
  assert.equal(calls.chooser, 0);
});

test('a linked atlas that fails to open shows the chooser', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { sync, calls, opens } = kit({ hash: '#a=abers&zoom=10' });

  const booted = sync.boot();
  opens[0].resolve(false);
  await booted;

  assert.equal(calls.chooser, 1);
  assert.deepEqual(calls.views, []);
});

test('a link for the atlas already open moves the view without reopening it', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { sync, calls, page } = kit({
    hash: '#a=iroise&lat=48.3&lon=-4.5&zoom=9',
    current: 'iroise',
  });

  sync.onHashChange();
  assert.deepEqual(calls.openIds, []);
  assert.deepEqual(calls.views, [{ atlas: 'iroise', lat: 48.3, lon: -4.5, zoom: 9 }]);
});

test('a link for another atlas opens it', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { sync, calls, page } = kit({ hash: '#a=abers&zoom=10', current: 'iroise' });

  sync.onHashChange();
  assert.deepEqual(calls.openIds, ['abers']);
  assert.deepEqual(calls.views, []);
});

test('when two links are pasted quickly, only the latest open applies and releases', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { sync, calls, opens, page } = kit({ hash: '#a=abers&zoom=11' });

  sync.onHashChange();
  page.hash = '#a=iroise&zoom=12';
  sync.onHashChange();
  assert.deepEqual(calls.openIds, ['abers', 'iroise']);

  // The first open finishes, but the second link has already taken over.
  opens[0].resolve(true);
  await settles(opens[0]);
  assert.deepEqual(calls.views, [], 'the first view is not applied');
  page.atlas = 'abers';
  sync.schedule();
  t.mock.timers.tick(THROTTLE_MS);
  assert.deepEqual(calls.writes, [], 'the restore state is still held by the latest open');

  opens[1].resolve(true);
  await settles(opens[1]);
  assert.deepEqual(calls.views, [{ atlas: 'iroise', zoom: 12 }], 'the latest view is applied');

  // The applied view is what the page now reports, and the write goes through.
  page.atlas = 'iroise';
  page.zoom = 12;
  t.mock.timers.tick(THROTTLE_MS);
  assert.deepEqual(calls.writes, ['#a=iroise&lat=0.0000&lon=0.0000&zoom=12'], 'the latest open released the restore');
});
