'use strict';
const {app}=require('electron');
const fs=require('fs');
const path=require('path');

app.on('browser-window-created',(_event,win)=>{
  win.webContents.on('did-finish-load',()=>{
    const patchPath=path.join(__dirname,'stable-fix-8938.js');
    if(!fs.existsSync(patchPath))return console.error('8.9.38 stability patch missing:',patchPath);
    setTimeout(()=>{
      if(win.isDestroyed())return;
      const code=fs.readFileSync(patchPath,'utf8');
      win.webContents.executeJavaScript(code,true).catch(e=>console.error('8.9.38 stability patch error:',e));
    },1600);
  });
});
