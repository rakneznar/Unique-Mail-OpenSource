const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const packages = [];

for (const [packagePath, metadata] of Object.entries(lock.packages || {})) {
  if (!packagePath.startsWith('node_modules/') || metadata.dev || !metadata.version) continue;
  const manifestPath = path.join(root, packagePath, 'package.json');
  if (!fs.existsSync(manifestPath)) continue;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!manifest.name) continue;
  packages.push({
    name: manifest.name,
    version: metadata.version,
    license: metadata.license || manifest.license || 'See package distribution',
    homepage: metadata.homepage || manifest.homepage || metadata.repository?.url || manifest.repository?.url || ''
  });
}

packages.sort((left, right) => left.name.localeCompare(right.name) || left.version.localeCompare(right.version));
const unique = packages.filter((entry, index) => index === 0 || entry.name !== packages[index - 1].name || entry.version !== packages[index - 1].version);
const lines = [
  'Unique Mail - Third-Party Software Notices',
  'Generated from package-lock.json. Each component remains subject to its own license.',
  '',
  'Electron distributions also include LICENSE.electron.txt and LICENSES.chromium.html with the complete Electron and Chromium notices.',
  '',
  ...unique.map(entry => `${entry.name}@${entry.version} | ${entry.license}${entry.homepage ? ` | ${entry.homepage}` : ''}`),
  ''
];

fs.writeFileSync(path.join(root, 'THIRD_PARTY_NOTICES.txt'), lines.join('\n'), 'utf8');
console.log(`Wrote ${unique.length} production dependency notices.`);
