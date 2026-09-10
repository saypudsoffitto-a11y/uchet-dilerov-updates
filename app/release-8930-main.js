'use strict';
const {app,Menu}=require('electron');
const fs=require('fs');
const path=require('path');

function installEditContextMenu(win){
  win.webContents.on('context-menu',(_event,params)=>{
    if(win.isDestroyed())return;
    const editable=!!params.isEditable;
    const selected=!!String(params.selectionText||'');
    if(!editable&&!selected)return;
    const template=[];
    if(editable){
      template.push(
        {label:'Отменить',role:'undo',enabled:params.editFlags?.canUndo!==false},
        {label:'Повторить',role:'redo',enabled:params.editFlags?.canRedo!==false},
        {type:'separator'},
        {label:'Вырезать',role:'cut',enabled:params.editFlags?.canCut!==false},
        {label:'Копировать',role:'copy',enabled:params.editFlags?.canCopy!==false||selected},
        {label:'Вставить',role:'paste',enabled:params.editFlags?.canPaste!==false},
        {type:'separator'},
        {label:'Выделить всё',role:'selectAll'}
      );
    }else{
      template.push({label:'Копировать',role:'copy'});
    }
    Menu.buildFromTemplate(template).popup({window:win});
  });
}

function installRenderer8930(win){
  const patchPath=path.join(__dirname,'runtime-fixes-8930.js');
  const run=()=>{
    if(win.isDestroyed()||!fs.existsSync(patchPath))return;
    const code=fs.readFileSync(patchPath,'utf8');
    setTimeout(()=>{
      if(win.isDestroyed())return;
      win.webContents.executeJavaScript(code,true).catch(e=>console.error('8.9.30 renderer patch error:',e));
    },350);
  };
  win.webContents.on('did-finish-load',run);
}

app.on('browser-window-created',(_event,win)=>{
  installEditContextMenu(win);
  installRenderer8930(win);
});
