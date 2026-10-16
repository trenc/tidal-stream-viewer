import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  LANGUAGES,
  createI18n,
  createTranslator,
  formatNumber,
  interpolate,
  pickLanguage,
} from './i18n.js';
import { messages } from './locales/index.js';

const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

test('every language has exactly the keys of the English texts', () => {
  const keys = Object.keys(messages.en).sort();

  for (const { code } of LANGUAGES) {
    assert.deepEqual(Object.keys(messages[code]).sort(), keys, `keys of ${code}`);
  }
});

test('every translation uses the same {placeholders} as the English text', () => {
  for (const { code } of LANGUAGES) {
    for (const [key, text] of Object.entries(messages[code])) {
      assert.deepEqual(placeholders(text), placeholders(messages.en[key]), `${code}: ${key}`);
    }
  }
});

test('no translation is empty', () => {
  for (const { code } of LANGUAGES) {
    for (const [key, text] of Object.entries(messages[code])) {
      assert.ok(text.trim().length > 0, `${code}: ${key}`);
    }
  }
});

test('the browser language list decides, with English as fallback', () => {
  assert.equal(pickLanguage(['fr-CA', 'en']), 'fr');
  assert.equal(pickLanguage(['it', 'de-AT']), 'de');
  assert.equal(pickLanguage(['it', 'es']), 'en');
  assert.equal(pickLanguage([]), 'en');
});

test('placeholders are filled and unknown ones are left alone', () => {
  assert.equal(interpolate('Loading {done}/{total}', { done: 1, total: 2 }), 'Loading 1/2');
  assert.equal(interpolate('Hello {name}', {}), 'Hello {name}');
});

test('a missing translation falls back to English, then to the key', () => {
  const sample = { en: { a: 'Apple' }, fr: {} };

  assert.equal(createTranslator(sample, 'fr')('a'), 'Apple');
  assert.equal(createTranslator(sample, 'fr')('missing'), 'missing');
});

test('numbers follow the language', () => {
  assert.equal(formatNumber(2.5, 2, 'en'), '2.50');
  assert.equal(formatNumber(2.5, 2, 'fr'), '2,50');
  assert.equal(formatNumber(2.5, 2, 'de'), '2,50');
});

test('the store starts from the saved language, else from the browser', () => {
  const data = new Map();
  const storage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };

  const first = createI18n({ messages, storage, preferred: ['de-DE'] });
  assert.equal(first.language, 'de');
  assert.equal(first.t('common.now'), 'Jetzt');

  first.set('fr');
  assert.equal(first.t('common.now'), 'Maintenant');
  first.set('xx');
  assert.equal(first.language, 'fr');

  const second = createI18n({ messages, storage, preferred: ['en'] });
  assert.equal(second.language, 'fr');
});
