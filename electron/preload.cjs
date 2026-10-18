const { contextBridge, ipcRenderer } = require('electron');
const isDetachedComposeRenderer = new URLSearchParams(globalThis.location?.search || '').get('uniqueMailDetachedCompose') === '1';
const MAIL_FAVORITES_KEY = 'uniquemail_favorite_mail_keys_v1';
const FOLDER_FAVORITES_KEY = 'uniquemail_folder_favorites';

function readJsonStorageValue(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function persistFavoriteState() {
  if (isDetachedComposeRenderer) return { ok: true, skipped: true };
  return ipcRenderer.sendSync('native:favorite-state-save', {
    mailFavoriteKeys: readJsonStorageValue(MAIL_FAVORITES_KEY, {}),
    folderFavorites: readJsonStorageValue(FOLDER_FAVORITES_KEY, [])
  });
}

function readLocalStorageSnapshot() {
  const values = {};
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || key === 'outlook_emails') continue;
      const value = localStorage.getItem(key);
      const maximumLength = key === 'outlook_notes' ? 15_000_000 : 2_000_000;
      if (typeof value === 'string' && value.length <= maximumLength) values[key] = value;
    }
  } catch {
    // Renderer storage is best-effort until the page origin is ready.
  }
  return values;
}

function persistLocalStorageSnapshot() {
  if (isDetachedComposeRenderer) return { ok: true, skipped: true };
  try {
    const result = ipcRenderer.sendSync('native:renderer-storage-save', readLocalStorageSnapshot());
    const favoriteResult = persistFavoriteState();
    return result?.ok === false ? result : favoriteResult?.ok === false ? favoriteResult : result;
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
}

let persistedRendererSnapshot = { found: false, values: {} };

function restoreLocalStorageSnapshot() {
  const snapshot = persistedRendererSnapshot;
  try {
    if (!snapshot?.found || !snapshot.values || typeof snapshot.values !== 'object') return { ok: true, restored: false, count: 0 };
    // Merge persisted values. Clearing here used to erase newer keys whenever an
    // older or partial renderer snapshot won a race during startup.
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
  if (!isDetachedComposeRenderer) restoreLocalStorageSnapshot();
  if (!isDetachedComposeRenderer) {
    const favoriteState = ipcRenderer.sendSync('native:favorite-state-load');
    if (favoriteState?.found) {
      localStorage.setItem(MAIL_FAVORITES_KEY, JSON.stringify(favoriteState.mailFavoriteKeys || {}));
      localStorage.setItem(FOLDER_FAVORITES_KEY, JSON.stringify(favoriteState.folderFavorites || []));
    } else {
      persistFavoriteState();
    }
  }
} catch {
  // A missing or unreadable snapshot must never prevent the renderer from starting.
}

let lastPersistedSnapshot = '';
const persistIfChanged = () => {
  if (isDetachedComposeRenderer) return;
  const values = readLocalStorageSnapshot();
  const serialized = JSON.stringify(values);
  if (serialized === lastPersistedSnapshot) return;
  const result = ipcRenderer.sendSync('native:renderer-storage-save', values);
  if (result?.ok) {
    persistFavoriteState();
    lastPersistedSnapshot = serialized;
  }
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
  saveAttachmentAs: (payload) => ipcRenderer.invoke('native:save-attachment-as', payload),
  saveAttachments: (payload) => ipcRenderer.invoke('native:save-attachments', payload),
  prepareAttachmentDrag: (payload) => ipcRenderer.invoke('native:prepare-attachment-drag', payload),
  openAttachment: (payload) => ipcRenderer.invoke('native:open-attachment', payload),
  printEmail: (payload) => ipcRenderer.invoke('native:print-email', payload),
  startAttachmentDrag: (payload) => ipcRenderer.send('native:start-attachment-drag', payload),
  onAttachmentDragError: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, message) => callback(message);
    ipcRenderer.on('native:attachment-drag-error', listener);
    return () => ipcRenderer.removeListener('native:attachment-drag-error', listener);
  },
  getAccountPassword: (email) => ipcRenderer.invoke('native:get-account-password', email),
  setAccountPassword: (payload) => ipcRenderer.invoke('native:set-account-password', payload),
  deleteAccountPassword: (email) => ipcRenderer.invoke('native:delete-account-password', email),
  exportAccountPasswords: (payload) => ipcRenderer.invoke('native:export-account-passwords', payload),
  importAccountPasswords: (payload) => ipcRenderer.invoke('native:import-account-passwords', payload),
  setCalendarPassword: (payload) => ipcRenderer.invoke('native:set-calendar-password', payload),
  deleteCalendarPassword: (key) => ipcRenderer.invoke('native:delete-calendar-password', key),
  testCalDavConnection: (payload) => ipcRenderer.invoke('native:test-caldav-connection', payload),
  detachCompose: (payload) => ipcRenderer.invoke('native:detach-compose', payload),
  getDetachedComposeState: () => ipcRenderer.invoke('native:get-detached-compose-state'),
  updateDetachedComposeState: (payload) => ipcRenderer.invoke('native:update-detached-compose-state', payload),
  dockDetachedCompose: (payload) => ipcRenderer.invoke('native:dock-detached-compose', payload),
  sendDetachedCompose: (payload) => ipcRenderer.invoke('native:send-detached-compose', payload),
  onDetachedComposeReplace: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('native:detached-compose-replace', listener);
    return () => ipcRenderer.removeListener('native:detached-compose-replace', listener);
  },
  onDetachedComposeCloseRequest: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = () => callback();
    ipcRenderer.on('native:detached-compose-close-request', listener);
    return () => ipcRenderer.removeListener('native:detached-compose-close-request', listener);
  },
  onDetachedComposeDock: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('native:detached-compose-dock', listener);
    return () => ipcRenderer.removeListener('native:detached-compose-dock', listener);
  },
  onDetachedComposeSend: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('native:detached-compose-send', listener);
    return () => ipcRenderer.removeListener('native:detached-compose-send', listener);
  },
  restoreRendererStorage: () => restoreLocalStorageSnapshot(),
  persistRendererStorage: () => persistLocalStorageSnapshot(),
  checkForUpdate: () => ipcRenderer.invoke('native:update-check'),
  downloadAndInstallUpdate: () => ipcRenderer.invoke('native:update-download-install'),
  confirmAppClose: () => ipcRenderer.send('native:confirm-app-close'),
  onUpdateProgress: (callback) => {
    if (typeof callback !== 'function') return;
    ipcRenderer.on('native:update-progress', (_event, payload) => callback(payload));
  }
});

ipcRenderer.on('native:before-app-close', () => {
  try {
    const event = new CustomEvent('unique-mail-before-app-close', { cancelable: true });
    const handled = !window.dispatchEvent(event);
    if (!handled) ipcRenderer.send('native:confirm-app-close');
  } catch {
    ipcRenderer.send('native:confirm-app-close');
  }
});

try {
  if (!isDetachedComposeRenderer && typeof globalThis.setInterval === 'function') globalThis.setInterval(persistIfChanged, 1000);
  if (!isDetachedComposeRenderer && typeof window?.addEventListener === 'function') window.addEventListener('beforeunload', persistIfChanged);
} catch {
  // Explicit saves from React remain available even if lifecycle hooks are unavailable.
}
