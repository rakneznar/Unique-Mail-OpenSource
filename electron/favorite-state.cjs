const fs = require('fs');
const path = require('path');

function normalizeFavoriteState(value) {
  const mailFavoriteKeys = value?.mailFavoriteKeys && typeof value.mailFavoriteKeys === 'object' && !Array.isArray(value.mailFavoriteKeys)
    ? Object.fromEntries(Object.entries(value.mailFavoriteKeys).filter(([key, enabled]) => key && typeof enabled === 'boolean'))
    : {};
  const seenFolders = new Set();
  const folderFavorites = Array.isArray(value?.folderFavorites)
    ? value.folderFavorites.filter(entry => {
        if (!entry || typeof entry.accountEmail !== 'string' || typeof entry.id !== 'string' || typeof entry.label !== 'string') return false;
        const key = `${entry.accountEmail.trim().toLowerCase()}::${entry.id.trim().replace(/\\/g, '/').toLowerCase()}`;
        if (!entry.accountEmail.trim() || !entry.id.trim() || seenFolders.has(key)) return false;
        seenFolders.add(key);
        return true;
      }).map(entry => ({ accountEmail: entry.accountEmail.trim(), id: entry.id.trim(), label: entry.label.trim() || entry.id.trim() }))
    : [];
  return { mailFavoriteKeys, folderFavorites };
}

function readFavoriteStateFile(target, logger = () => {}) {
  for (const candidate of [target, `${target}.bak`]) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8'));
      if (parsed?.format !== 'unique-mail-favorite-state-v1') throw new Error('Unbekanntes Favoriten-Dateiformat');
      return { found: true, ...normalizeFavoriteState(parsed), recoveredFromBackup: candidate.endsWith('.bak') };
    } catch (error) {
      logger(`favorite state read failed: path=${candidate} error=${error.message || String(error)}`);
    }
  }
  return { found: false, mailFavoriteKeys: {}, folderFavorites: [], recoveredFromBackup: false };
}

function writeFavoriteStateFile(target, patch, logger = () => {}) {
  const current = readFavoriteStateFile(target, logger);
  const next = normalizeFavoriteState({
    mailFavoriteKeys: patch?.mailFavoriteKeys !== undefined ? patch.mailFavoriteKeys : current.mailFavoriteKeys,
    folderFavorites: patch?.folderFavorites !== undefined ? patch.folderFavorites : current.folderFavorites
  });
  const currentComparable = JSON.stringify({ mailFavoriteKeys: current.mailFavoriteKeys, folderFavorites: current.folderFavorites });
  if (current.found && !current.recoveredFromBackup && currentComparable === JSON.stringify(next)) return next;

  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target) && !current.recoveredFromBackup) {
    try { fs.copyFileSync(target, `${target}.bak`); } catch (error) { logger(`favorite state backup failed: ${error.message || String(error)}`); }
  }
  const tempPath = `${target}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify({
    format: 'unique-mail-favorite-state-v1',
    savedAt: new Date().toISOString(),
    ...next
  }, null, 2), 'utf8');
  try {
    fs.copyFileSync(tempPath, target);
  } finally {
    fs.rmSync(tempPath, { force: true });
  }
  return next;
}

module.exports = { normalizeFavoriteState, readFavoriteStateFile, writeFavoriteStateFile };
