'use strict';
const {app}=require('electron');
const fs=require('fs');
const path=require('path');

app.on('browser-window-created',(_event,win)=>{
  win.webContents.on('did-finish-load',()=>{
    const patchPath=path.join(__dirname,'dealer-delete-8937.js');
    if(!fs.existsSync(patchPath))return console.error('8.9.37 dealer patch missing:',patchPath);
    // Older renderer patches still initialize during the first few hundred ms.
    // Install the canonical dealer handler after them so the real UI cannot be
    // silently switched back to an older delete implementation.
    setTimeout(()=>{
      if(win.isDestroyed())return;
      const code=fs.readFileSync(patchPath,'utf8');
      win.webContents.executeJavaScript(code,true).catch(e=>console.error('8.9.37 dealer patch error:',e));
    },900);
  });
});
