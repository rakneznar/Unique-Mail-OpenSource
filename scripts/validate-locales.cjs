const fs = require('node:fs');
const path = require('node:path');

const localeDirectory = path.join(__dirname, '..', 'src', 'i18n', 'locales');
const localeRegistryFile = path.join(__dirname, '..', 'src', 'i18n', 'index.tsx');
const files = fs.readdirSync(localeDirectory).filter(file => file.endsWith('.json')).sort();
if (!files.includes('en.json')) throw new Error('The canonical English catalog src/i18n/locales/en.json is missing.');

const readCatalog = file => JSON.parse(fs.readFileSync(path.join(localeDirectory, file), 'utf8'));
const english = readCatalog('en.json');
const englishKeys = new Set(Object.keys(english));
const placeholders = value => [...String(value).matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)].map(match => match[1]).sort();
const errors = [];
const localeRegistrySource = fs.readFileSync(localeRegistryFile, 'utf8');
const localeRegistryLines = localeRegistrySource.split(/\r?\n/).filter(line => line.includes("{ code: '"));

for (const file of files) {
  if (!localeRegistrySource.includes(`./locales/${file}`)) {
    errors.push(`${file}: catalog exists but is not imported by src/i18n/index.tsx`);
  }
  if (file !== 'en.json') {
    const code = path.basename(file, '.json');
    const registryEntry = localeRegistryLines.find(line => line.includes(`code: '${code}'`));
    if (!registryEntry) errors.push(`${file}: locale metadata is missing from the central registry`);
    else if (!registryEntry.includes('flag:') || !registryEntry.includes('nativeName:') || !registryEntry.includes('formatLocale:') || !registryEntry.includes('direction:')) {
      errors.push(`${file}: registry metadata must include flag, native name, date locale, and text direction`);
    }
  }
}

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
  if (['hi.json', 'bn.json', 'id.json', 'ur.json', 'mr.json', 'te.json', 'ha.json', 'pa.json', 'vi.json', 'ta.json', 'nl.json'].includes(file)) {
    for (const key of ['common.all', 'settings.interfaceLanguage', 'onboarding.languageTitle', 'onboarding.continue']) {
      if (typeof catalog[key] !== 'string' || !catalog[key].trim()) errors.push(`${file}: new locale must translate core key ${key}`);
    }
  }
  const coverage = Math.round((Object.keys(catalog).filter(key => englishKeys.has(key)).length / englishKeys.size) * 100);
  console.log(`${file}: ${coverage}% translation coverage`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`Validated ${files.length} locale catalogs against ${englishKeys.size} canonical English keys.`);
