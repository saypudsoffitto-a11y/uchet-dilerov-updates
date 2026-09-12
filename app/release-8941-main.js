'use strict';
const {app}=require('electron');
const fs=require('fs');
const path=require('path');
const {TextDecoder}=require('util');

function decodeStockCsv(buffer){
  try{
    return new TextDecoder('utf-8',{fatal:true}).decode(buffer).replace(/^\uFEFF/,'');
  }catch(_utf8Error){
    return new TextDecoder('windows-1251').decode(buffer).replace(/^\uFEFF/,'');
  }
}

function stockGroupCatalogue(){
  const file=path.join(__dirname,'tovar.csv');
  const out={};
  try{
    const text=decodeStockCsv(fs.readFileSync(file));
    text.split(/\r?\n/).forEach(line=>{
      if(!line.trim())return;
      const cols=line.split(';').map(v=>String(v||'').trim().replace(/^"|"$/g,''));
      const article=String(cols[0]||'').trim().toLocaleLowerCase('ru-RU');
      const name=String(cols[1]||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('ru-RU');
      const group=String(cols[4]||'').trim().replace(/\s+/g,' ');
      if(!name||!group)return;
      out[article+'||'+name]=group;
    });
  }catch(e){console.error('8.9.41 stock catalogue error:',e)}
  return out;
}

app.on('browser-window-created',(_event,win)=>{
  win.webContents.on('did-finish-load',()=>{
    const dealerPatch=path.join(__dirname,'dealer-delete-8941.js');
    const backupPatch=path.join(__dirname,'group-backup-8941.js');
    const dataPatch=path.join(__dirname,'data-fix-8941.js');
    const catalogue=stockGroupCatalogue();
    setTimeout(()=>{
      if(win.isDestroyed())return;
      if(!fs.existsSync(dealerPatch))return console.error('8.9.41 dealer patch missing:',dealerPatch);
      const code=fs.readFileSync(dealerPatch,'utf8');
      win.webContents.executeJavaScript(code,true).catch(e=>console.error('8.9.41 dealer patch error:',e));
    },3400);
    setTimeout(()=>{
      if(win.isDestroyed())return;
      const preload='window.__stockGroupCatalogue8941='+JSON.stringify(catalogue)+';';
      win.webContents.executeJavaScript(preload,true).catch(e=>console.error('8.9.41 catalogue inject error:',e));
    },3500);
    setTimeout(()=>{
      if(win.isDestroyed())return;
      if(!fs.existsSync(backupPatch))return console.error('8.9.41 group backup patch missing:',backupPatch);
      const code=fs.readFileSync(backupPatch,'utf8');
      win.webContents.executeJavaScript(code,true).catch(e=>console.error('8.9.41 group backup error:',e));
    },3600);
    setTimeout(()=>{
      if(win.isDestroyed())return;
      if(!fs.existsSync(dataPatch))return console.error('8.9.41 data patch missing:',dataPatch);
      const code=fs.readFileSync(dataPatch,'utf8');
      win.webContents.executeJavaScript(code,true).catch(e=>console.error('8.9.41 data patch error:',e));
    },3800);
  });
});
