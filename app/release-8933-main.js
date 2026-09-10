'use strict';
const {app}=require('electron');
const fs=require('fs');
const path=require('path');

app.on('browser-window-created',(_event,win)=>{
  win.webContents.on('did-finish-load',()=>{
    setTimeout(async()=>{
      if(win.isDestroyed())return;
      for(const file of ['core-fixes-8933.js','audio-fix-8933.js']){
        try{
          const p=path.join(__dirname,file);
          if(!fs.existsSync(p))throw new Error('Не найден '+file);
          await win.webContents.executeJavaScript(fs.readFileSync(p,'utf8'),true);
        }catch(e){console.error('8.9.33 final runtime error:',file,e)}
      }
    },900);
  });
});
