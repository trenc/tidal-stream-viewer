// The update flow: every rule that decides when the app offers a reload after
// a new service worker version arrives. The service worker and location.reload
// are injected, so tests drive the flow directly.

export const CHECK_INTERVAL_MS = 60 * 60 * 1000;

// True when enough time has passed since the last check; 0 (or worse) means never checked.
function shouldCheckUpdate(lastCheckMs, nowMs, intervalMs = CHECK_INTERVAL_MS) {
  if (!(lastCheckMs > 0)) return true;
  return nowMs - lastCheckMs >= intervalMs;
}

export function createUpdateFlow({ sw, reload }) {
  // The worker controlling this page, as far as we have seen it. When it changes
  // without our own Reload tap, another tab has applied the update and this
  // page is now running the old version; the takeover is then offered here too.
  let knownController = sw.controller();
  // Remembers the controller of the last takeover notice, so a dismissed notice
  // stays hidden until the next takeover.
  let notifiedController = null;
  // Set by apply(): the controllerchange it triggers must reload the page,
  // not show another notice.
  let applyingUpdate = false;
  let lastCheckMs = 0;
  let notice = false;
  const noticeListeners = [];

  function setNotice(value) {
    if (notice === value) return;
    notice = value;
    for (const listener of noticeListeners) listener(value);
  }

  // Shows the update notice when the page's controller was replaced from outside.
  function noticeTakeover() {
    const controller = sw.controller();
    const takeover = Boolean(controller && knownController && controller !== knownController);
    if (controller) knownController = controller;
    if (takeover && controller !== notifiedController) {
      notifiedController = controller;
      setNotice(true);
    }
  }

  return {
    onNotice(listener) {
      noticeListeners.push(listener);
    },

    needRefresh() {
      setNotice(true);
    },

    controllerChanged() {
      // The page reloads itself when the applied update takes control.
      // workbox-window only reloads on its own when the page was already
      // controlled at registration time, which is not the case in the very
      // first session after the worker was registered.
      if (applyingUpdate) {
        reload();
        return;
      }
      noticeTakeover();
    },

    dismiss() {
      // The waiting worker stays waiting: the notice returns on the next page load.
      setNotice(false);
    },

    async apply() {
      setNotice(false);
      applyingUpdate = true;
      const registration = await sw.registration();
      if (registration?.waiting) {
        // Tell the waiting worker to take over; controllerChanged reloads the page.
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      } else {
        // Another tab already applied the update: a plain reload picks it up.
        reload();
      }
    },

    async check(nowMs) {
      // The takeover comparison runs on every check, since it is local and is
      // exactly what a returning user needs to see.
      noticeTakeover();

      if (!shouldCheckUpdate(lastCheckMs, nowMs)) return;
      lastCheckMs = nowMs;

      try {
        const registration = await sw.registration();
        await registration?.update();
      } catch {
        // The next check retries.
      }
    },
  };
}
