'use strict';
const {BrowserWindow,dialog,ipcMain,app}=require('electron');
const {fileURLToPath}=require('url');
const path=require('path');
const states=new WeakMap();
function restore(win){if(!win||win.isDestroyed())return;const state=states.get(win);if(state?.dialogOpen)return;win.webContents.blur();win.focus();win.webContents.focus();win.webContents.send('window:restore-input')}
function trusted(e){try{return e.senderFrame===e.sender.mainFrame&&fileURLToPath(e.senderFrame.url)===path.join(__dirname,'index.html')}catch{return false}}
function finishApprovedClose(win,state){
 if(!win||win.isDestroyed())return;
 state.allowed=true;
 try{if(typeof win.destroy==='function')win.destroy();else win.close()}catch(_){try{win.close()}catch(__){}}
 setImmediate(()=>{try{if(app&&typeof app.quit==='function')app.quit()}catch(_){}});
 if(app&&typeof app.exit==='function'){
  const t=setTimeout(()=>{try{app.exit(0)}catch(_){}},1600);
  if(t&&typeof t.unref==='function')t.unref();
 }
}
function install(win){if(states.has(win))return;const state={allowed:false,pending:null,dialogOpen:false};states.set(win,state);
 win.on('close',event=>{if(state.allowed)return;event.preventDefault();if(state.pending||state.dialogOpen)return;confirmExit(win).then(accepted=>{if(accepted&&!win.isDestroyed())finishApprovedClose(win,state)}).catch(()=>restore(win))});
 win.on('focus',()=>{setImmediate(()=>{if(!win.isDestroyed()&&win.isFocused()&&!state.dialogOpen)win.webContents.focus()})});
 win.webContents.on('before-mouse-event',(_event,mouse)=>{if(mouse.type==='mouseDown'&&!state.dialogOpen&&win.isFocused()&&!win.webContents.isFocused())win.webContents.focus()});
}
function confirmExit(win){if(!win||win.isDestroyed())return Promise.resolve(true);install(win);const s=states.get(win);if(s.pending)return s.pending;if(s.dialogOpen)return Promise.resolve(false);s.dialogOpen=true;
 let accepted=false;
 s.pending=Promise.resolve().then(async()=>{try{const r=await dialog.showMessageBox(win,{type:'question',title:'Выход из программы',message:'Точно хотите закрыть «Учёт дилеров»?',detail:'Несохранённые изменения в открытых формах могут быть потеряны.',buttons:['Остаться','Закрыть программу'],defaultId:0,cancelId:0,noLink:true});accepted=r.response===1;return accepted}catch{return false}finally{s.dialogOpen=false;s.pending=null;if(!accepted)restore(win)}});return s.pending;
}
function allowClose(win){if(win&&!win.isDestroyed()){install(win);states.get(win).allowed=true}}
ipcMain.on('window:dialog',(event,payload)=>{event.returnValue=false;if(!trusted(event))return;const win=BrowserWindow.fromWebContents(event.sender);if(!win||win.isDestroyed())return;install(win);const s=states.get(win);if(s.dialogOpen)return;const confirm=payload?.kind==='confirm';s.dialogOpen=true;try{const response=dialog.showMessageBoxSync(win,{type:confirm?'question':'info',title:'Учёт дилеров',message:String(payload?.message||'').slice(0,12000),buttons:confirm?['Отмена','Подтвердить']:['OK'],defaultId:0,cancelId:0,noLink:true});event.returnValue=confirm?response===1:true}catch{event.returnValue=false}finally{s.dialogOpen=false;setImmediate(()=>restore(win))}});
module.exports={install,confirmExit,allowClose};
