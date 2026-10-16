import Alpine from 'alpinejs';
import { registerSW } from 'virtual:pwa-register';

import './style.css';

import { createI18n } from './i18n.js';
import { messages } from './locales/index.js';
import { SPEED_LEGEND } from './speed-scale.js';
import { currentViewer } from './viewer.js';

registerSW({ immediate: true });

Alpine.store(
  'i18n',
  createI18n({
    messages,
    storage: localStorage,
    preferred: navigator.languages?.length ? navigator.languages : [navigator.language],
  })
);
Alpine.store('speedLegend', SPEED_LEGEND);
Alpine.data('currentViewer', currentViewer);
Alpine.start();

// Keeps <html lang> in step with the chosen language (screen readers, hyphenation, translation prompts).
Alpine.effect(() => {
  document.documentElement.lang = Alpine.store('i18n').language;
});
