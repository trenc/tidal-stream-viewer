import Alpine from 'alpinejs';
import { registerSW } from 'virtual:pwa-register';

import './style.css';

import { currentViewer } from './viewer.js';

registerSW({ immediate: true });

Alpine.data('currentViewer', currentViewer);
Alpine.start();
