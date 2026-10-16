import { createTranslator, formatNumber } from '../i18n.js';
import de from './de.js';
import en from './en.js';
import fr from './fr.js';

export const messages = { en, fr, de };

// English only, for code that runs without the page (tests) or before a language is chosen.
export const englishI18n = {
  language: 'en',
  t: createTranslator(messages, 'en'),
  number: (value, digits = 2) => formatNumber(value, digits, 'en'),
};
