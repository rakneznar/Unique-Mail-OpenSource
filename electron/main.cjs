const { app, BrowserWindow, dialog, ipcMain, shell, safeStorage } = require('electron');
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const DEFAULT_UPDATE_FEED_URL = 'https://github.com/rakneznar/Unique-Mail-OpenSource/releases/latest/download/latest.json';
let PORT = 0;
let serverProcess = null;
let mainWindow = null;
let uniqueMailDataPaths = null;
let lastKnownUpdate = null;

app.setName('Unique Mail');

process.on('uncaughtException', error => log(`main uncaughtException: ${error?.stack || error}`));
process.on('unhandledRejection', error => log(`main unhandledRejection: ${error?.stack || error}`));

function copyMissingFiles(source, target) {
  if (!source || !target || !fs.existsSync(source)) return;
  const sourcePath = path.resolve(source);
  const targetPath = path.resolve(target);
  if (sourcePath === targetPath || targetPath.startsWith(sourcePath + path.sep)) return;
  try {
    fs.mkdirSync(target, { recursive: true });
    fs.cpSync(source, target, { recursive: true, force: false, errorOnExist: false });
  } catch (error) {
    // Migration must never block app startup; the stable path is still used.
  }
}

function resolveLocalAppDataDir() {
  if (process.env.LOCALAPPDATA) return process.env.LOCALAPPDATA;

  if (process.env.APPDATA) {
    const roamingParent = path.dirname(process.env.APPDATA);
    if (path.basename(process.env.APPDATA).toLowerCase() === 'roaming') {
      return path.join(roamingParent, 'Local');
    }
  }

  return null;
}

function configurePackagedUserDataPath() {
  if (!app.isPackaged) return;
  const installDir = path.dirname(process.execPath);
  const legacyInstallDataPath = path.join(installDir, 'UniqueMailData');
  const localAppDataDir = resolveLocalAppDataDir();
  const stableRoot = localAppDataDir
    ? path.join(localAppDataDir, 'Unique Mail')
    : legacyInstallDataPath;
  const stableUserDataPath = path.join(stableRoot, 'UserData');
  const dataRoot = path.join(stableRoot, 'Data');
  const paths = {
    stableRoot,
    userData: stableUserDataPath,
    dataRoot,
    settingsDir: path.join(dataRoot, 'Settings'),
    cacheDir: path.join(dataRoot, 'Cache'),
    mailStoreDir: path.join(stableUserDataPath, 'mail-cache'),
    logsDir: path.join(dataRoot, 'Logs')
  };

  try {
    Object.values(paths).forEach((dir) => fs.mkdirSync(dir, { recursive: true }));
    copyMissingFiles(legacyInstallDataPath, stableUserDataPath);
    app.setPath('userData', stableUserDataPath);
    uniqueMailDataPaths = paths;
  } catch (error) {
    try {
      fs.mkdirSync(legacyInstallDataPath, { recursive: true });
      app.setPath('userData', legacyInstallDataPath);
      uniqueMailDataPaths = {
        stableRoot: legacyInstallDataPath,
        userData: legacyInstallDataPath,
        dataRoot: legacyInstallDataPath,
        settingsDir: legacyInstallDataPath,
        cacheDir: legacyInstallDataPath,
        mailStoreDir: path.join(legacyInstallDataPath, 'mail-cache'),
        logsDir: legacyInstallDataPath
      };
    } catch {
      uniqueMailDataPaths = null;
    }
  }
}

function configureTestUserDataPath() {
  const testRoot = String(process.env.UNIQUE_MAIL_TEST_DATA_ROOT || '').trim();
  if (!testRoot) return false;
  const stableRoot = path.resolve(testRoot);
  const userData = path.join(stableRoot, 'UserData');
  const dataRoot = path.join(stableRoot, 'Data');
  uniqueMailDataPaths = {
    stableRoot,
    userData,
    dataRoot,
    settingsDir: path.join(dataRoot, 'Settings'),
    cacheDir: path.join(dataRoot, 'Cache'),
    mailStoreDir: path.join(userData, 'mail-cache'),
    logsDir: path.join(dataRoot, 'Logs')
  };
  Object.values(uniqueMailDataPaths).forEach(dir => fs.mkdirSync(dir, { recursive: true }));
  app.setPath('userData', userData);
  return true;
}

if (!configureTestUserDataPath()) configurePackagedUserDataPath();

function rendererStoragePath() {
  const settingsDir = uniqueMailDataPaths?.settingsDir || app.getPath('userData');
  fs.mkdirSync(settingsDir, { recursive: true });
  return path.join(settingsDir, 'renderer-storage.json');
}

function readRendererStorageSnapshot() {
  try {
    const target = rendererStoragePath();
    if (!fs.existsSync(target)) return { found: false, values: {} };
    const parsed = JSON.parse(fs.readFileSync(target, 'utf8'));
    const values = parsed?.values && typeof parsed.values === 'object' && !Array.isArray(parsed.values)
      ? parsed.values
      : {};
    return { found: true, values };
  } catch (error) {
    log(`renderer storage read failed: ${error.message || String(error)}`);
    return { found: false, values: {} };
  }
}

function writeJsonAtomically(target, value) {
  const tempPath = `${target}.${process.pid}.tmp`;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(tempPath, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tempPath, target);
}

function writeRendererStorageSnapshot(values) {
  const sanitized = {};
  const source = values && typeof values === 'object' && !Array.isArray(values) ? values : {};
  Object.entries(source).forEach(([key, value]) => {
    if (typeof key !== 'string' || typeof value !== 'string') return;
    if (key === 'outlook_emails' || value.length > 2_000_000) return;
    sanitized[key] = value;
  });
  writeJsonAtomically(rendererStoragePath(), {
    format: 'unique-mail-renderer-storage-v1',
    savedAt: new Date().toISOString(),
    values: sanitized
  });
  return Object.keys(sanitized).length;
}

ipcMain.on('native:renderer-storage-load', (event) => {
  event.returnValue = readRendererStorageSnapshot();
});

ipcMain.on('native:renderer-storage-save', (event, values) => {
  try {
    event.returnValue = { ok: true, count: writeRendererStorageSnapshot(values) };
  } catch (error) {
    log(`renderer storage write failed: ${error.message || String(error)}`);
    event.returnValue = { ok: false, error: error.message || String(error) };
  }
});

