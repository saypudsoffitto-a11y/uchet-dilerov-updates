const { contextBridge, ipcRenderer, webFrame } = require('electron');
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

// 8.9.21: previous releases contained the fix files, but their preload-side
// script injection could fail under contextIsolation. Execute a tiny loader in
// the normal page world instead, so every correction is actually activated.
window.addEventListener('DOMContentLoaded',()=>{
  const code=`(async()=>{
    const files=['./assistant-8921.js','./hotfix-8917.js','./final-fixes-8917.js'];
    for(const src of files){
      await new Promise((resolve,reject)=>{
        const s=document.createElement('script');
        s.src=src+'?runtime=8921';
        s.onload=resolve;
        s.onerror=()=>reject(new Error('Не загрузился '+src));
        (document.head||document.documentElement).appendChild(s);
      });
    }
    document.documentElement.dataset.uchetRuntime='8.9.21';
  })()`;
  try{webFrame.executeJavaScript(code,true).catch(e=>console.error('8.9.21 runtime loader error',e))}
  catch(e){console.error('8.9.21 preload loader error',e)}
});
