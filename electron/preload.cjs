const { contextBridge, ipcRenderer } = require('electron');

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
  exportAccountPasswords: () => ipcRenderer.invoke('native:export-account-passwords'),
  importAccountPasswords: (payload) => ipcRenderer.invoke('native:import-account-passwords', payload),
  checkForUpdate: () => ipcRenderer.invoke('native:update-check'),
  downloadAndInstallUpdate: () => ipcRenderer.invoke('native:update-download-install')
});
