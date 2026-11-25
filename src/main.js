import Alpine from 'alpinejs';
import { registerSW } from 'virtual:pwa-register';

import './style.css';

import { CHECK_INTERVAL_MS, createUpdateFlow } from './update-flow.js';
import { createI18n } from './i18n.js';
import { messages } from './locales/index.js';
import { currentViewer } from './viewer.js';

// A new version installs and waits (registerType 'prompt' in vite.config.js) until the
// user taps Reload, so an open point query or a running playback is never interrupted
// without a choice. The notice lives in the appUpdate store; index.html shows it.
const flow = createUpdateFlow({
  sw: {
    controller: () => navigator.serviceWorker?.controller ?? null,
    registration: () => navigator.serviceWorker?.getRegistration(),
  },
  reload: () => location.reload(),
});

Alpine.store('appUpdate', {
  ready: false,
  apply: () => flow.apply(),
  dismiss: () => flow.dismiss(),
});

flow.onNotice((ready) => {
  Alpine.store('appUpdate').ready = ready;
});

navigator.serviceWorker?.addEventListener('controllerchange', () => {
  flow.controllerChanged();
});

registerSW({
  immediate: true,
  onNeedRefresh() {
    flow.needRefresh();
  },
  // Without this, a failed registration (blocked storage, unreachable script, ...)
  // fails silently and the update prompt looks broken for no visible reason.
  onRegisterError(error) {
    console.warn('Service worker registration failed:', error);
  },
});

// Looks for a new service worker at most once an hour: when the app comes back to the
// foreground, and once an hour for a tab that stays open. Offline or unreachable, the
// next window simply tries again.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') flow.check(Date.now());
});
setInterval(() => flow.check(Date.now()), CHECK_INTERVAL_MS);

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

// Light-dismiss fallback for the About dialog where closedby is unsupported (Safari).
// The pointer position is tested, not event.target: the dialog is also the target of
// clicks on its own padding and the gaps between its children. The press and the
// release must both land outside, so a text-selection drag ending on the backdrop
// does not dismiss.
if (!('closedBy' in HTMLDialogElement.prototype)) {
  for (const dialog of document.querySelectorAll('dialog[closedby="any"]')) {
    const outside = (e) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    let pressedOutside = false;
    dialog.addEventListener('pointerdown', (e) => { pressedOutside = outside(e); });
    dialog.addEventListener('pointerup', (e) => { if (pressedOutside && outside(e)) dialog.close(); });
  }
}