function sanitizeDownloadFilename(filename) {
  const clean = String(filename || 'anlage.bin').replace(/[\\/:*?"<>|]/g, '_').trim();
  return clean || 'anlage.bin';
}

function resolveDownloadDirectory(preferredDirectory) {
  const candidate = String(preferredDirectory || '').trim();
  return candidate || app.getPath('downloads');
}

function uniqueDownloadPath(directory, filename) {
  fs.mkdirSync(directory, { recursive: true });
  const parsed = path.parse(sanitizeDownloadFilename(filename));
  let target = path.join(directory, parsed.base);
  let counter = 1;
  while (fs.existsSync(target)) {
    target = path.join(directory, `${parsed.name} (${counter})${parsed.ext}`);
    counter += 1;
  }
  return target;
}

function writeAttachmentToDisk(attachment, directory) {
  if (!attachment || !attachment.contentBase64) throw new Error('Anlage enthaelt keine lokal geladenen Daten.');
  const targetPath = uniqueDownloadPath(directory, attachment.filename);
  fs.writeFileSync(targetPath, Buffer.from(String(attachment.contentBase64), 'base64'));
  return targetPath;
}

function dragOutDirectory() {
  const target = path.join(uniqueMailDataPaths?.cacheDir || app.getPath('temp'), 'DragOut');
  fs.mkdirSync(target, { recursive: true });
  return target;
}

function resolveAppIconPath() {
  const candidates = [
    path.join(__dirname, 'assets', 'icon.ico'),
    path.join(process.resourcesPath || '', 'electron', 'assets', 'icon.ico')
  ];
  return candidates.find(candidate => candidate && fs.existsSync(candidate)) || candidates[0];
}

function compareSemverLike(a, b) {
  const pa = String(a || '').split(/[.-]/).map(part => parseInt(part, 10) || 0);
  const pb = String(b || '').split(/[.-]/).map(part => parseInt(part, 10) || 0);
  const max = Math.max(pa.length, pb.length, 3);
  for (let i = 0; i < max; i += 1) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

function updateFeedConfigCandidates() {
  const candidates = [];
  if (process.env.UNIQUE_MAIL_UPDATE_FEED_URL) candidates.push(process.env.UNIQUE_MAIL_UPDATE_FEED_URL);
  const settingsDir = uniqueMailDataPaths?.settingsDir || app.getPath('userData');
  const installDir = path.dirname(process.execPath || '');
  [
    path.join(settingsDir, 'update-feed-url.txt'),
    path.join(settingsDir, 'latest.json'),
    path.join(installDir, 'update-feed-url.txt'),
    path.join(installDir, 'latest.json')
  ].forEach(candidate => candidates.push(candidate));
  candidates.push(DEFAULT_UPDATE_FEED_URL);
  return candidates;
}

function readConfiguredUpdateFeedLocation() {
  for (const candidate of updateFeedConfigCandidates()) {
    try {
      if (!candidate) continue;
      if (/^https?:\/\//i.test(candidate) || /^file:\/\//i.test(candidate)) return candidate.trim();
      if (fs.existsSync(candidate)) {
        if (candidate.toLowerCase().endsWith('.json')) return candidate;
        const value = fs.readFileSync(candidate, 'utf8').trim();
        if (value) return value;
      }
    } catch (error) {
      log(`update feed candidate skipped: ${error.message || String(error)}`);
    }
  }
  return '';
}

function requestBufferFromUrl(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error('Zu viele Weiterleitungen beim Update-Download.'));
    const client = /^https:/i.test(url) ? https : http;
    const request = client.get(url, { timeout: 30000, headers: { 'User-Agent': `Unique-Mail/${app.getVersion()}` } }, (response) => {
      const location = response.headers.location;
      if ([301, 302, 303, 307, 308].includes(response.statusCode || 0) && location) {
        response.resume();
        const nextUrl = new URL(location, url).toString();
        requestBufferFromUrl(nextUrl, redirectCount + 1).then(resolve, reject);
        return;
      }
      if ((response.statusCode || 0) < 200 || (response.statusCode || 0) >= 300) {
        response.resume();
        reject(new Error(`Update-Server antwortete mit HTTP ${response.statusCode}.`));
        return;
      }
      const chunks = [];
      response.on('data', chunk => chunks.push(Buffer.from(chunk)));
      response.on('end', () => resolve(Buffer.concat(chunks)));
    });
    request.on('timeout', () => request.destroy(new Error('Update-Server hat nicht rechtzeitig geantwortet.')));
    request.on('error', reject);
  });
}

async function readBufferFromLocation(location) {
  const target = String(location || '').trim();
  if (!target) throw new Error('Keine Update-Feed-URL konfiguriert.');
  if (/^https?:\/\//i.test(target)) return requestBufferFromUrl(target);
  if (/^file:\/\//i.test(target)) return fs.readFileSync(new URL(target));
  return fs.readFileSync(target);
}

function emitUpdateProgress(payload) {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('native:update-progress', payload);
    }
  } catch (error) {
    log(`update progress event failed: ${error.message || String(error)}`);
  }
}

function downloadHttpToFile(url, targetPath, onProgress, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error('Zu viele Weiterleitungen beim Update-Download.'));
      return;
    }
    const client = /^https:/i.test(url) ? https : http;
    const request = client.get(url, { timeout: 30000, headers: { 'User-Agent': `Unique-Mail/${app.getVersion()}` } }, response => {
      const location = response.headers.location;
      if ([301, 302, 303, 307, 308].includes(response.statusCode || 0) && location) {
        response.resume();
        downloadHttpToFile(new URL(location, url).toString(), targetPath, onProgress, redirectCount + 1).then(resolve, reject);
        return;
      }
      if ((response.statusCode || 0) < 200 || (response.statusCode || 0) >= 300) {
        response.resume();
        reject(new Error(`Update-Server antwortete mit HTTP ${response.statusCode}.`));
        return;
      }

      const totalBytes = Number(response.headers['content-length']) || 0;
      let receivedBytes = 0;
      let lastPercent = -1;
      const output = fs.createWriteStream(targetPath, { flags: 'w' });
      const fail = error => {
        try { output.destroy(); } catch {}
        try { fs.rmSync(targetPath, { force: true }); } catch {}
        reject(error);
      };
      response.on('data', chunk => {
        receivedBytes += chunk.length;
        const percent = totalBytes > 0 ? Math.min(100, Math.floor((receivedBytes / totalBytes) * 100)) : 0;
        if (percent !== lastPercent) {
          lastPercent = percent;
          onProgress({ receivedBytes, totalBytes, percent });
        }
      });
      response.on('error', fail);
      output.on('error', fail);
      output.on('finish', () => {
        output.close(() => {
          onProgress({ receivedBytes, totalBytes: totalBytes || receivedBytes, percent: 100 });
          resolve({ receivedBytes, totalBytes: totalBytes || receivedBytes });
        });
      });
      response.pipe(output);
    });
    request.on('timeout', () => request.destroy(new Error('Update-Server hat nicht rechtzeitig geantwortet.')));
    request.on('error', reject);
  });
}

function copyLocalUpdateToFile(sourcePath, targetPath, onProgress) {
  return new Promise((resolve, reject) => {
    const totalBytes = fs.statSync(sourcePath).size;
    let receivedBytes = 0;
    let lastPercent = -1;
    const input = fs.createReadStream(sourcePath);
    const output = fs.createWriteStream(targetPath, { flags: 'w' });
    const fail = error => {
      try { input.destroy(); } catch {}
      try { output.destroy(); } catch {}
      try { fs.rmSync(targetPath, { force: true }); } catch {}
      reject(error);
    };
    input.on('data', chunk => {
      receivedBytes += chunk.length;
      const percent = totalBytes > 0 ? Math.min(100, Math.floor((receivedBytes / totalBytes) * 100)) : 100;
      if (percent !== lastPercent) {
        lastPercent = percent;
        onProgress({ receivedBytes, totalBytes, percent });
      }
    });
    input.on('error', fail);
    output.on('error', fail);
    output.on('finish', () => output.close(() => resolve({ receivedBytes, totalBytes })));
    input.pipe(output);
  });
}

async function downloadUpdateToFile(location, targetPath, onProgress) {
  const source = String(location || '').trim();
  if (/^https?:\/\//i.test(source)) return downloadHttpToFile(source, targetPath, onProgress);
  const localPath = /^file:\/\//i.test(source) ? new URL(source) : source;
  return copyLocalUpdateToFile(localPath, targetPath, onProgress);
}

function calculateFileSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const input = fs.createReadStream(filePath);
    input.on('data', chunk => hash.update(chunk));
    input.on('error', reject);
    input.on('end', () => resolve(hash.digest('hex')));
  });
}

function cleanupStaleUpdateFiles() {
  try {
    const updatesDir = path.join(app.getPath('temp'), 'Unique Mail', 'Updates');
    if (!fs.existsSync(updatesDir)) return;
    const minimumAgeMs = 60 * 1000;
    for (const entry of fs.readdirSync(updatesDir, { withFileTypes: true })) {
      if (!entry.isFile() || !/\.(?:exe|ps1|cmd)$/i.test(entry.name)) continue;
      const target = path.join(updatesDir, entry.name);
      try {
        if (Date.now() - fs.statSync(target).mtimeMs < minimumAgeMs) continue;
        fs.rmSync(target, { force: true });
        log(`stale update file removed: ${target}`);
      } catch (error) {
        log(`stale update cleanup skipped: ${target}: ${error.message || String(error)}`);
      }
    }
  } catch (error) {
    log(`stale update cleanup failed: ${error.message || String(error)}`);
  }
}

