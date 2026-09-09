'use strict';
const {BrowserWindow,dialog,ipcMain}=require('electron');
const {fileURLToPath}=require('url');
const path=require('path');
const states=new WeakMap();
function restore(win){if(!win||win.isDestroyed())return;const state=states.get(win);if(state?.dialogOpen)return;win.webContents.blur();win.focus();win.webContents.focus();win.webContents.send('window:restore-input')}
function trusted(e){try{return e.senderFrame===e.sender.mainFrame&&fileURLToPath(e.senderFrame.url)===path.join(__dirname,'index.html')}catch{return false}}
function install(win){if(states.has(win))return;const state={allowed:false,pending:null,dialogOpen:false};states.set(win,state);
 win.on('close',event=>{if(state.allowed)return;event.preventDefault();if(state.pending||state.dialogOpen)return;confirmExit(win).then(accepted=>{if(accepted&&!win.isDestroyed()){state.allowed=true;win.close()}}).catch(()=>restore(win))});
 win.on('focus',()=>{setImmediate(()=>{if(!win.isDestroyed()&&win.isFocused()&&!state.dialogOpen)win.webContents.focus()})});
 win.webContents.on('before-mouse-event',(_event,mouse)=>{if(mouse.type==='mouseDown'&&!state.dialogOpen&&win.isFocused()&&!win.webContents.isFocused())win.webContents.focus()});
}
function confirmExit(win){if(!win||win.isDestroyed())return Promise.resolve(true);install(win);const s=states.get(win);if(s.pending)return s.pending;if(s.dialogOpen)return Promise.resolve(false);s.dialogOpen=true;
 s.pending=Promise.resolve().then(async()=>{try{const r=await dialog.showMessageBox(win,{type:'question',title:'Выход из программы',message:'Точно хотите закрыть «Учёт дилеров»?',detail:'Несохранённые изменения в открытых формах могут быть потеряны.',buttons:['Остаться','Закрыть программу'],defaultId:0,cancelId:0,noLink:true});return r.response===1}catch{return false}finally{s.dialogOpen=false;s.pending=null;restore(win)}});return s.pending;
}
function allowClose(win){if(win&&!win.isDestroyed()){install(win);states.get(win).allowed=true}}
ipcMain.on('window:dialog',(event,payload)=>{event.returnValue=false;if(!trusted(event))return;const win=BrowserWindow.fromWebContents(event.sender);if(!win||win.isDestroyed())return;install(win);const s=states.get(win);if(s.dialogOpen)return;const confirm=payload?.kind==='confirm';s.dialogOpen=true;try{const response=dialog.showMessageBoxSync(win,{type:confirm?'question':'info',title:'Учёт дилеров',message:String(payload?.message||'').slice(0,12000),buttons:confirm?['Отмена','Подтвердить']:['OK'],defaultId:0,cancelId:0,noLink:true});event.returnValue=confirm?response===1:true}catch{event.returnValue=false}finally{s.dialogOpen=false;setImmediate(()=>restore(win))}});
module.exports={install,confirmExit,allowClose};
