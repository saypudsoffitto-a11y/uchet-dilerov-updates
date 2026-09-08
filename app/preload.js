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

// Голосовой помощник запускается только по отдельной кнопке и не слушает в фоне.
window.addEventListener('DOMContentLoaded',()=>{
  try{
    const voice=document.createElement('script');
    voice.src='./voice-assistant.js';
    voice.defer=true;
    voice.onload=()=>{
      try{
        const extra=document.createElement('script');
        extra.src='./assistant-enhancements.js';
        extra.defer=true;
        extra.onload=()=>{
          try{
            const hotfix=document.createElement('script');
            hotfix.src='./hotfix-8917.js';
            hotfix.defer=true;
            (document.head||document.documentElement).appendChild(hotfix);
          }catch(e){console.error('8.9.17 hotfix loader error',e)}
        };
        (document.head||document.documentElement).appendChild(extra);
      }catch(e){console.error('8.9.16 enhancement loader error',e)}
    };
    (document.head||document.documentElement).appendChild(voice);
  }catch(e){console.error('Voice assistant loader error',e)}
});
