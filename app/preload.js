const { contextBridge, ipcRenderer, webFrame } = require('electron');

const nmCallbacks=[];
let nmExclusive=false;
ipcRenderer.on('newmatros:ini',(_event,payload)=>{
  for(const cb of [...nmCallbacks]){
    try{cb(payload)}catch(e){console.error('NewMatRos renderer callback error',e)}
  }
});

contextBridge.exposeInMainWorld('newmatrosAPI', {
  chooseIni: () => ipcRenderer.invoke('newmatros:chooseIni'),
  setWatch: (enabled) => ipcRenderer.invoke('newmatros:setWatch', !!enabled),
  onIni: (callback) => { if(!nmExclusive&&typeof callback==='function') nmCallbacks.push(callback); },
  setIniHandler: (callback) => { nmCallbacks.length=0; nmExclusive=true; if(typeof callback==='function') nmCallbacks.push(callback); },
  clearIniHandlers: () => { nmCallbacks.length=0; nmExclusive=false; },
  appInfo: () => ipcRenderer.invoke('app:info')
});

contextBridge.exposeInMainWorld('stockAPI', {
  chooseCsv: (kind) => ipcRenderer.invoke('stock:chooseCsv', kind),
  loadBundledProducts: () => ipcRenderer.invoke('stock:loadBundledProducts')
});

contextBridge.exposeInMainWorld('clientsAPI', {
  loadBundledNewMatRosClients: () => ipcRenderer.invoke('clients:loadBundledNewMatRos'),
  loadBundledNewMatRos: () => ipcRenderer.invoke('clients:loadBundledNewMatRos')
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
  listenOnce: () => ipcRenderer.invoke('assistant:listenWindows'),
  stop: () => ipcRenderer.invoke('assistant:stopWindows'),
  speakWindows: (text) => ipcRenderer.invoke('assistant:speakWindows', text)
});

window.addEventListener('DOMContentLoaded',()=>{
  const code=`(async()=>{
    const files=['./assistant-settings-8933.js','./assistant-8921.js','./hotfix-8917.js','./final-fixes-8917.js','./runtime-fixes-8924.js','./runtime-fixes-8926.js','./audio-ui.js','./input-focus.js','./receipt-add-core.js','./receipt-add-ui.js','./core-fixes-8933.js','./audio-fix-8933.js'];
    for(const src of files){
      await new Promise((resolve,reject)=>{
        const s=document.createElement('script');
        s.src=src+'?runtime=8933';
        s.onload=resolve;
        s.onerror=()=>reject(new Error('Не загрузился '+src));
        (document.head||document.documentElement).appendChild(s);
      });
    }
    document.documentElement.dataset.uchetRuntime='8.9.33';
  })()`;
  try{webFrame.executeJavaScript(code,true).catch(e=>console.error('8.9.33 runtime loader error',e))}
  catch(e){console.error('8.9.33 preload loader error',e)}
});

contextBridge.exposeInMainWorld('audioAPI',{config:()=>ipcRenderer.invoke('audio:config'),save:v=>ipcRenderer.invoke('audio:save',v),cancel:()=>ipcRenderer.invoke('audio:cancel'),transcribe:v=>ipcRenderer.invoke('audio:transcribe',v),speak:text=>ipcRenderer.invoke('audio:speak',text)});

contextBridge.exposeInMainWorld('windowAPI',{
 showDialog:(kind,message)=>ipcRenderer.sendSync('window:dialog',{kind,message}),
 onRestoreInput:callback=>{if(typeof callback==='function')ipcRenderer.on('window:restore-input',()=>callback())}
});
