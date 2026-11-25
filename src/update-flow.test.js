import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CHECK_INTERVAL_MS, createUpdateFlow } from './update-flow.js';

const HOUR = CHECK_INTERVAL_MS;

function waitingWorker() {
  return {
    messages: [],
    postMessage(message) {
      this.messages.push(message);
    },
  };
}

// A fake service worker: the test swaps state.controller to simulate another
// tab applying the update, and the registration records update calls instead
// of hitting the network.
function fakeSw({ controller = null, waiting = null, failUpdate = false } = {}) {
  const state = {
    controller,
    waiting,
    updates: 0,
    reloads: 0,
  };
  const sw = {
    controller: () => state.controller,
    registration: async () => ({
      waiting,
      update: async () => {
        state.updates += 1;
        if (failUpdate) throw new Error('offline');
      },
    }),
  };
  const flow = createUpdateFlow({ sw, reload: () => { state.reloads += 1; } });
  return { flow, state };
}

function noticesFor(flow) {
  const notices = [];
  flow.onNotice((ready) => notices.push(ready));
  return notices;
}

test('a waiting worker shows the notice, and dismiss hides it', () => {
  const { flow, state } = fakeSw();
  const notices = noticesFor(flow);

  flow.needRefresh();
  flow.dismiss();
  flow.dismiss(); // dismissing again changes nothing
  assert.deepEqual(notices, [true, false]);
  assert.equal(state.reloads, 0);
});

test("another tab's takeover shows the notice once per takeover", () => {
  const { flow, state } = fakeSw({ controller: { id: 'a' } });
  const notices = noticesFor(flow);

  flow.controllerChanged(); // same controller: no takeover
  assert.deepEqual(notices, []);

  state.controller = { id: 'b' }; // the other tab applied the update
  flow.controllerChanged();
  flow.controllerChanged(); // same controller again: no repeat notice
  assert.deepEqual(notices, [true]);

  flow.dismiss();
  flow.controllerChanged(); // the dismissed notice stays hidden
  assert.deepEqual(notices, [true, false]);

  state.controller = { id: 'c' }; // the next takeover is offered again
  flow.controllerChanged();
  flow.controllerChanged();
  assert.deepEqual(notices, [true, false, true]);
});

test('the first controller a fresh page sees is not a takeover', () => {
  const { flow, state } = fakeSw({ controller: null });
  const notices = noticesFor(flow);

  state.controller = { id: 'a' };
  flow.controllerChanged();
  assert.deepEqual(notices, []);
});

test('our own Reload tap posts SKIP_WAITING and reloads when the update takes control', async () => {
  const waiting = waitingWorker();
  const { flow, state } = fakeSw({ waiting });
  const notices = noticesFor(flow);

  flow.needRefresh();
  await flow.apply();
  assert.deepEqual(notices, [true, false]);
  assert.deepEqual(waiting.messages, [{ type: 'SKIP_WAITING' }]);
  assert.equal(state.reloads, 0);

  flow.controllerChanged(); // the new worker takes control
  assert.equal(state.reloads, 1);
});

test('without a waiting worker, Reload is a plain reload', async () => {
  const { flow, state } = fakeSw({ waiting: null });

  await flow.apply();
  assert.equal(state.reloads, 1);
  assert.equal(state.updates, 0);
});

test('an hourly check reaches the registration, a recent one does not', async () => {
  const { flow, state } = fakeSw();

  await flow.check(1000);
  await flow.check(2000);
  assert.equal(state.updates, 1);

  await flow.check(1000 + HOUR);
  assert.equal(state.updates, 2);
});

test('a check within the hour still notices a takeover', async () => {
  const { flow, state } = fakeSw({ controller: { id: 'a' } });
  await flow.check(1000);
  const notices = noticesFor(flow);

  state.controller = { id: 'b' }; // applied in another tab while hidden
  await flow.check(2000);
  assert.deepEqual(notices, [true]);
  assert.equal(state.updates, 1); // throttled: no registration.update call
});

test('a failed update check retries on the next one', async () => {
  const { flow, state } = fakeSw({ failUpdate: true });

  await flow.check(1000);
  assert.equal(state.updates, 1);

  await flow.check(2000); // throttled, no new attempt
  assert.equal(state.updates, 1);

  await flow.check(1000 + HOUR);
  assert.equal(state.updates, 2);
});
