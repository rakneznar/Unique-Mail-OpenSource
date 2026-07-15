const { contextBridge, ipcRenderer } = require('electron');

function readLocalStorageSnapshot() {
  const values = {};
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || key === 'outlook_emails') continue;
      const value = localStorage.getItem(key);
      if (typeof value === 'string' && value.length <= 2_000_000) values[key] = value;
    }
  } catch {
    // Renderer storage is best-effort until the page origin is ready.
  }
  return values;
}

function persistLocalStorageSnapshot() {
  try {
    return ipcRenderer.sendSync('native:renderer-storage-save', readLocalStorageSnapshot());
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
}

let persistedRendererSnapshot = { found: false, values: {} };

function restoreLocalStorageSnapshot() {
  const snapshot = persistedRendererSnapshot;
  try {
    if (!snapshot?.found || !snapshot.values || typeof snapshot.values !== 'object') return { ok: true, restored: false, count: 0 };
    localStorage.clear();
    Object.entries(snapshot.values).forEach(([key, value]) => {
      if (typeof key === 'string' && typeof value === 'string') localStorage.setItem(key, value);
    });
    return { ok: true, restored: true, count: Object.keys(snapshot.values).length };
  } catch (error) {
    return { ok: false, restored: false, error: error?.message || String(error) };
  }
}

try {
  persistedRendererSnapshot = ipcRenderer.sendSync('native:renderer-storage-load') || persistedRendererSnapshot;
  restoreLocalStorageSnapshot();
} catch {
  // A missing or unreadable snapshot must never prevent the renderer from starting.
}

let lastPersistedSnapshot = '';
const persistIfChanged = () => {
  const values = readLocalStorageSnapshot();
  const serialized = JSON.stringify(values);
  if (serialized === lastPersistedSnapshot) return;
  const result = ipcRenderer.sendSync('native:renderer-storage-save', values);
  if (result?.ok) lastPersistedSnapshot = serialized;
};

contextBridge.exposeInMainWorld('uniqueMailWindow', {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close')
});

contextBridge.exposeInMainWorld('uniqueMailNative', {
  openExternal: (url) => ipcRenderer.invoke('native:open-external', url),
  chooseDownloadDirectory: () => ipcRenderer.invoke('native:choose-download-directory'),
  getDefaultDownloadDirectory: () => ipcRenderer.invoke('native:get-default-download-directory'),
  saveAttachment: (payload) => ipcRenderer.invoke('native:save-attachment', payload),
  saveAttachments: (payload) => ipcRenderer.invoke('native:save-attachments', payload),
  startAttachmentDrag: (payload) => ipcRenderer.send('native:start-attachment-drag', payload),
  getAccountPassword: (email) => ipcRenderer.invoke('native:get-account-password', email),
  setAccountPassword: (payload) => ipcRenderer.invoke('native:set-account-password', payload),
  deleteAccountPassword: (email) => ipcRenderer.invoke('native:delete-account-password', email),
  exportAccountPasswords: (payload) => ipcRenderer.invoke('native:export-account-passwords', payload),
  importAccountPasswords: (payload) => ipcRenderer.invoke('native:import-account-passwords', payload),
  restoreRendererStorage: () => restoreLocalStorageSnapshot(),
  persistRendererStorage: () => persistLocalStorageSnapshot(),
  checkForUpdate: () => ipcRenderer.invoke('native:update-check'),
  downloadAndInstallUpdate: () => ipcRenderer.invoke('native:update-download-install'),
  onUpdateProgress: (callback) => {
    if (typeof callback !== 'function') return;
    ipcRenderer.on('native:update-progress', (_event, payload) => callback(payload));
  }
});

try {
  if (typeof globalThis.setInterval === 'function') globalThis.setInterval(persistIfChanged, 1000);
  if (typeof window?.addEventListener === 'function') window.addEventListener('beforeunload', persistIfChanged);
} catch {
  // Explicit saves from React remain available even if lifecycle hooks are unavailable.
}