async function checkForUniqueMailUpdate() {
  const currentVersion = app.getVersion();
  const feedLocation = readConfiguredUpdateFeedLocation();
  if (!feedLocation) {
    return { ok: true, configured: false, updateAvailable: false, currentVersion, message: 'Kein Update-Feed konfiguriert.' };
  }

  const raw = await readBufferFromLocation(feedLocation);
  const manifest = JSON.parse(raw.toString('utf8').replace(/^\uFEFF/, ''));
  const latestVersion = String(manifest.version || manifest.latestVersion || '').trim();
  const downloadUrl = String(manifest.url || manifest.downloadUrl || manifest.installerUrl || '').trim();
  if (!latestVersion || !downloadUrl) {
    throw new Error('Update-Feed muss version und url/downloadUrl enthalten.');
  }

  const updateAvailable = compareSemverLike(latestVersion, currentVersion) > 0;
  lastKnownUpdate = updateAvailable ? {
    version: latestVersion,
    url: new URL(downloadUrl, /^https?:\/\//i.test(feedLocation) ? feedLocation : `file://${feedLocation}`).toString(),
    sha256: String(manifest.sha256 || manifest.checksumSha256 || '').trim().toLowerCase(),
    notes: String(manifest.notes || manifest.changelog || '').trim(),
    publishedAt: manifest.publishedAt || manifest.date || null
  } : null;

  return {
    ok: true,
    configured: true,
    updateAvailable,
    currentVersion,
    latestVersion,
    update: lastKnownUpdate,
    message: updateAvailable ? `Version ${latestVersion} ist verfuegbar.` : 'Unique Mail ist aktuell.'
  };
}

async function downloadAndOpenUniqueMailUpdate() {
  emitUpdateProgress({ phase: 'checking', percent: 0, message: 'Update wird vorbereitet...' });
  const update = lastKnownUpdate || (await checkForUniqueMailUpdate()).update;
  if (!update?.url) throw new Error('Kein Update zum Herunterladen verfuegbar.');
  const updatesDir = path.join(app.getPath('temp'), 'Unique Mail', 'Updates');
  fs.mkdirSync(updatesDir, { recursive: true });
  const updatePathname = /^https?:\/\//i.test(update.url) || /^file:\/\//i.test(update.url)
    ? decodeURIComponent(new URL(update.url).pathname)
    : update.url;
  const parsedName = sanitizeDownloadFilename(path.basename(updatePathname) || `Unique Mail Setup ${update.version}.exe`);
  const filename = parsedName.toLowerCase().endsWith('.exe') ? parsedName : `Unique Mail Setup ${update.version}.exe`;
  const targetPath = uniqueDownloadPath(updatesDir, filename);
  const downloadResult = await downloadUpdateToFile(update.url, targetPath, progress => {
    emitUpdateProgress({ phase: 'downloading', version: update.version, ...progress });
  });
  if (downloadResult.receivedBytes < 1024 * 1024) {
    try { fs.rmSync(targetPath, { force: true }); } catch {}
    throw new Error('Der Update-Download ist ungewoehnlich klein und wird aus Sicherheitsgruenden nicht gestartet.');
  }
  emitUpdateProgress({ phase: 'verifying', percent: 100, version: update.version, message: 'Download wird geprueft...' });
  if (update.sha256) {
    const actualSha256 = await calculateFileSha256(targetPath);
    if (actualSha256 !== update.sha256) {
      try { fs.rmSync(targetPath, { force: true }); } catch {}
      throw new Error('Die SHA-256-Pruefsumme des Updates stimmt nicht. Der Installer wird nicht gestartet.');
    }
  }

  emitUpdateProgress({ phase: 'launching', percent: 100, version: update.version, message: 'Installer wird geoeffnet...' });
  const installerProcess = await new Promise((resolve, reject) => {
    const child = spawn(targetPath, [], { detached: true, stdio: 'ignore', windowsHide: false });
    child.once('spawn', () => resolve(child));
    child.once('error', reject);
  });
  installerProcess.unref();

  const helperLogPath = path.join(uniqueMailDataPaths?.logsDir || app.getPath('userData'), 'update-helper.log');
  const cleanupScriptPath = path.join(updatesDir, `cleanup-${Date.now()}.cmd`);
  const cleanupScript = [
    '@echo off',
    'setlocal EnableExtensions DisableDelayedExpansion',
    'set "installer=%~1"',
    'set "installerPid=%~2"',
    'set "log=%~3"',
    '>>"%log%" echo [%date% %time%] Cleanup gestartet fuer PID %installerPid%',
    ':waitForInstaller',
    'tasklist /FI "PID eq %installerPid%" /NH 2^>NUL | findstr /C:"%installerPid%" ^>NUL',
    'if not errorlevel 1 (',
    '  timeout /t 2 /nobreak >NUL',
    '  goto waitForInstaller',
    ')',
    'timeout /t 3 /nobreak >NUL',
    'for /L %%A in (1,1,60) do (',
    '  del /f /q "%installer%" 2>NUL',
    '  if not exist "%installer%" goto installerRemoved',
    '  timeout /t 1 /nobreak >NUL',
    ')',
    '>>"%log%" echo [%date% %time%] Installer konnte nicht entfernt werden: %installer%',
    'goto cleanupFinished',
    ':installerRemoved',
    '>>"%log%" echo [%date% %time%] Installer entfernt: %installer%',
    ':cleanupFinished',
    'del /f /q "%~f0" 2>NUL',
    'exit /b 0'
  ].join('\r\n');
  fs.writeFileSync(cleanupScriptPath, cleanupScript, 'ascii');
  try {
    const cleanupProcess = spawn('cmd.exe', [
      '/d', '/c', 'call', cleanupScriptPath, targetPath, String(installerProcess.pid), helperLogPath
    ], { detached: true, stdio: 'ignore', windowsHide: true });
    cleanupProcess.unref();
    log(`update cleanup helper launched: pid=${cleanupProcess.pid} script=${cleanupScriptPath}`);
  } catch (error) {
    log(`update cleanup helper failed: ${error.message || String(error)}`);
  }

  log(`update installer launched directly: pid=${installerProcess.pid} path=${targetPath}`);
  emitUpdateProgress({ phase: 'launched', percent: 100, version: update.version, message: 'Installer ist geoeffnet.' });
  setTimeout(() => app.quit(), 1800);
  return { ok: true, filePath: targetPath, version: update.version, installerPid: installerProcess.pid, cleanupScheduled: true };
}

function log(message) {
  try {
    const logDir = uniqueMailDataPaths?.logsDir || app.getPath('userData');
    fs.mkdirSync(logDir, { recursive: true });
    const logPath = path.join(logDir, 'startup.log');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`);
  } catch {
    // Startup logging must never block the app.
  }
}

function resolveServerPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app', 'dist', 'server.cjs');
  }

  return path.join(__dirname, '..', 'dist', 'server.cjs');
}

function waitForServer(retries = 50) {
  return new Promise((resolve, reject) => {
    const check = (remaining) => {
      const req = http.get(`http://127.0.0.1:${PORT}/api/health`, (res) => {
        res.resume();
        resolve();
      });

      req.on('error', () => {
        if (remaining <= 0) {
          reject(new Error('Der lokale Unique-Mail-Server konnte nicht gestartet werden.'));
          return;
        }
        setTimeout(() => check(remaining - 1), 200);
      });

      req.setTimeout(1000, () => {
        req.destroy();
      });
    };

    check(retries);
  });
}

