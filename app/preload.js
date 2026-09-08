const { contextBridge, ipcRenderer, webFrame } = require('electron');

const nmCallbacks=[];
ipcRenderer.on('newmatros:ini',(_event,payload)=>{
  for(const cb of [...nmCallbacks]){
    try{cb(payload)}catch(e){console.error('NewMatRos renderer callback error',e)}
  }
});

contextBridge.exposeInMainWorld('newmatrosAPI', {
  chooseIni: () => ipcRenderer.invoke('newmatros:chooseIni'),
  setWatch: (enabled) => ipcRenderer.invoke('newmatros:setWatch', !!enabled),
  onIni: (callback) => { if(typeof callback==='function') nmCallbacks.push(callback); },
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

contextBridge.exposeInMainWorld('voiceAPI', {
  listenOnce: () => ipcRenderer.invoke('assistant:listenWindows')
});

// 8.9.22: load all corrections in the normal page world. The NewMatRos
// callback dispatcher above isolates callback errors so one broken listener
// cannot prevent the next fix from opening the imported order.
window.addEventListener('DOMContentLoaded',()=>{
  const code=`(async()=>{
    const files=['./assistant-8921.js','./hotfix-8917.js','./final-fixes-8917.js','./runtime-fixes-8922.js'];
    for(const src of files){
      await new Promise((resolve,reject)=>{
        const s=document.createElement('script');
        s.src=src+'?runtime=8922';
        s.onload=resolve;
        s.onerror=()=>reject(new Error('Не загрузился '+src));
        (document.head||document.documentElement).appendChild(s);
      });
    }
    document.documentElement.dataset.uchetRuntime='8.9.22';
  })()`;
  try{webFrame.executeJavaScript(code,true).catch(e=>console.error('8.9.22 runtime loader error',e))}
  catch(e){console.error('8.9.22 preload loader error',e)}
});
