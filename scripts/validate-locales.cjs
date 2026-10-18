const fs = require('node:fs');
const path = require('node:path');

const localeDirectory = path.join(__dirname, '..', 'src', 'i18n', 'locales');
const files = fs.readdirSync(localeDirectory).filter(file => file.endsWith('.json')).sort();
if (!files.includes('en.json')) throw new Error('The canonical English catalog src/i18n/locales/en.json is missing.');

const readCatalog = file => JSON.parse(fs.readFileSync(path.join(localeDirectory, file), 'utf8'));
const english = readCatalog('en.json');
const englishKeys = new Set(Object.keys(english));
const placeholders = value => [...String(value).matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)].map(match => match[1]).sort();
const errors = [];

for (const [key, value] of Object.entries(english)) {
  if (typeof value !== 'string' || !value.trim()) errors.push(`en.json: ${key} must be a non-empty string`);
}

for (const file of files.filter(file => file !== 'en.json')) {
  const catalog = readCatalog(file);
  for (const [key, value] of Object.entries(catalog)) {
    if (!englishKeys.has(key)) errors.push(`${file}: unknown key ${key}`);
    if (typeof value !== 'string' || !value.trim()) errors.push(`${file}: ${key} must be a non-empty string`);
    if (englishKeys.has(key) && placeholders(value).join('|') !== placeholders(english[key]).join('|')) {
      errors.push(`${file}: placeholders for ${key} do not match en.json`);
    }
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`Validated ${files.length} locale catalogs against ${englishKeys.size} canonical English keys.`);
