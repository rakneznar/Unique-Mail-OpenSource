# Continuous localization

Unique Mail uses `src/i18n/locales/en.json` as its canonical source catalog. English is always complete and is the runtime fallback for missing, empty, invalid, or unavailable translations.

## Adding or updating a language

1. Add or update `<locale>.json` in `src/i18n/locales`.
2. Register its metadata in `src/i18n/index.tsx`.
3. Keep placeholder names such as `{{name}}` identical to the English source.
4. Run `npm run test:i18n`.

Language catalogs are bundled with the application. Every normal app update therefore installs the matching current catalog and cannot retain an outdated translation database. A user's selected locale is persisted separately; if that locale is unavailable after an update, the application starts in English.

Partial translation catalogs are supported intentionally. Missing keys resolve to English so continuous translation work can ship without blank labels or mixed technical errors.

## Bundled languages

Catalog version 6 bundles 25 languages: English, German, French, Spanish, Italian, Portuguese, Japanese, Simplified Chinese, Russian, Swedish, Turkish, Arabic, Thai, Korean, Hindi, Bengali, Indonesian, Urdu, Marathi, Telugu, Hausa, Punjabi, Vietnamese, Tamil, and Dutch. Locale-specific date formatting, text direction, and a representative flag live in the same registry as each catalog. On a fresh installation, the application remains behind the localized language setup screen until the user confirms a language; that choice is then stored locally and reused on subsequent starts. Settings use a flag grid with the native language name, selected state, and accessible label instead of a language dropdown. Dutch ships as a complete catalog and is represented by the Netherlands flag.

The ten new catalogs currently translate the core navigation, search, language settings, and onboarding text. Remaining entries deliberately use the canonical English fallback and can be translated incrementally without delaying an app update.

The validation step checks every JSON catalog against the canonical English keys and verifies placeholders. It also reports translation coverage, allowing a new language to enter continuous localization before every string is translated while retaining the guaranteed English fallback.
