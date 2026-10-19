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

Catalog version 2 bundles English, German, French, Spanish, Italian, Portuguese, Japanese, Simplified Chinese, Russian, Swedish, Turkish, Arabic, Thai, and Korean. Locale-specific date formatting and text direction live in the same registry as the catalog, so a language cannot be exposed without its runtime metadata.

The validation step checks every JSON catalog against the canonical English keys and verifies placeholders. It also reports translation coverage, allowing a new language to enter continuous localization before every string is translated while retaining the guaranteed English fallback.
