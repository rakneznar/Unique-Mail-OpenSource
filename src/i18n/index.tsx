import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import englishCatalog from './locales/en.json';
import germanCatalog from './locales/de.json';
import arabicCatalog from './locales/ar.json';
import chineseCatalog from './locales/zh.json';
import frenchCatalog from './locales/fr.json';
import italianCatalog from './locales/it.json';
import japaneseCatalog from './locales/ja.json';
import koreanCatalog from './locales/ko.json';
import portugueseCatalog from './locales/pt.json';
import russianCatalog from './locales/ru.json';
import spanishCatalog from './locales/es.json';
import swedishCatalog from './locales/sv.json';
import thaiCatalog from './locales/th.json';
import turkishCatalog from './locales/tr.json';

export const DEFAULT_LOCALE = 'en';
export const FALLBACK_LOCALE = 'en';
export const LANGUAGE_CATALOG_VERSION = 2;
export const LOCALE_STORAGE_KEY = 'uniquemail_ui_language';

export type LocaleCode = string;
export type TranslationParams = Record<string, string | number>;
type TranslationCatalog = Record<string, string>;

export type LocaleDefinition = {
  code: LocaleCode;
  nativeName: string;
  englishName: string;
  formatLocale: string;
  direction: 'ltr' | 'rtl';
  catalog: TranslationCatalog;
};

const localeRegistry: LocaleDefinition[] = [
  { code: 'en', nativeName: 'English', englishName: 'English', formatLocale: 'en-GB', direction: 'ltr', catalog: englishCatalog },
  { code: 'de', nativeName: 'Deutsch', englishName: 'German', formatLocale: 'de-DE', direction: 'ltr', catalog: germanCatalog },
  { code: 'fr', nativeName: 'Français', englishName: 'French', formatLocale: 'fr-FR', direction: 'ltr', catalog: frenchCatalog },
  { code: 'es', nativeName: 'Español', englishName: 'Spanish', formatLocale: 'es-ES', direction: 'ltr', catalog: spanishCatalog },
  { code: 'it', nativeName: 'Italiano', englishName: 'Italian', formatLocale: 'it-IT', direction: 'ltr', catalog: italianCatalog },
  { code: 'pt', nativeName: 'Português', englishName: 'Portuguese', formatLocale: 'pt-PT', direction: 'ltr', catalog: portugueseCatalog },
  { code: 'ja', nativeName: '日本語', englishName: 'Japanese', formatLocale: 'ja-JP', direction: 'ltr', catalog: japaneseCatalog },
  { code: 'zh', nativeName: '中文', englishName: 'Chinese', formatLocale: 'zh-CN', direction: 'ltr', catalog: chineseCatalog },
  { code: 'ru', nativeName: 'Русский', englishName: 'Russian', formatLocale: 'ru-RU', direction: 'ltr', catalog: russianCatalog },
  { code: 'sv', nativeName: 'Svenska', englishName: 'Swedish', formatLocale: 'sv-SE', direction: 'ltr', catalog: swedishCatalog },
  { code: 'tr', nativeName: 'Türkçe', englishName: 'Turkish', formatLocale: 'tr-TR', direction: 'ltr', catalog: turkishCatalog },
  { code: 'ar', nativeName: 'العربية', englishName: 'Arabic', formatLocale: 'ar-SA', direction: 'rtl', catalog: arabicCatalog },
  { code: 'th', nativeName: 'ไทย', englishName: 'Thai', formatLocale: 'th-TH', direction: 'ltr', catalog: thaiCatalog },
  { code: 'ko', nativeName: '한국어', englishName: 'Korean', formatLocale: 'ko-KR', direction: 'ltr', catalog: koreanCatalog }
];

const catalogs = new Map(localeRegistry.map(locale => [locale.code, locale.catalog]));
const fallbackCatalog: TranslationCatalog = englishCatalog;

export const availableLocales = localeRegistry.map(({ catalog: _catalog, ...metadata }) => metadata);

export const normalizeLocale = (locale?: string | null): LocaleCode => {
  const candidate = String(locale || '').trim().toLowerCase().replace('_', '-');
  if (catalogs.has(candidate)) return candidate;
  const baseLanguage = candidate.split('-')[0];
  return catalogs.has(baseLanguage) ? baseLanguage : FALLBACK_LOCALE;
};

const interpolate = (value: string, params: TranslationParams = {}) => value.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, name: string) => {
  const replacement = params[name];
  return replacement === undefined || replacement === null ? `{{${name}}}` : String(replacement);
});

export const translate = (locale: LocaleCode, key: string, params?: TranslationParams): string => {
  const localizedValue = catalogs.get(normalizeLocale(locale))?.[key];
  const fallbackValue = fallbackCatalog[key];
  const value = typeof localizedValue === 'string' && localizedValue.trim()
    ? localizedValue
    : typeof fallbackValue === 'string' && fallbackValue.trim()
      ? fallbackValue
      : key;
  return interpolate(value, params);
};

type I18nContextValue = {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
  locales: typeof availableLocales;
  t: (key: string, params?: TranslationParams) => string;
  formatLocale: string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(() => normalizeLocale(localStorage.getItem(LOCALE_STORAGE_KEY) || DEFAULT_LOCALE));
  const setLocale = useCallback((nextLocale: LocaleCode) => setLocaleState(normalizeLocale(nextLocale)), []);
  const t = useCallback((key: string, params?: TranslationParams) => translate(locale, key, params), [locale]);

  useEffect(() => {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = localeRegistry.find(candidate => candidate.code === locale)?.direction || 'ltr';
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale,
    locales: availableLocales,
    t,
    formatLocale: localeRegistry.find(candidate => candidate.code === locale)?.formatLocale || 'en-GB'
  }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside I18nProvider.');
  return context;
};
