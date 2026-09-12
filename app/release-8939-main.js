'use strict';
const {app}=require('electron');
const fs=require('fs');
const path=require('path');

app.on('browser-window-created',(_event,win)=>{
  win.webContents.on('did-finish-load',()=>{
    const dealerPatch=path.join(__dirname,'dealer-delete-8939.js');
    const syncPatch=path.join(__dirname,'sync-fix-8939.js');
    setTimeout(()=>{
      if(win.isDestroyed())return;
      if(!fs.existsSync(dealerPatch))return console.error('8.9.39 dealer patch missing:',dealerPatch);
      const code=fs.readFileSync(dealerPatch,'utf8');
      win.webContents.executeJavaScript(code,true).catch(e=>console.error('8.9.39 dealer patch error:',e));
    },2400);
    setTimeout(()=>{
      if(win.isDestroyed())return;
      if(!fs.existsSync(syncPatch))return console.error('8.9.39 sync patch missing:',syncPatch);
      const code=fs.readFileSync(syncPatch,'utf8');
      win.webContents.executeJavaScript(code,true).catch(e=>console.error('8.9.39 sync patch error:',e));
    },2600);
  });
});
