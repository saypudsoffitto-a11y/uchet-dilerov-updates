const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('newmatrosAPI', {
  chooseIni: () => ipcRenderer.invoke('newmatros:chooseIni'),
  setWatch: (enabled) => ipcRenderer.invoke('newmatros:setWatch', !!enabled),
  onIni: (callback) => ipcRenderer.on('newmatros:ini', (_event, payload) => callback(payload)),
  appInfo: () => ipcRenderer.invoke('app:info')
});

contextBridge.exposeInMainWorld('stockAPI', {
  chooseCsv: (kind) => ipcRenderer.invoke('stock:chooseCsv', kind),
  loadBundledProducts: () => ipcRenderer.invoke('stock:loadBundledProducts')
});

contextBridge.exposeInMainWorld('clientsAPI', {
  loadBundledNewMatRosClients: () => ipcRenderer.invoke('clients:loadBundledNewMatRos')
});

contextBridge.exposeInMainWorld('updateAPI', {
  checkAndInstall: (manifestUrl) => ipcRenderer.invoke('update:checkAndInstall', manifestUrl),
  installFromFile: () => ipcRenderer.invoke('update:installFromFile'),
  saveBackup: (jsonText) => ipcRenderer.invoke('update:saveBackup', jsonText)
});

contextBridge.exposeInMainWorld('syncAPI', {
  request: (baseUrl, token, method, body) => ipcRenderer.invoke('sync:request', {baseUrl, token, method, body})
});

contextBridge.exposeInMainWorld('whatsappAPI',{send:(payload)=>ipcRenderer.invoke('whatsapp:send',payload)});
