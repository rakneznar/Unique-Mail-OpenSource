const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { readFavoriteStateFile, writeFavoriteStateFile } = require('../electron/favorite-state.cjs');

const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'unique-mail-favorites-'));
const target = path.join(testRoot, 'favorite-state.json');

try {
  writeFavoriteStateFile(target, {
    mailFavoriteKeys: { 'message:user@example.test|abc': true },
    folderFavorites: [{ accountEmail: 'User@Example.test', id: 'Projects\\Invoices', label: 'Invoices' }]
  });

  writeFavoriteStateFile(target, { mailFavoriteKeys: { 'message:user@example.test|abc': false } });
  let state = readFavoriteStateFile(target);
  assert.deepStrictEqual(state.mailFavoriteKeys, { 'message:user@example.test|abc': false });
  assert.strictEqual(state.folderFavorites.length, 1, 'mail updates must preserve folder favorites');

  writeFavoriteStateFile(target, { folderFavorites: [
    { accountEmail: 'User@Example.test', id: 'Projects/Invoices', label: 'Invoices' },
    { accountEmail: 'user@example.test', id: 'projects\\invoices', label: 'Duplicate' }
  ] });
  state = readFavoriteStateFile(target);
  assert.strictEqual(state.folderFavorites.length, 1, 'equivalent folder paths must be deduplicated');
  assert.deepStrictEqual(state.mailFavoriteKeys, { 'message:user@example.test|abc': false }, 'folder updates must preserve mail favorites');

  writeFavoriteStateFile(target, { mailFavoriteKeys: { stable: true } });
  writeFavoriteStateFile(target, { mailFavoriteKeys: { stable: false } });
  fs.writeFileSync(target, '{broken json', 'utf8');
  state = readFavoriteStateFile(target);
  assert.strictEqual(state.recoveredFromBackup, true, 'corrupt primary state must fall back to backup');
  assert.deepStrictEqual(state.mailFavoriteKeys, { stable: true });
  writeFavoriteStateFile(target, { folderFavorites: state.folderFavorites });
  assert.deepStrictEqual(readFavoriteStateFile(target).mailFavoriteKeys, { stable: true }, 'recovery writes must not copy corruption over backup');

  console.log('Favorite-state regression tests passed.');
} finally {
  fs.rmSync(testRoot, { recursive: true, force: true });
}