function startServer() {
  const serverPath = resolveServerPath();
  const appRoot = path.dirname(path.dirname(serverPath));
  log(`Starting server: ${serverPath}`);
  log(`Server cwd: ${appRoot}`);

  return new Promise((resolve, reject) => {
    let settled = false;
    let stdoutBuffer = '';
    const startupTimeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('Der lokale Unique-Mail-Server hat keinen freien Port gemeldet.'));
    }, 20000);

    serverProcess = spawn(process.execPath, [serverPath], {
      cwd: appRoot,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        ELECTRON_RUN_AS_NODE: '1',
        PORT: '0',
        UNIQUE_MAIL_DATA_ROOT: uniqueMailDataPaths?.dataRoot || app.getPath('userData'),
        UNIQUE_MAIL_SETTINGS_DIR: uniqueMailDataPaths?.settingsDir || app.getPath('userData'),
        UNIQUE_MAIL_CACHE_DIR: uniqueMailDataPaths?.mailStoreDir || path.join(app.getPath('userData'), 'mail-cache')
      },
      stdio: 'pipe',
      windowsHide: true
    });

    serverProcess.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdoutBuffer += text;
      log(`server stdout: ${text.trim()}`);
      const match = stdoutBuffer.match(/Server running on http:\/\/(?:localhost|127\.0\.0\.1):(\d+)/i);
      if (!settled && match) {
        PORT = Number(match[1]);
        settled = true;
        clearTimeout(startupTimeout);
        log(`Local server selected port ${PORT}`);
        resolve(PORT);
      }
      if (stdoutBuffer.length > 4096) stdoutBuffer = stdoutBuffer.slice(-2048);
    });
    serverProcess.stderr.on('data', (chunk) => log(`server stderr: ${chunk.toString().trim()}`));
    serverProcess.on('error', (error) => {
      log(`server error: ${error.message}`);
      if (!settled) {
        settled = true;
        clearTimeout(startupTimeout);
        reject(error);
      }
    });
    serverProcess.on('exit', (code, signal) => {
      log(`server exit: code=${code} signal=${signal}`);
      if (!settled) {
        settled = true;
        clearTimeout(startupTimeout);
        reject(new Error(`Der lokale Unique-Mail-Server wurde vorzeitig beendet (Code ${code ?? 'unbekannt'}).`));
      }
    });
  });
}

