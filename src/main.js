import Alpine from 'alpinejs';
import { registerSW } from 'virtual:pwa-register';

import './style.css';

import { CHECK_INTERVAL_MS, shouldCheckUpdate } from './app-update.js';
import { createI18n } from './i18n.js';
import { messages } from './locales/index.js';
import { currentViewer } from './viewer.js';

// A new version installs and waits (registerType 'prompt' in vite.config.js) until the
// user taps Reload, so an open point query or a running playback is never interrupted
// without a choice. The notice lives in the appUpdate store; index.html shows it.
let applyingUpdate = false;

// The page reloads itself when the applied update takes control. workbox-window only
// reloads on its own when the page was already controlled at registration time, which
// is not the case in the very first session after the worker was registered.
navigator.serviceWorker?.addEventListener('controllerchange', () => {
  if (applyingUpdate) location.reload();
});

Alpine.store('appUpdate', {
  ready: false,
  async apply() {
    this.ready = false;
    applyingUpdate = true;
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration?.waiting) {
      // Tell the waiting worker to take over; the listener above reloads the page.
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      // Another tab already applied the update: a plain reload picks it up.
      location.reload();
    }
  },
  dismiss() {
    // The waiting worker stays waiting: the notice returns on the next page load.
    this.ready = false;
  },
});

registerSW({
  immediate: true,
  onNeedRefresh() {
    Alpine.store('appUpdate').ready = true;
  },
});

// Looks for a new service worker at most once an hour: when the app comes back to the
// foreground, and once an hour for a tab that stays open. Offline or unreachable, the
// next window simply tries again.
let lastUpdateCheck = 0;

async function checkForUpdate() {
  const now = Date.now();
  if (!shouldCheckUpdate(lastUpdateCheck, now)) return;
  lastUpdateCheck = now;

  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    await registration?.update();
  } catch {
    // The next check retries.
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkForUpdate();
});
setInterval(checkForUpdate, CHECK_INTERVAL_MS);

Alpine.store(
  'i18n',
  createI18n({
    messages,
    storage: localStorage,
    preferred: navigator.languages?.length ? navigator.languages : [navigator.language],
  })
);
Alpine.data('currentViewer', currentViewer);
Alpine.start();

// Keeps <html lang> in step with the chosen language (screen readers, hyphenation, translation prompts).
Alpine.effect(() => {
  document.documentElement.lang = Alpine.store('i18n').language;
});
