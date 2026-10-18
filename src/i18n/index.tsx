import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import englishCatalog from './locales/en.json';
import germanCatalog from './locales/de.json';

export const DEFAULT_LOCALE = 'en';
export const FALLBACK_LOCALE = 'en';
export const LANGUAGE_CATALOG_VERSION = 1;
export const LOCALE_STORAGE_KEY = 'uniquemail_ui_language';

export type LocaleCode = string;
export type TranslationParams = Record<string, string | number>;
type TranslationCatalog = Record<string, string>;

export type LocaleDefinition = {
  code: LocaleCode;
  nativeName: string;
  englishName: string;
  catalog: TranslationCatalog;
};

const localeRegistry: LocaleDefinition[] = [
  { code: 'en', nativeName: 'English', englishName: 'English', catalog: englishCatalog },
  { code: 'de', nativeName: 'Deutsch', englishName: 'German', catalog: germanCatalog }
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
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale,
    locales: availableLocales,
    t,
    formatLocale: locale === 'de' ? 'de-DE' : locale === 'en' ? 'en-US' : locale
  }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside I18nProvider.');
  return context;
};