async function createWindow() {
  try {
    await startServer();
    await waitForServer();
  } catch (error) {
    dialog.showErrorBox('Unique Mail konnte nicht starten', error.message);
    app.quit();
    return;
  }

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: '#f3f2f1',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    title: 'Unique Mail',
    resizable: true,
    maximizable: true,
    fullscreenable: true,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow = win;
  const focusRenderer = () => {
    setTimeout(() => {
      if (!win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.focus();
    }, 0);
  };
  win.on('focus', focusRenderer);
  win.on('show', focusRenderer);
  win.on('restore', focusRenderer);
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });

  win.setMenuBarVisibility(false);

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (url && !url.startsWith(`http://127.0.0.1:${PORT}`)) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) shell.openExternal(url);
    }
  });

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    log(`renderer did-fail-load: code=${errorCode} url=${validatedURL} description=${errorDescription}`);
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    log(`renderer process gone: reason=${details.reason} exitCode=${details.exitCode}`);
  });
  win.webContents.on('preload-error', (_event, preloadPath, error) => {
    log(`preload error: path=${preloadPath} error=${error?.stack || error}`);
  });
  win.webContents.on('console-message', (_event, details) => {
    const message = typeof details === 'object' ? details.message : String(details || '');
    const level = typeof details === 'object' ? details.level : 'unknown';
    if (level === 'error' || /error|uncaught|exception/i.test(message)) {
      log(`renderer console ${level}: ${message}`);
    }
  });


  await win.loadURL(`http://127.0.0.1:${PORT}`);

  await win.webContents.insertCSS(`
    #unique-window-drag-strip {
      position: fixed;
      top: 0;
      left: 0;
      right: 400px;
      height: 12px;
      z-index: 2147483646;
      -webkit-app-region: drag;
      background: transparent;
    }
    #unique-window-close-button,
    #unique-window-maximize-button,
    #unique-window-minimize-button,
    #unique-window-update-button,
    #unique-window-history-button,
    #unique-window-feature-button,
    #unique-window-bug-button {
      position: fixed;
      top: 6px;
      z-index: 2147483647;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      -webkit-app-region: no-drag;
      letter-spacing: 0;
      transition: background 140ms ease, color 140ms ease, border-color 140ms ease, transform 140ms ease, box-shadow 140ms ease, filter 140ms ease;
    }
    #unique-window-close-button,
    #unique-window-maximize-button,
    #unique-window-minimize-button {
      width: 28px;
      border: 1px solid rgba(15, 23, 42, 0.18);
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.92);
      color: #0f172a;
      box-shadow: 0 1px 4px rgba(15, 23, 42, 0.16);
    }
    #unique-window-close-button { right: 10px; font: 800 15px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    #unique-window-maximize-button { right: 44px; font: 900 13px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    #unique-window-minimize-button { right: 78px; font: 900 17px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    #unique-window-history-button {
      right: 112px;
      width: 54px;
      border-radius: 999px;
      border: 1px solid rgba(14, 165, 233, 0.6);
      background: linear-gradient(135deg, #22c55e, #0ea5e9);
      color: #ffffff;
      font: 900 11px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      box-shadow: 0 2px 10px rgba(14, 165, 233, 0.38);
    }
    #unique-window-bug-button,
    #unique-window-feature-button,
    #unique-window-update-button {
      border-radius: 999px;
      border: 1px solid rgba(15, 23, 42, 0.16);
      color: #ffffff;
      font: 900 10px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      padding: 0 10px;
      box-shadow: 0 2px 10px rgba(15, 23, 42, 0.2);
      white-space: nowrap;
    }
    #unique-window-bug-button {
      right: 174px;
      width: 84px;
      background: linear-gradient(135deg, #f97316, #dc2626);
      border-color: rgba(248, 113, 113, 0.65);
    }
    #unique-window-feature-button {
      right: 266px;
      width: 122px;
      background: linear-gradient(135deg, #8b5cf6, #2563eb);
      border-color: rgba(129, 140, 248, 0.65);
    }
    #unique-window-update-button {
      right: 398px;
      width: 142px;
      display: none;
      --update-progress: 0%;
      overflow: hidden;
      isolation: isolate;
      background: #d1d5db;
      border-color: rgba(251, 191, 36, 0.8);
      color: #111827;
    }
    #unique-window-update-button::before {
      content: "";
      position: absolute;
      inset: 0 auto 0 0;
      z-index: -1;
      width: var(--update-progress);
      background: linear-gradient(90deg, #22c55e, #0ea5e9);
      transition: width 220ms ease;
    }
    #unique-window-update-button[data-visible="true"] {
      display: flex;
    }
    #unique-window-update-button[data-phase="available"] {
      background: linear-gradient(135deg, #fde047, #fb923c);
      animation: uniqueUpdateAttention 1.8s ease-in-out infinite;
    }
    #unique-window-update-button[data-phase="available"]::before {
      width: 0;
    }
    #unique-window-update-button[data-phase="checking"] {
      animation: uniqueUpdateWaiting 900ms ease-in-out infinite alternate;
    }
    #unique-window-update-button[data-phase="downloading"],
    #unique-window-update-button[data-phase="verifying"],
    #unique-window-update-button[data-phase="launching"],
    #unique-window-update-button[data-phase="launched"] {
      animation: none;
    }
    #unique-window-update-button[data-phase="launched"]::before {
      width: 100%;
      background: #22c55e;
    }
    #unique-window-update-button:disabled {
      opacity: 1;
      cursor: wait;
    }
    @keyframes uniqueUpdateAttention {
      0%, 55%, 100% { box-shadow: 0 2px 10px rgba(251, 191, 36, 0.42); transform: translateY(0) rotate(0) scale(1); }
      28% { box-shadow: 0 4px 25px rgba(249, 115, 22, 0.9); transform: translateY(-1px) rotate(0) scale(1.075); }
      62% { transform: translateY(0) rotate(-5deg) scale(1.04); }
      68% { transform: translateY(0) rotate(5deg) scale(1.04); }
      74% { transform: translateY(0) rotate(-4deg) scale(1.04); }
      80% { transform: translateY(0) rotate(4deg) scale(1.04); }
      86% { box-shadow: 0 4px 22px rgba(249, 115, 22, 0.72); transform: translateY(0) rotate(0) scale(1.04); }
    }
    @keyframes uniqueUpdateWaiting {
      from { box-shadow: 0 2px 8px rgba(14, 165, 233, 0.25); }
      to { box-shadow: 0 3px 18px rgba(14, 165, 233, 0.72); }
    }
    #unique-window-minimize-button:hover,
    #unique-window-maximize-button:hover {
      background: #e2e8f0;
      color: #0f172a;
      transform: translateY(-1px);
      box-shadow: 0 3px 8px rgba(15, 23, 42, 0.18);
    }
    #unique-window-bug-button:hover,
    #unique-window-feature-button:hover,
    #unique-window-update-button:hover {
      transform: translateY(-1px) scale(1.03);
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.3);
      filter: brightness(1.04);
    }
    #unique-window-history-button:hover {
      background: linear-gradient(135deg, #16a34a, #0284c7);
      color: #ffffff;
      transform: translateY(-1px) scale(1.03);
      box-shadow: 0 4px 14px rgba(14, 165, 233, 0.46);
    }
    #unique-window-close-button:hover {
      background: #dc2626;
      color: #ffffff;
      border-color: #dc2626;
      transform: translateY(-1px);
      box-shadow: 0 3px 8px rgba(220, 38, 38, 0.24);
    }    #unique-version-history-backdrop {
      position: fixed;
      inset: 0;
      z-index: 2147483645;
      display: none;
      align-items: flex-start;
      justify-content: flex-end;
      padding: 48px 24px 24px;
      background: rgba(15, 23, 42, 0.28);
      -webkit-app-region: no-drag;
    }
    #unique-version-history-backdrop[data-open="true"] {
      display: flex;
    }
    #unique-version-history-dialog {
      width: min(520px, calc(100vw - 48px));
      max-height: calc(100vh - 72px);
      overflow: auto;
      border: 1px solid rgba(14, 165, 233, 0.28);
      border-radius: 14px;
      background: #ffffff;
      color: #0f172a;
      box-shadow: 0 24px 70px rgba(15, 23, 42, 0.28);
      font: 12px/1.5 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    #unique-version-history-dialog header {
      position: sticky;
      top: 0;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 16px;
      border-bottom: 1px solid #dbeafe;
      background: linear-gradient(135deg, #ecfeff, #eff6ff);
    }
    #unique-version-history-dialog h2,
    #unique-version-history-dialog h3,
    #unique-version-history-dialog p {
      margin: 0;
    }
    #unique-version-history-dialog h2 {
      font-size: 15px;
      font-weight: 900;
      letter-spacing: 0;
    }
    #unique-version-history-close {
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      background: #ffffff;
      color: #0f172a;
      width: 30px;
      height: 28px;
      cursor: pointer;
      font-weight: 900;
    }
    #unique-version-history-close:hover {
      background: #dbeafe;
    }
    .unique-version-history-body {
      padding: 14px 16px 18px;
    }
    .unique-version-entry {
      padding: 12px 0;
      border-bottom: 1px solid #e2e8f0;
    }
    .unique-version-entry:last-child {
      border-bottom: 0;
    }
    .unique-version-entry h3 {
      font-size: 12px;
      font-weight: 900;
      color: #075985;
    }
    .unique-version-entry ul {
      margin: 8px 0 0 16px;
      padding: 0;
    }
    .unique-version-entry li {
      margin: 4px 0;
    }
    .unique-version-current {
      display: inline-flex;
      margin-left: 8px;
      padding: 2px 6px;
      border-radius: 999px;
      background: #dcfce7;
      color: #166534;
      font-size: 10px;
      font-weight: 900;
    }
  `);

  try {
    const windowControlsResult = await win.webContents.executeJavaScript(`
    (() => {
      try {
      if (!document.getElementById('unique-window-drag-strip')) {
        const drag = document.createElement('div');
        drag.id = 'unique-window-drag-strip';
        document.body.appendChild(drag);
      }

      const ensureVersionHistoryDialog = () => {
        let backdrop = document.getElementById('unique-version-history-backdrop');
        if (backdrop) return backdrop;
        backdrop = document.createElement('div');
        backdrop.id = 'unique-version-history-backdrop';
        backdrop.setAttribute('data-open', 'false');
        backdrop.innerHTML = [
          '<section id="unique-version-history-dialog" role="dialog" aria-modal="true" aria-labelledby="unique-version-history-title">',
          '<header><div><h2 id="unique-version-history-title">Versionsverlauf</h2><p>Bugfixes, neue Funktionen und wichtige Aenderungen.</p></div><button id="unique-version-history-close" type="button" aria-label="Versionsverlauf schliessen">x</button></header>',
          '<div class="unique-version-history-body">',
          '<article class="unique-version-entry"><h3>Version 0.4.35 <span class="unique-version-current">aktuell</span></h3><ul><li>HTML-Mails werden in einem skriptlosen, isolierten Dokument gerendert; Newsletter-CSS kann Ribbon, Ordnerbaum und Nachrichtenliste nicht mehr veraendern.</li><li>Breite oder fehlerhafte Mail-Layouts werden auf die Lesebereichsbreite begrenzt und koennen keine App-Spalte mehr zusammendruecken.</li><li>Ribbon und Hauptspalten besitzen feste Flex-Grenzen; bei Platzmangel scrollt das Ribbon, statt Bedienelemente unlesbar zu stauchen.</li><li>Im Ordnerbaum steht entweder der benutzerdefinierte Kontoname oder die E-Mail-Adresse; bei einem Kontonamen erscheint die Adresse nur noch als Hover-Hinweis.</li><li>Der Doppelklick auf einen Kalendertag oeffnet zuverlaessig das angedockte Terminformular und speichert den Eintrag dauerhaft.</li></ul></article>',
          '<article class="unique-version-entry"><h3>Version 0.3.35</h3><ul><li>Appweiter Fokusfehler bei Eingabefeldern behoben: Fensteraktivierung, Renderer-Fokus und editierbare Felder werden zuverlaessig synchronisiert.</li><li>Spezielle Konto-Eventblocker entfernt; Eingaben sind ausdruecklich als nicht ziehbare Textbereiche markiert.</li><li>Backup-Passwort ist optional: Exporte ohne Passwort enthalten alle Einstellungen, aber keine Kontopasswoerter; kennwortfreie JSON-Dateien lassen sich ohne Passwort importieren.</li></ul></article>',
          '<article class="unique-version-entry"><h3>Version 0.3.34</h3><ul><li>Update-Installer wird nach dem Download direkt und sichtbar gestartet; der fehlerhafte versteckte PowerShell-Start wurde entfernt.</li><li>Der Update-Button pulsiert und wackelt bei verfuegbaren Updates und zeigt den echten Downloadfortschritt als Fuellbalken.</li><li>Ein separater Aufraeumhelfer loescht den Installer erst nach dessen Abschluss und protokolliert den Ablauf.</li></ul></article>',
          '<article class="unique-version-entry"><h3>Version 0.3.33</h3><ul><li>Importierte Konten und Einstellungen werden portunabhaengig unter Data/Settings gesichert und vor dem Start der Oberflaeche wiederhergestellt.</li><li>Kontopasswoerter werden mit einem frei waehlbaren Backup-Passwort per AES-256-GCM uebertragbar verschluesselt und auf dem Ziel-PC erneut im Windows-Passwortspeicher abgelegt.</li><li>Import prueft Passwortcontainer und dauerhafte Speicherung; Anzeigenamen, Serveroptionen und Ordnermetadaten bleiben vollstaendiger erhalten.</li></ul></article>',
          '<article class="unique-version-entry"><h3>Version 0.3.32</h3><ul><li>Whitescreen-Ursache beseitigt: jede App-Instanz startet ihren lokalen Server auf einem freien Port; Doppelstarts werden auf das bestehende Fenster umgeleitet.</li><li>Grundlayout erscheint vor grossen Maildaten; Cache, Nachrichtentexte, Versand, Verschieben und Wartungssync laufen priorisiert und nacheinander im Hintergrund.</li><li>React-Fehleransicht statt leerem Fenster sowie GitHub-Releases-Feed und automatischer Release-Workflow ergaenzt.</li></ul></article>',
          '<article class="unique-version-entry"><h3>Version 0.3.31</h3><ul><li>Heruntergeladene Updates werden automatisch gestartet und nach Abschluss des Installers aus dem temporaeren Update-Ordner entfernt.</li><li>Optionaler SHA-256-Abgleich schuetzt vor unvollstaendigen oder manipulierten Installer-Downloads.</li><li>Erststarts enthalten keine vordefinierten Ordnerfavoriten mehr; entfernte Favoriten bleiben dauerhaft entfernt.</li></ul></article>',
          '<article class="unique-version-entry"><h3>Version 0.3.30</h3><ul><li>Update-Hinweis vorbereitet: Unique Mail kann beim Start einen konfigurierten latest.json-Feed pruefen und bei neuer Version einen auffaelligen Update-Button anzeigen.</li><li>Update-Button laedt den verlinkten Installer in den Downloads-Ordner und startet ihn zur Aktualisierung.</li><li>Mailversand blockiert den Compose-Dialog nicht mehr: Nachrichten gehen sofort in den Postausgang, SMTP/IMAP laufen danach im Hintergrund.</li></ul></article><article class="unique-version-entry"><h3>Version 0.3.29</h3><ul><li>Echte virtuelle Nachrichtenliste: grosse Ordner rendern nur sichtbare Mail-Zeilen plus Puffer statt hunderte oder tausende DOM-Elemente.</li><li>Ordnerwechsel, Scrollen und Mailauswahl reagieren dadurch bei sehr grossen Postfaechern spuerbar direkter.</li><li>Darkmode-Kontrast fuer Ribbon, Nachrichtenliste, Lesebereich, Warnbanner und HTML-Mail-Inhalte verbessert.</li></ul></article><article class="unique-version-entry"><h3>Version 0.3.28</h3><ul><li>Nachrichtenliste rendert grosse Ordner progressiv statt tausende Mail-Zeilen gleichzeitig in den DOM zu laden.</li><li>Beim Scrollen werden weitere Nachrichten nachgeladen; Ordnerwechsel und erste Auswahl reagieren dadurch schneller.</li><li>Automatischer Nach-Sync wird staerker gebuendelt und auf betroffene Konten begrenzt, damit Aktionen nicht dauernd volle Postfaecher neu abfragen.</li></ul></article><article class="unique-version-entry"><h3>Version 0.3.27</h3><ul><li>Automatischer Hintergrundsync nach Mail-Interaktionen: Senden, Loeschen, Archivieren, Verschieben, Lesen/Ungelesen und lokale Markierungen stossen einen Serverabgleich an.</li><li>Der Nach-Sync nutzt gespeicherte Kontopasswoerter ohne neue Passwort-Popups und prueft zugleich auf neue Mails und Serverordner.</li><li>Ordnerbaum beschleunigt: ungelesene Zaehler und lokale Ordnerpfade werden memoisiert, Klick-Animationen im Tree sind leichter.</li></ul></article><article class="unique-version-entry"><h3>Version 0.3.26</h3><ul><li>Appweite Mojibake- und Umlautfehler in sichtbaren Einstellungen, Menues, QuickSteps und Compose-Texten bereinigt.</li><li>App-Passwort in den Reiter Allgemein verschoben und Einstellungsbereiche dort deutlicher getrennt.</li><li>Interner Encoding-Filter bleibt erhalten, nutzt aber keine kaputten Literalzeichen mehr im Quelltext.</li></ul></article><article class="unique-version-entry"><h3>Version 0.3.25</h3><ul><li>App-Passwort ergaenzt: einmalige Abfrage beim Oeffnen der App.</li><li>App-Passwort kann gesetzt, geaendert und entfernt werden; Mindestlaenge 4 Zeichen, Buchstaben/Zahlen.</li><li>App-Passwort wird als Salt+Hash gespeichert, bleibt bei Updates erhalten und wird im Einstellungs-Export uebernommen.</li></ul></article><article class="unique-version-entry"><h3>Version 0.3.20</h3><ul><li>Feature Request und Bug Report stehen kompakt neben dem Versionsbutton und zeigen den vollstaendigen Text.</li><li>Minimieren, Maximieren und Beenden sind wieder dauerhaft sichtbar, nicht nur beim Hover.</li><li>Umlaut-/Mojibake-Fehler in sichtbaren Menues und Schaltflaechen bereinigt.</li><li>Kontoname pro Postfach ergaenzt und als Absendername fuer neue Mails verwendet.</li></ul></article><article class="unique-version-entry"><h3>Version 0.3.18</h3><ul><li>Installer-Generation fuer die 0.3.x-Reihe stabilisiert.</li><li>Kleinere Desktop-Overlay- und Versionsverlaufsanpassungen vorbereitet.</li></ul></article><article class="unique-version-entry"><h3>Version 0.3.17</h3><ul><li>Kontopasswoerter werden nach Eingabe lokal verschluesselt gespeichert und beim naechsten Start wiederverwendet.</li><li>Anhang-Vorschau im Lesebereich repariert; PDF-Dateien werden per Object/Iframe-Fallback angezeigt.</li><li>Anhangsymbol in der Nachrichtenliste dauerhaft neben dem Datum sichtbar.</li><li>Mailauswahl reagiert fluessiger durch memoisiertes HTML-Rendering und schnellere Link-/Bildbindung.</li></ul></article>',
          '<article class="unique-version-entry"><h3>Version 0.3.16</h3><ul><li>Doppelte Loeschen-Schaltflaeche im Ribbon entfernt und Absender-sperren-Aktion im Ribbon ergaenzt.</li><li>PDF-Anhangvorschau nutzt robuste Blob-URLs und Dateiendungen; einzelne und alle Anhaenge koennen in den konfigurierten Downloadordner gespeichert werden.</li><li>Links in HTML-Mails oeffnen extern im Standardbrowser; gesendete Mails springen nach dem Versand in den Gesendet-Ordner.</li><li>Sichtbare Umlaut- und Encoding-Fehler in Compose, Kontextmenue und Schnellaktionen bereinigt.</li></ul></article>',
          '<article class="unique-version-entry"><h3>Version 0.3.15</h3><ul><li>Nachrichtenliste zeigt Mail-Daten jetzt mit Jahr im benutzerdefinierten Datumsformat.</li><li>Neue Einstellungen-Abteilung fuer Sprache und Datumsformat; Hauptnavigation, Ribbon und Nachrichtenliste koennen auf Englisch umgestellt werden.</li><li>HTML-Mails werden bereinigt und isoliert, damit fremde Mail-CSS-Regeln das App-Layout nicht mehr verschieben.</li></ul></article>',
          '<article class="unique-version-entry"><h3>Version 0.3.14</h3><ul><li>Mail-Aktionsbuttons neu geordnet: links Anpinnen und Gelesen/Ungelesen, rechts Favorit und Loeschen.</li><li>Die vier Mail-Aktionen sind jetzt auch im Start-Ribbon verfuegbar.</li><li>IMAP-Anhaenge erhalten echte Dateinamen, Groessen und Vorschau-Daten; Kalender-Termine speichern robuster.</li></ul></article>',
          '<article class="unique-version-entry"><h3>Version 0.2.14</h3><ul><li>Whitescreen nach 0.2.13 behoben: native prompt()-Passwortabfrage entfernt.</li><li>Neuer app-eigener Passwortdialog fuer IMAP/SMTP-Sitzungspasswoerter.</li><li>Alte Prompt-Aktionen crashen den Renderer nicht mehr.</li></ul></article>',
          '<article class="unique-version-entry"><h3>Version 0.2.13</h3><ul><li>Layout-Fix fuer Settings, Ribbon und Nachrichtenliste nach der kompakten Ordneransicht.</li><li>Ordnerbaum bleibt kompakt, waehrend andere Flaechen wieder eigene stabile Abstaende erhalten.</li><li>Mail-Aktionsbuttons liegen wieder als Hover-Leiste ueber der Zeile statt die Nachrichtenvorschau zu verschieben.</li></ul></article>',
          '<article class="unique-version-entry"><h3>Version 0.2.12</h3><ul><li>Installierte App startet wieder: unsupported Electron-Pfad localAppData entfernt.</li><li>UserData nutzt jetzt robust LOCALAPPDATA, APPDATA-Fallback oder Installationsdatenpfad.</li><li>Installer 0.2.12 ersetzt die fehlerhaften Starts aus 0.2.10/0.2.11.</li></ul></article>',
          '<article class="unique-version-entry"><h3>Version 0.2.11</h3><ul><li>Auffaelliger Versionsverlauf-Button neben der Fenstersteuerung.</li><li>Aufgaben werden beim Einstellungs-Export und -Import mit uebernommen.</li><li>Kalendertage oeffnen den angedockten Termin-Dialog jetzt zuverlaessig per Klick und Doppelklick.</li><li>Gesendete Mails zeigen keine Demo-Empfaengeradresse mehr an.</li></ul></article>',
          '<article class="unique-version-entry"><h3>Version 0.2.10</h3><ul><li>Installations- und Update-Datenpfad stabilisiert, damit Konten, Signaturen, Listen, Kalender und Notizen erhalten bleiben.</li><li>Installer und App-Name auf Unique Mail vereinheitlicht.</li><li>Export fuer lokale Arbeitsdaten und Sicherheitslisten erweitert.</li></ul></article>',
          '<article class="unique-version-entry"><h3>Version 0.2.7 bis 0.2.9</h3><ul><li>IMAP-Ordnerstruktur und Mails aus allen Ordnern verbessert.</li><li>Tastaturbedienung, Mehrfachauswahl, Favoriten, Papierkorb-Aktionen und lokale Mail-Markierungen ergaenzt.</li><li>Bilddownload-Regeln, gesperrte Absender und Schutzlisten in Einstellungen eingebaut.</li></ul></article>',
          '<article class="unique-version-entry"><h3>Version 0.2.2 bis 0.2.6</h3><ul><li>Logo, App-Icon, Versionsanzeige und Installer-Artefakte eingebunden.</li><li>Kalender/Notizen ohne Demo-Daten beim Erststart bereinigt.</li><li>Fenstersteuerung mit Minimieren, Maximieren und Beenden nachgeruestet.</li></ul></article>',
          '<article class="unique-version-entry"><h3>Version 0.2.0</h3><ul><li>Gemini-Design als Hauptoberflaeche uebernommen.</li><li>Mailkonten, Ordneranzeige, Einstellungen, Signaturen und Compose-Fenster weiter integriert.</li></ul></article>',
          '</div></section>'
        ].join('');
        document.body.appendChild(backdrop);
        backdrop.querySelectorAll('.unique-version-current').forEach((badge, index) => {
          if (index > 0) badge.remove();
        });
        const close = () => backdrop.setAttribute('data-open', 'false');
        backdrop.addEventListener('click', (event) => {
          if (event.target === backdrop) close();
        });
        backdrop.querySelector('#unique-version-history-close')?.addEventListener('click', close);
        return backdrop;
      };

      const ensureButton = (id, title, label, action) => {
        let button = document.getElementById(id);
        if (!button) {
          button = document.createElement('button');
          button.id = id;
          button.type = 'button';
          document.body.appendChild(button);
        }
        button.title = title;
        button.setAttribute('aria-label', title);
        button.textContent = label;
        button.onclick = action;
      return button;
      };

      const updateButton = ensureButton(
        'unique-window-update-button',
        'Nach Updates suchen',
        'Update pruefen',
        async () => {
          if (!window.uniqueMailNative?.downloadAndInstallUpdate) return;
          updateButton.disabled = true;
          updateButton.dataset.phase = 'checking';
          updateButton.style.setProperty('--update-progress', '0%');
          updateButton.textContent = 'Update startet...';
          try {
            const result = await window.uniqueMailNative.downloadAndInstallUpdate();
            if (!result?.ok) throw new Error(result?.error || 'Update konnte nicht geladen werden.');
            updateButton.dataset.phase = 'launched';
            updateButton.style.setProperty('--update-progress', '100%');
            updateButton.textContent = 'Installer offen';
            updateButton.title = 'Der Update-Installer wurde gestartet.';
          } catch (error) {
            updateButton.dataset.phase = 'available';
            updateButton.style.setProperty('--update-progress', '0%');
            updateButton.textContent = 'Update verfuegbar';
            updateButton.disabled = false;
            alert('Update konnte nicht installiert werden:\\n\\n' + (error?.message || error));
          }
        }
      );
      updateButton.dataset.visible = 'false';

      const applyUpdateProgress = (progress) => {
        const phase = String(progress?.phase || 'checking');
        const percent = Math.max(0, Math.min(100, Number(progress?.percent) || 0));
        updateButton.dataset.phase = phase;
        updateButton.style.setProperty('--update-progress', percent + '%');
        if (phase === 'checking') updateButton.textContent = 'Update startet...';
        if (phase === 'downloading') updateButton.textContent = 'Download ' + percent + '%';
        if (phase === 'verifying') updateButton.textContent = 'Download pruefen';
        if (phase === 'launching') updateButton.textContent = 'Installer startet';
        if (phase === 'launched') updateButton.textContent = 'Installer offen';
        if (phase === 'error') {
          updateButton.textContent = 'Update fehlgeschlagen';
          updateButton.disabled = false;
        }
      };
      window.uniqueMailNative?.onUpdateProgress?.(applyUpdateProgress);

      const showUpdateState = (result) => {
        if (result?.ok && result.updateAvailable && result.update?.version) {
          updateButton.textContent = 'Update ' + result.update.version;
          updateButton.title = (result.message || 'Neue Version verfuegbar.') + ' Klicken zum Herunterladen und Installieren.';
          updateButton.dataset.visible = 'true';
          updateButton.dataset.phase = 'available';
          updateButton.style.setProperty('--update-progress', '0%');
        } else {
          updateButton.dataset.visible = 'false';
          updateButton.dataset.phase = 'idle';
        }
      };

      Promise.resolve(window.uniqueMailNative?.checkForUpdate?.()).then(showUpdateState).catch(() => {
        updateButton.dataset.visible = 'false';
      });

      ensureButton(
        'unique-window-feature-button',
        'Feature Request senden',
        'Feature Request',
        () => window.dispatchEvent(new CustomEvent('unique-mail-feedback-open', { detail: { type: 'feature' } }))
      );

      ensureButton(
        'unique-window-bug-button',
        'Bug Report senden',
        'Bug Report',
        () => window.dispatchEvent(new CustomEvent('unique-mail-feedback-open', { detail: { type: 'bug' } }))
      );

      ensureButton(
        'unique-window-history-button',
        'Versionsverlauf anzeigen',
        '0.4.35',
        () => {
          const backdrop = ensureVersionHistoryDialog();
          backdrop.setAttribute('data-open', 'true');
        }
      );

      ensureButton(
        'unique-window-minimize-button',
        'Unique Mail minimieren',
        '-',
        () => window.uniqueMailWindow?.minimize()
      );

      ensureButton(
        'unique-window-maximize-button',
        'Unique Mail maximieren oder wiederherstellen',
        String.fromCharCode(0x25A1),
        () => window.uniqueMailWindow?.maximize()
      );

      ensureButton(
        'unique-window-close-button',
        'Unique Mail beenden',
        String.fromCharCode(0x23fb),
        () => window.uniqueMailWindow?.close()
      );
      return { ok: true };
      } catch (error) {
        return { ok: false, error: error?.message || String(error), stack: error?.stack || '' };
      }
    })();
    `);
    if (windowControlsResult?.ok === false) {
      log(`window controls injection failed: ${windowControlsResult.error}\n${windowControlsResult.stack || ''}`);
    }
  } catch (error) {
    log(`window controls injection failed: ${error?.stack || error}`);
  }
}

function normalizeCredentialEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function credentialStorePath() {
  const settingsDir = uniqueMailDataPaths?.settingsDir || app.getPath('userData');
  fs.mkdirSync(settingsDir, { recursive: true });
  return path.join(settingsDir, 'account-passwords.json');
}

function readCredentialStore() {
  try {
    const target = credentialStorePath();
    if (!fs.existsSync(target)) return {};
    const parsed = JSON.parse(fs.readFileSync(target, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    log(`credential read failed: ${error.message || String(error)}`);
    return {};
  }
}

function writeCredentialStore(store) {
  const target = credentialStorePath();
  writeJsonAtomically(target, store || {});
}

function mergeCredentialStore(importedStore) {
  const current = readCredentialStore();
  const imported = importedStore && typeof importedStore === 'object' && !Array.isArray(importedStore) ? importedStore : {};
  Object.entries(imported).forEach(([email, encrypted]) => {
    const key = normalizeCredentialEmail(email);
    if (key && typeof encrypted === 'string' && encrypted.trim()) current[key] = encrypted;
  });
  writeCredentialStore(current);
  return Object.keys(current).length;
}
ipcMain.handle('native:get-account-password', async (_event, email) => {
  try {
    const key = normalizeCredentialEmail(email);
    if (!key) return { ok: false, password: null };
    const store = readCredentialStore();
    const encrypted = store[key];
    if (!encrypted || typeof encrypted !== 'string') return { ok: true, password: null };
    if (!safeStorage.isEncryptionAvailable()) return { ok: false, password: null, error: 'Passwortspeicher ist auf diesem Windows-Profil nicht verfuegbar.' };
    const password = safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
    return { ok: true, password };
  } catch (error) {
    return { ok: false, password: null, error: error.message || String(error) };
  }
});

ipcMain.handle('native:set-account-password', async (_event, payload) => {
  try {
    const key = normalizeCredentialEmail(payload?.email);
    const password = String(payload?.password || '');
    if (!key || !password) return { ok: false, error: 'E-Mail und Passwort sind erforderlich.' };
    if (!safeStorage.isEncryptionAvailable()) return { ok: false, error: 'Passwortspeicher ist auf diesem Windows-Profil nicht verfuegbar.' };
    const store = readCredentialStore();
    store[key] = safeStorage.encryptString(password).toString('base64');
    writeCredentialStore(store);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
});

ipcMain.handle('native:delete-account-password', async (_event, email) => {
  try {
    const key = normalizeCredentialEmail(email);
    if (!key) return { ok: false };
    const store = readCredentialStore();
    delete store[key];
    writeCredentialStore(store);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
});

function encryptPortableCredentialBackup(store, backupPassword) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Der Windows-Passwortspeicher ist auf diesem Profil nicht verfuegbar.');
  }
  const credentials = {};
  Object.entries(store).forEach(([email, encrypted]) => {
    if (typeof encrypted !== 'string' || !encrypted) return;
    credentials[email] = safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
  });
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(backupPassword, salt, 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(credentials), 'utf8'), cipher.final()]);
  return {
    format: 'unique-mail-portable-credentials-v1',
    algorithm: 'aes-256-gcm+scrypt',
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: encrypted.toString('base64'),
    accountCount: Object.keys(credentials).length
  };
}

