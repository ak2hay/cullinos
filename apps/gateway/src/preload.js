const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cullinosGateway', {
  getStatus: () => ipcRenderer.invoke('gateway:status'),
  getSyncQueue: () => ipcRenderer.invoke('gateway:sync-queue'),
  triggerSync: () => ipcRenderer.invoke('gateway:trigger-sync'),
  printReceipt: (payload) => ipcRenderer.invoke('gateway:print', payload),
  openCashDrawer: () => ipcRenderer.invoke('gateway:open-drawer'),
});
