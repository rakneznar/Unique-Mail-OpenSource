# Continuous localization

Unique Mail uses `src/i18n/locales/en.json` as its canonical source catalog. English is always complete and is the runtime fallback for missing, empty, invalid, or unavailable translations.

## Adding or updating a language

1. Add or update `<locale>.json` in `src/i18n/locales`.
2. Register its metadata in `src/i18n/index.tsx`.
3. Keep placeholder names such as `{{name}}` identical to the English source.
4. Run `npm run test:i18n`.

Language catalogs are bundled with the application. Every normal app update therefore installs the matching current catalog and cannot retain an outdated translation database. A user's selected locale is persisted separately; if that locale is unavailable after an update, the application starts in English.

Partial translation catalogs are supported intentionally. Missing keys resolve to English so continuous translation work can ship without blank labels or mixed technical errors.
