import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createOfflineFlow } from './offline-flow.js';

test('the first tap arms the confirm, the second starts', () => {
  const flow = createOfflineFlow();

  assert.equal(flow.tap('roscoff'), false, 'the first tap only arms');
  assert.ok(flow.isConfirming('roscoff'));
  assert.equal(flow.tap('roscoff'), true, 'the second tap starts');
  assert.ok(flow.isRunning('roscoff'));
});

test('a running download ignores further taps', () => {
  const flow = createOfflineFlow();
  flow.tap('roscoff');
  flow.tap('roscoff');

  assert.equal(flow.tap('roscoff'), false);
  assert.ok(flow.isRunning('roscoff'), 'still running, no second start');
});

test('the flow of one atlas leaves the others alone', () => {
  const flow = createOfflineFlow();
  flow.tap('roscoff');

  assert.equal(flow.isConfirming('iroise'), false);
});

test('finish returns to idle, and the next tap arms again', () => {
  const flow = createOfflineFlow();
  flow.tap('roscoff');
  flow.tap('roscoff');
  flow.finish('roscoff');

  assert.equal(flow.isRunning('roscoff'), false);
  assert.equal(flow.isConfirming('roscoff'), false);
  assert.equal(flow.tap('roscoff'), false, 'the confirm is armed again');
});
