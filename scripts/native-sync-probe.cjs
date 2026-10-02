// Isolated diagnostics of the real renderer/preload; no production network/data.
const {app,BrowserWindow,session}=require('electron');
const fs=require('fs'),path=require('path');
const output=path.resolve(process.env.UCHET_QA_DIR||path.join(__dirname,'../qa-sync-probe'));
fs.mkdirSync(output,{recursive:true});app.setPath('userData',path.join(output,'profile'));
const errors=[];let ready;
const loaded=new Promise(resolve=>ready=resolve);
app.on('browser-window-created',(_e,win)=>{win.webContents.on('console-message',e=>{if(e.level==='error')errors.push(e.message)});win.webContents.on('preload-error',(_e,_p,error)=>errors.push(String(error)));win.webContents.once('did-finish-load',()=>ready(win));});
app.whenReady().then(()=>session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_d,done)=>done({cancel:true})));
require('../app/main-8948');
(async()=>{const win=await loaded;await win.webContents.executeJavaScript('new Promise(resolve=>setTimeout(resolve,1000))');const result=await win.webContents.executeJavaScript(`({module:typeof window.masterSync8962,core:typeof window.SyncCore8962,url:state.sync?.url||'',enabled:!!state.sync?.enabled,status:document.getElementById('syncStatus')?.textContent||'',api:typeof window.syncAPI,version:document.documentElement.dataset.uchetRuntime})`);fs.writeFileSync(path.join(output,'probe.json'),JSON.stringify({...result,errors},null,2));console.log(JSON.stringify({...result,errors}));app.exit(errors.length?1:0)})().catch(e=>{console.error(e);app.exit(1)});
