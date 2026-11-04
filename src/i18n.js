// Language handling without a library: a few pure helpers plus a small store object for Alpine.
// Texts live in src/locales/*.js as flat keys with {placeholders}.

export const LANGUAGES = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'fr', label: 'FR', name: 'Français' },
  { code: 'de', label: 'DE', name: 'Deutsch' },
];

export const DEFAULT_LANGUAGE = 'en';

const STORAGE_KEY = 'ui.language';

export function isSupported(code) {
  return LANGUAGES.some((language) => language.code === code);
}

// The first supported language in the browser's preference list ("fr-CA" counts as "fr").
export function pickLanguage(preferred = []) {
  for (const candidate of preferred) {
    const base = String(candidate).toLowerCase().split('-')[0];
    if (isSupported(base)) return base;
  }

  return DEFAULT_LANGUAGE;
}

export function interpolate(template, params = {}) {
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

// Looks a key up in the chosen language, then in English, then shows the key itself.
export function createTranslator(messages, language) {
  return (key, params) =>
    interpolate(messages[language]?.[key] ?? messages[DEFAULT_LANGUAGE]?.[key] ?? key, params);
}

export function formatNumber(value, digits, language) {
  return new Intl.NumberFormat(language, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

// The object registered as Alpine.store('i18n'). Its methods read this.language,
// so everything that uses them updates when the language changes.
export function createI18n({ messages, storage, preferred }) {
  const saved = storage.getItem(STORAGE_KEY);

  // The translator depends only on the language, so it is built once per language.
  let translator = null;
  let translatorLanguage = null;

  return {
    language: isSupported(saved) ? saved : pickLanguage(preferred),
    languages: LANGUAGES,

    t(key, params) {
      if (translatorLanguage !== this.language) {
        translatorLanguage = this.language;
        translator = createTranslator(messages, this.language);
      }
      return translator(key, params);
    },

    number(value, digits = 2) {
      return formatNumber(value, digits, this.language);
    },

    set(code) {
      if (!isSupported(code)) return;
      this.language = code;
      storage.setItem(STORAGE_KEY, code);
    },
  };
}