function decryptPortableCredentialBackup(payload, backupPassword) {
  const salt = Buffer.from(String(payload?.salt || ''), 'base64');
  const iv = Buffer.from(String(payload?.iv || ''), 'base64');
  const tag = Buffer.from(String(payload?.tag || ''), 'base64');
  const data = Buffer.from(String(payload?.data || ''), 'base64');
  if (salt.length !== 16 || iv.length !== 12 || tag.length !== 16 || data.length === 0) {
    throw new Error('Der Passwort-Backupcontainer ist unvollstaendig oder beschaedigt.');
  }
  const key = crypto.scryptSync(backupPassword, salt, 32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  const parsed = JSON.parse(decrypted.toString('utf8'));
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

ipcMain.handle('native:export-account-passwords', async (_event, payload) => {
  try {
    const backupPassword = String(payload?.backupPassword || '');
    if (!backupPassword) {
      return {
        ok: true,
        format: 'unique-mail-credentials-omitted-v1',
        accountCount: 0,
        omitted: true,
        machineBound: false,
        exportedAt: new Date().toISOString()
      };
    }
    if (backupPassword.length < 4) {
      return { ok: false, error: 'Das Backup-Passwort muss mindestens 4 Zeichen lang sein.' };
    }
    const store = readCredentialStore();
    return {
      ok: true,
      ...encryptPortableCredentialBackup(store, backupPassword),
      machineBound: false,
      exportedAt: new Date().toISOString(),
    };
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
});

ipcMain.handle('native:import-account-passwords', async (_event, payload) => {
  try {
    const backup = payload?.backup || payload;
    const backupPassword = String(payload?.backupPassword || '');
    const explicitlyEmpty = Object.prototype.hasOwnProperty.call(backup || {}, 'accountCount')
      && Number(backup?.accountCount) === 0;
    if (!backup || backup?.format === 'unique-mail-credentials-omitted-v1' || explicitlyEmpty) {
      return { ok: true, count: 0, omitted: true };
    }
    if (backup?.format === 'unique-mail-portable-credentials-v1') {
      if (backupPassword.length < 4) {
        return { ok: false, error: 'Bitte das beim Export verwendete Backup-Passwort eingeben.' };
      }
      if (!safeStorage.isEncryptionAvailable()) {
        return { ok: false, error: 'Der Windows-Passwortspeicher ist auf diesem Profil nicht verfuegbar.' };
      }
      const plaintextCredentials = decryptPortableCredentialBackup(backup, backupPassword);
      const store = readCredentialStore();
      Object.entries(plaintextCredentials).forEach(([email, password]) => {
        const key = normalizeCredentialEmail(email);
        if (key && typeof password === 'string' && password) {
          store[key] = safeStorage.encryptString(password).toString('base64');
        }
      });
      writeCredentialStore(store);
      return { ok: true, count: Object.keys(plaintextCredentials).length };
    }

    if (backup?.format === 'electron-safeStorage-v1' || backup?.credentials) {
      return {
        ok: false,
        error: 'Dieser alte Export enthaelt maschinengebundene Windows-Passwoerter. Bitte auf dem bisherigen PC mit Unique Mail 0.3.33 oder neuer erneut exportieren.'
      };
    }
    return { ok: true, count: 0 };
  } catch (error) {
    const message = /authenticate|Unsupported state|bad decrypt/i.test(error.message || '')
      ? 'Backup-Passwort ist falsch oder der Passwortcontainer ist beschaedigt.'
      : error.message || String(error);
    return { ok: false, error: message };
  }
});
ipcMain.handle('native:update-check', async () => {
  try {
    return await checkForUniqueMailUpdate();
  } catch (error) {
    log(`update check failed: ${error.message || String(error)}`);
    return { ok: false, updateAvailable: false, currentVersion: app.getVersion(), error: error.message || String(error) };
  }
});

ipcMain.handle('native:update-download-install', async () => {
  try {
    return await downloadAndOpenUniqueMailUpdate();
  } catch (error) {
    log(`update download failed: ${error.message || String(error)}`);
    emitUpdateProgress({ phase: 'error', percent: 0, message: error.message || String(error) });
    return { ok: false, error: error.message || String(error) };
  }
});
ipcMain.handle('native:open-external', async (_event, url) => {
  const target = String(url || '').trim();
  if (!/^https?:\/\//i.test(target) && !/^mailto:/i.test(target)) return { ok: false, error: 'Ungueltiger Link.' };
  await shell.openExternal(target);
  return { ok: true };
});

ipcMain.handle('native:get-default-download-directory', async () => app.getPath('downloads'));

ipcMain.handle('native:choose-download-directory', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Download-Ordner auswaehlen',
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  return { canceled: false, directory: result.filePaths[0] };
});

ipcMain.on('native:start-attachment-drag', (event, payload) => {
  try {
    const filePath = writeAttachmentToDisk(payload?.attachment, dragOutDirectory());
    event.sender.startDrag({ file: filePath, icon: resolveAppIconPath() });
  } catch (error) {
    log(`attachment drag failed: ${error.message || String(error)}`);
  }
});

ipcMain.handle('native:save-attachment', async (_event, payload) => {
  try {
    const directory = resolveDownloadDirectory(payload?.directory);
    const filePath = writeAttachmentToDisk(payload?.attachment, directory);
    return { ok: true, filePath, directory };
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
});

ipcMain.handle('native:save-attachments', async (_event, payload) => {
  try {
    const directory = resolveDownloadDirectory(payload?.directory);
    const attachments = Array.isArray(payload?.attachments) ? payload.attachments : [];
    const filePaths = attachments.map((attachment) => writeAttachmentToDisk(attachment, directory));
    return { ok: true, filePaths, directory };
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
});
ipcMain.on('window:minimize', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});

ipcMain.on('window:maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
});

ipcMain.on('window:close', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  app.whenReady().then(() => {
    cleanupStaleUpdateFiles();
    return createWindow();
  });
}

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
});




