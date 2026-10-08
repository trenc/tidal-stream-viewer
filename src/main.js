import Alpine from 'alpinejs';
import { registerSW } from 'virtual:pwa-register';

import './style.css';

import { SPEED_LEGEND } from './speed-scale.js';
import { currentViewer } from './viewer.js';

registerSW({ immediate: true });

Alpine.store('speedLegend', SPEED_LEGEND);
Alpine.data('currentViewer', currentViewer);
Alpine.start();
