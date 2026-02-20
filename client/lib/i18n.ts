/**
 * i18n Core Module
 *
 * Zero-dependency internationalisation using SolidJS signals.
 * Components import `t` directly — reactivity handles re-renders.
 *
 * Usage:
 *   import { t } from '@/lib/i18n';
 *   <button>{t('enterSpace')}</button>
 *   <p>{t('peopleHere', { count: 3 })}</p>
 */
import { createSignal } from 'solid-js';
import en, { type TranslationKey } from '@/locales/en';
import fr from '@/locales/fr';

// ── Supported locales ──────────────────────────────────────
export type Locale = 'en' | 'fr';

const dictionaries: Record<Locale, Record<string, string>> = { en, fr };

const STORAGE_KEY = 'openspatial-lang';

// ── Detect initial locale ──────────────────────────────────
function detectLocale(): Locale {
  // 1. Explicit override from localStorage
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'en' || stored === 'fr') return stored;

  // 2. Browser language
  const browserLang = navigator.language.slice(0, 2).toLowerCase();
  if (browserLang === 'fr') return 'fr';

  return 'en';
}

// ── Reactive signal ────────────────────────────────────────
const [locale, _setLocale] = createSignal<Locale>(detectLocale());

/** Change locale and persist to localStorage. */
export function setLocale(l: Locale): void {
  localStorage.setItem(STORAGE_KEY, l);
  _setLocale(l);
}

export { locale };

// ── Translation function ───────────────────────────────────
/**
 * Translate a key, interpolating `{{param}}` placeholders.
 * Falls back to English if the key is missing in the current locale.
 */
export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const dict = dictionaries[locale()];
  let text = dict[key] ?? en[key] ?? key;

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{{${k}}}`, String(v));
    }
  }

  return text;
}
