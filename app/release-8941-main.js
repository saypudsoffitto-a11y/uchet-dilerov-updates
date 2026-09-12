'use strict';
const {app}=require('electron');
const fs=require('fs');
const path=require('path');

app.on('browser-window-created',(_event,win)=>{
  win.webContents.on('did-finish-load',()=>{
    const dealerPatch=path.join(__dirname,'dealer-delete-8941.js');
    const dataPatch=path.join(__dirname,'data-fix-8941.js');
    setTimeout(()=>{
      if(win.isDestroyed())return;
      if(!fs.existsSync(dealerPatch))return console.error('8.9.41 dealer patch missing:',dealerPatch);
      const code=fs.readFileSync(dealerPatch,'utf8');
      win.webContents.executeJavaScript(code,true).catch(e=>console.error('8.9.41 dealer patch error:',e));
    },3400);
    setTimeout(()=>{
      if(win.isDestroyed())return;
      if(!fs.existsSync(dataPatch))return console.error('8.9.41 data patch missing:',dataPatch);
      const code=fs.readFileSync(dataPatch,'utf8');
      win.webContents.executeJavaScript(code,true).catch(e=>console.error('8.9.41 data patch error:',e));
    },3600);
  });
});
