'use strict';
// Only invoked by the explicit CI launch flag, with an isolated profile.
const {app,BrowserWindow,session}=require('electron');
const fs=require('fs');
const path=require('path');
const report=process.env.UCHET_SMOKE_REPORT;
const expectedRuntime='8.9.68';
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
    if(state.ready!=='complete'||state.text<40||state.info.platform!=='darwin'||state.info.arch!=='arm64'||state.info.version!==app.getVersion()||state.runtime!==expectedRuntime)throw new Error('Invalid renderer/preload/IPC state: '+JSON.stringify(state));
    await win.webContents.executeJavaScript(`(async()=>{if(!window.__pinLock8948.isConfigured())await window.__pinLock8948.setInitialPin('2468','2468');else if(!window.__pinLock8948.isUnlocked())await window.__pinLock8948.unlock('2468');})()`);
    const themes=[];
    for(const theme of ['standard','colorful','multicolor']){
      const result=await win.webContents.executeJavaScript("(async()=>{\n  go('settings');\n  const select=document.getElementById('uiThemeSelect');\n  if(!select)throw Error('Theme selector missing');\n  const before=JSON.stringify(state);\n  select.value=THEME;select.dispatchEvent(new Event('change',{bubbles:true}));\n  if(JSON.stringify(state)!==before)throw Error('Theme changed business data');\n  go('products');\n  await new Promise(resolve=>setTimeout(resolve,300));\n  const colors=[...document.querySelectorAll('nav button[data-section]')].map(b=>getComputedStyle(b).backgroundColor);\n  const row=document.querySelector('#products table tr');\n  return {theme:document.documentElement.dataset.uiTheme,stored:localStorage.getItem('uchet-ui-theme'),\n    options:[...select.options].map(o=>o.value),colors:new Set(colors).size,\n    rowHeight:row?.getBoundingClientRect().height,background:getComputedStyle(document.querySelector('main')).backgroundColor};\n})()".replace('THEME',JSON.stringify(theme)));
      if(result.theme!==theme||result.stored!==theme||result.options.join(',')!=='standard,colorful,multicolor')throw Error('Theme selection failed: '+JSON.stringify(result));
      if(theme==='multicolor'&&(result.colors<10||result.background!=='rgb(241, 244, 246)'))throw Error('Multicolor palette failed: '+JSON.stringify(result));
      themes.push(result);fs.writeFileSync(report+'.'+theme+'.png',(await win.webContents.capturePage()).toPNG());
    }
    const loaded=new Promise(resolve=>win.webContents.once('did-finish-load',resolve));win.webContents.reload();await loaded;
    const restored=await win.webContents.executeJavaScript(`document.documentElement.dataset.uiTheme==='multicolor'&&localStorage.getItem('uchet-ui-theme')==='multicolor'`);
    if(!restored)throw Error('Theme did not persist after reload');
    state.themes=themes;state.themeRestored=restored;
    fs.writeFileSync(report,JSON.stringify({ok:true,...state},null,2));
    fs.writeFileSync(report+'.png',(await win.webContents.capturePage()).toPNG());
    app.exit(0);
  }catch(error){fs.writeFileSync(report,JSON.stringify({ok:false,error:String(error)}));app.exit(1);}
},12000);
