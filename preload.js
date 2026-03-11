const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onExitCinemaMode: (callback) => ipcRenderer.on('exit-cinema-mode', () => callback()),
  onEnterCinemaMode: (callback) => ipcRenderer.on('enter-cinema-mode', () => callback()),
  fetchHTML: (url) => ipcRenderer.invoke('fetch-html', url)
});
