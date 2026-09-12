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

function versionAtLeast(current,target){
  const a=String(current||'0').split('.').map(x=>parseInt(x,10)||0);
  const b=String(target||'0').split('.').map(x=>parseInt(x,10)||0);
  for(let i=0;i<Math.max(a.length,b.length);i++){
    if((a[i]||0)!==(b[i]||0))return (a[i]||0)>(b[i]||0);
  }
  return true;
}

function usesModernRenderer(){
  try{
    // 8.9.41+ has deterministic preload loading and must never be overwritten by
    // the legacy 8.9.30 runtime. Keep this main-process module only for the native
    // edit context menu (copy/paste/undo/etc.).
    return typeof app.getVersion==='function'&&versionAtLeast(app.getVersion(),'8.9.41');
  }catch(_){return false}
}

function installRenderer8930(win){
  if(usesModernRenderer())return;
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

module.exports={versionAtLeast,usesModernRenderer,installRenderer8930};
