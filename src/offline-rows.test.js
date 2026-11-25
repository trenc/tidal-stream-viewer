import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  exceedsQuota,
  failedWarning,
  offlineRow,
  sizeLabel,
  storageLine,
  wantsInstallHint,
} from './offline-rows.js';

test('sizes are decimal MB, one decimal under ten', () => {
  assert.equal(sizeLabel(0), '0 MB');
  assert.equal(sizeLabel(1634000), '1.6 MB');
  assert.equal(sizeLabel(10400000), '10 MB');
  assert.equal(sizeLabel(168803200), '169 MB');
});

test('a row that is not downloaded offers Download', () => {
  assert.deepEqual(offlineRow({ state: 'none', done: 0, total: 50, bytes: 1634000 }), {
    size: '1.6 MB',
    stateKey: 'about.offline.stateNone',
    stateParams: { done: 0, total: 50 },
    buttons: [{ id: 'download', key: 'about.offline.download' }],
  });
});

test('the first tap turns the button into a size confirmation', () => {
  const row = offlineRow({ state: 'none', done: 0, total: 290, bytes: 168803200, confirming: true });

  assert.deepEqual(row.buttons, [
    { id: 'download', key: 'about.offline.confirm', params: { size: '169 MB' } },
  ]);
});

test('a metered connection gets the stronger confirmation', () => {
  const row = offlineRow({
    state: 'none', done: 0, total: 290, bytes: 168803200, confirming: true, metered: true,
  });

  assert.equal(row.buttons[0].key, 'about.offline.confirmMetered');
  assert.deepEqual(row.buttons[0].params, { size: '169 MB' });
});

test('an unsupported or false save-data value keeps the plain size confirmation', () => {
  for (const metered of [undefined, null, false, 0]) {
    const row = offlineRow({ state: 'none', done: 0, total: 290, bytes: 168803200, confirming: true, metered });

    assert.equal(row.buttons[0].key, 'about.offline.confirm');
    assert.deepEqual(row.buttons[0].params, { size: '169 MB' });
  }
});

test('a partial atlas offers Finish and Remove', () => {
  const row = offlineRow({ state: 'partial', done: 120, total: 290, bytes: 168803200 });

  assert.equal(row.stateKey, 'about.offline.statePartial');
  assert.deepEqual(row.stateParams, { done: 120, total: 290 });
  assert.deepEqual(row.buttons, [
    { id: 'download', key: 'about.offline.finish' },
    { id: 'remove', key: 'about.offline.remove' },
  ]);
});

test('a downloaded atlas offers only Remove', () => {
  const row = offlineRow({ state: 'complete', done: 290, total: 290, bytes: 168803200 });

  assert.equal(row.stateKey, 'about.offline.stateComplete');
  assert.deepEqual(row.buttons, [{ id: 'remove', key: 'about.offline.remove' }]);
});

test('a running download offers only Cancel and shows the count so far', () => {
  const row = offlineRow({ state: 'partial', done: 40, total: 290, bytes: 168803200, running: true });

  assert.equal(row.stateKey, 'about.offline.statePartial');
  assert.deepEqual(row.stateParams, { done: 40, total: 290 });
  assert.deepEqual(row.buttons, [{ id: 'cancel', key: 'about.offline.cancel' }]);
});

test('the quota warning fires only above the reported free space', () => {
  const estimate = { usage: 2e9, quota: 12e9 };

  assert.equal(exceedsQuota(168803200, estimate), false);
  assert.equal(exceedsQuota(11e9, estimate), true);
  assert.equal(exceedsQuota(11e9, null), false);
  assert.equal(exceedsQuota(11e9, { usage: 2e9 }), false, 'a quotaless estimate never warns');
});

test('the storage line shows usage and quota, in MB below a gigabyte', () => {
  assert.deepEqual(storageLine({ usage: 1634000, quota: 120e6 }), {
    key: 'about.offline.storage',
    params: { used: '1.6 MB', quota: '120 MB' },
  });

  const gb = storageLine({ usage: 1.6e9, quota: 120e9 });
  assert.equal(gb.params.used, '1.6 GB');
  assert.equal(gb.params.quota, '120 GB');
  assert.equal(storageLine(null), null);

  // Small usage against a big quota keeps MB: no "0 GB".
  const mixed = storageLine({ usage: 42e6, quota: 2.1e9 });
  assert.equal(mixed.params.used, '42 MB');
  assert.equal(mixed.params.quota, '2.1 GB');
});

test('the install hint wants a plain tab that has not dismissed it', () => {
  assert.equal(wantsInstallHint(false, false), true);
  assert.equal(wantsInstallHint(true, false), false);
  assert.equal(wantsInstallHint(false, true), false);
});

test('a download that finished with failures carries a warning, a clean one none', () => {
  assert.deepEqual(failedWarning({ failed: 0, done: 50, total: 50 }), null);
  assert.deepEqual(failedWarning({ failed: 35, done: 15, total: 50 }), {
    key: 'about.offline.failed',
    params: { count: 35 },
  });
});
