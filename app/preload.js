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

contextBridge.exposeInMainWorld('receiptAPI', {
  sendPdf: (payload) => ipcRenderer.invoke('receipt:sendPdfWhatsApp', payload),
  savePdf: (payload) => ipcRenderer.invoke('receipt:savePdf', payload)
});

// 8.9.15: голосовой помощник загружается отдельным файлом. Он не слушает в фоне:
// распознавание речи включается только после явного нажатия кнопки в интерфейсе.
window.addEventListener('DOMContentLoaded',()=>{
  try{
    const s=document.createElement('script');
    s.src='./voice-assistant.js';
    s.defer=true;
    s.addEventListener('load',()=>{
      try{
        const e=document.createElement('script');
        e.src='./voice-ui-enhancement.js';
        e.defer=true;
        (document.head||document.documentElement).appendChild(e);
      }catch(err){console.error('Voice enhancement loader error',err)}
    });
    (document.head||document.documentElement).appendChild(s);
  }catch(e){console.error('Voice assistant loader error',e)}
});