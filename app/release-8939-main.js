'use strict';
const {app}=require('electron');
const fs=require('fs');
const path=require('path');

app.on('browser-window-created',(_event,win)=>{
  win.webContents.on('did-finish-load',()=>{
    const patchPath=path.join(__dirname,'dealer-delete-8939.js');
    setTimeout(()=>{
      if(win.isDestroyed())return;
      if(!fs.existsSync(patchPath))return console.error('8.9.39 dealer patch missing:',patchPath);
      const code=fs.readFileSync(patchPath,'utf8');
      win.webContents.executeJavaScript(code,true).catch(e=>console.error('8.9.39 dealer patch error:',e));
    },2400);
  });
});
