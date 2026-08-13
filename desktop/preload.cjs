const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('createurAO', {
  chooseFolder: (initialPath = '') => ipcRenderer.invoke('dialog:choose-folder', initialPath),
  chooseConfigFile: () => ipcRenderer.invoke('dialog:choose-config-file'),
  saveConfigFile: (content) => ipcRenderer.invoke('dialog:save-config-file', content),
  restoreBackup: (backupPath) => ipcRenderer.invoke('backup:restore', backupPath)
});
