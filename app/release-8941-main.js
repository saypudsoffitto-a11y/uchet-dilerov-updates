'use strict';
const {app}=require('electron');
const fs=require('fs');
const path=require('path');

app.on('browser-window-created',(_event,win)=>{
  win.webContents.on('did-finish-load',()=>{
    const patch=path.join(__dirname,'dealer-delete-8941.js');
    setTimeout(()=>{
      if(win.isDestroyed())return;
      if(!fs.existsSync(patch))return console.error('8.9.41 dealer patch missing:',patch);
      const code=fs.readFileSync(patch,'utf8');
      win.webContents.executeJavaScript(code,true).catch(e=>console.error('8.9.41 dealer patch error:',e));
    },3400);
  });
});
