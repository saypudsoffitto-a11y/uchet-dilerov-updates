'use strict';
// Only invoked by the explicit CI launch flag, with an isolated profile.
const {app,BrowserWindow,session}=require('electron');
const fs=require('fs');
const path=require('path');
const report=process.env.UCHET_SMOKE_REPORT;
if(!report || !path.isAbsolute(report)) throw new Error('Smoke report path is required');
app.setPath('userData',path.join(path.dirname(report),'profile'));
app.whenReady().then(()=>{
  // A launch check must never contact the user's production sync server.
  session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(_details,callback)=>callback({cancel:true}));
});
setTimeout(async()=>{
  try{
    const win=BrowserWindow.getAllWindows().find(w=>w.isVisible()&&!w.isDestroyed());
    if(!win) throw new Error('Main window did not become visible');
    const state=await win.webContents.executeJavaScript(`(async()=>({ready:document.readyState,text:document.body.innerText.length,info:await window.newmatrosAPI.appInfo(),runtime:document.documentElement.dataset.uchetRuntime}))()`);
    if(state.ready!=='complete'||state.text<40||state.info.platform!=='darwin'||state.info.arch!=='arm64'||state.info.version!==app.getVersion()||state.runtime!==app.getVersion())throw new Error('Invalid renderer/preload/IPC state: '+JSON.stringify(state));
    fs.writeFileSync(report,JSON.stringify({ok:true,...state},null,2));
    fs.writeFileSync(report+'.png',(await win.webContents.capturePage()).toPNG());
    app.exit(0);
  }catch(error){fs.writeFileSync(report,JSON.stringify({ok:false,error:String(error)}));app.exit(1);}
},12000);
