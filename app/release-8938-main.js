'use strict';
const {app}=require('electron');
const fs=require('fs');
const path=require('path');

app.on('browser-window-created',(_event,win)=>{
  win.webContents.on('did-finish-load',()=>{
    const files=['stable-fix-8938.js','pdf-compact-8938.js'];
    setTimeout(async()=>{
      if(win.isDestroyed())return;
      for(const name of files){
        const patchPath=path.join(__dirname,name);
        if(!fs.existsSync(patchPath)){
          console.error('8.9.38 patch missing:',patchPath);
          continue;
        }
        try{
          const code=fs.readFileSync(patchPath,'utf8');
          await win.webContents.executeJavaScript(code,true);
        }catch(e){console.error('8.9.38 patch error:',name,e)}
      }
    },1600);
  });
});
