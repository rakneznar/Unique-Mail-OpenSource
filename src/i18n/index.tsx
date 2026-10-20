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
export const LANGUAGE_CATALOG_VERSION = 3;
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
  const [localeSelectionConfirmed, setLocaleSelectionConfirmed] = useState(() => Boolean(localStorage.getItem(LOCALE_STORAGE_KEY)));
  const setLocale = useCallback((nextLocale: LocaleCode) => setLocaleState(normalizeLocale(nextLocale)), []);
  const t = useCallback((key: string, params?: TranslationParams) => translate(locale, key, params), [locale]);

  useEffect(() => {
    if (localeSelectionConfirmed) localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = localeRegistry.find(candidate => candidate.code === locale)?.direction || 'ltr';
  }, [locale, localeSelectionConfirmed]);

  const confirmLocaleSelection = useCallback(() => {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    setLocaleSelectionConfirmed(true);
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale,
    locales: availableLocales,
    t,
    formatLocale: localeRegistry.find(candidate => candidate.code === locale)?.formatLocale || 'en-GB'
  }), [locale, setLocale, t]);

  return (
    <I18nContext.Provider value={value}>
      {localeSelectionConfirmed ? children : (
        <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4 text-slate-900" dir={localeRegistry.find(candidate => candidate.code === locale)?.direction || 'ltr'}>
          <section className="w-full max-w-3xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl sm:p-7" role="dialog" aria-modal="true" aria-labelledby="initial-language-title">
            <div className="mb-5 border-b border-slate-200 pb-4">
              <p className="mb-1 text-[11px] font-extrabold uppercase text-blue-600">Unique Mail</p>
              <h1 id="initial-language-title" className="text-xl font-bold text-slate-950 sm:text-2xl">{t('onboarding.languageTitle')}</h1>
              <p className="mt-1.5 text-sm leading-5 text-slate-600">{t('onboarding.languageDescription')}</p>
            </div>

            <div className="grid max-h-[52vh] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4" role="radiogroup" aria-label={t('settings.interfaceLanguage')}>
              {availableLocales.map(candidate => {
                const selected = candidate.code === locale;
                return (
                  <button
                    key={candidate.code}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setLocale(candidate.code)}
                    className={`min-h-14 rounded-lg border px-3 py-2 text-start transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${selected ? 'border-blue-600 bg-blue-50 text-blue-950' : 'border-slate-200 bg-white text-slate-800 hover:border-blue-300 hover:bg-slate-50'}`}
                  >
                    <span className="block text-sm font-bold">{candidate.nativeName}</span>
                    <span className="block text-[11px] text-slate-500">{candidate.englishName}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex justify-end border-t border-slate-200 pt-4">
              <button type="button" onClick={confirmLocaleSelection} className="min-h-10 rounded-lg bg-blue-600 px-6 text-sm font-bold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                {t('onboarding.continue')}
              </button>
            </div>
          </section>
        </main>
      )}
    </I18nContext.Provider>
  );
}

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside I18nProvider.');
  return context;
};
