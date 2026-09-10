'use strict';
const {app,BrowserWindow,dialog,ipcMain}=require('electron');
const fs=require('fs');
const path=require('path');
const os=require('os');
const crypto=require('crypto');
const {spawn}=require('child_process');
const windowSafety=require('./window-safety.js');

function mainWindow(){
  const wins=BrowserWindow.getAllWindows();
  return wins.find(w=>!w.isDestroyed())||null;
}
function cmpVersion(a,b){
  const A=String(a||'0').split('.').map(n=>parseInt(n,10)||0),B=String(b||'0').split('.').map(n=>parseInt(n,10)||0);
  for(let i=0;i<Math.max(A.length,B.length);i++){const x=A[i]||0,y=B[i]||0;if(x!==y)return x>y?1:-1}return 0;
}
async function fetchBuffer(url){const r=await fetch(url,{redirect:'follow'});if(!r.ok)throw new Error('HTTP '+r.status);return Buffer.from(await r.arrayBuffer())}
function launchInstallerAfterAppExit(target,args){
  if(process.platform!=='win32')throw new Error('Обновление поддерживается только в Windows');
  const env={...process.env,UCHET_UPDATE_EXE:String(target),UCHET_UPDATE_PID:String(process.pid),UCHET_UPDATE_ARGS:(args||[]).join(' ')};
  const script=`$ErrorActionPreference='SilentlyContinue'; $p=[int]$env:UCHET_UPDATE_PID; Wait-Process -Id $p -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 300; if($env:UCHET_UPDATE_ARGS){ Start-Process -FilePath $env:UCHET_UPDATE_EXE -ArgumentList $env:UCHET_UPDATE_ARGS } else { Start-Process -FilePath $env:UCHET_UPDATE_EXE }`;
  const helper=spawn('powershell.exe',['-NoProfile','-NonInteractive','-WindowStyle','Hidden','-ExecutionPolicy','Bypass','-Command',script],{detached:true,stdio:'ignore',windowsHide:true,env});
  helper.unref();
}
async function closeForUpdateAndLaunch(target,args){
  const win=mainWindow();
  if(win&&!(await windowSafety.confirmExit(win)))return false;
  if(win)windowSafety.allowClose(win);
  launchInstallerAfterAppExit(target,args);
  setImmediate(()=>app.quit());
  setTimeout(()=>{try{app.exit(0)}catch(_){}},1800).unref?.();
  return true;
}

ipcMain.removeHandler('update:checkAndInstall');
ipcMain.handle('update:checkAndInstall',async(_e,manifestUrl)=>{
  try{
    const u=new URL(String(manifestUrl||''));if(!/^https?:$/.test(u.protocol))return {ok:false,message:'Адрес обновлений должен начинаться с http:// или https://'};
    const r=await fetch(u,{cache:'no-store'});if(!r.ok)return {ok:false,message:'Сервер обновлений ответил HTTP '+r.status};
    const m=await r.json();if(!m||!m.version||!m.url)return {ok:false,message:'Неверный файл latest.json на сервере'};
    if(cmpVersion(m.version,app.getVersion())<=0)return {ok:true,message:'Установлена актуальная версия '+app.getVersion()};
    const fileUrl=new URL(m.url,u).toString(),buf=await fetchBuffer(fileUrl);
    if(m.sha256){const got=crypto.createHash('sha256').update(buf).digest('hex');if(got.toLowerCase()!==String(m.sha256).toLowerCase())return {ok:false,message:'Контрольная сумма обновления не совпала'}}
    const target=path.join(os.tmpdir(),'Uchet-dilerov-Setup-'+m.version+'.exe');fs.writeFileSync(target,buf);
    if(!(await closeForUpdateAndLaunch(target,['/S'])))return {ok:false,message:'Обновление отменено.'};
    return {ok:true,message:'Версия '+m.version+' скачана. Программа закроется, затем установка продолжится автоматически.'};
  }catch(e){return {ok:false,message:'Ошибка обновления: '+String(e&&e.message||e)}}
});

ipcMain.removeHandler('update:installFromFile');
ipcMain.handle('update:installFromFile',async()=>{
  try{
    const win=mainWindow();
    const r=await dialog.showOpenDialog(win,{title:'Выбери установщик обновления',properties:['openFile'],filters:[{name:'Установщик Учёт дилеров',extensions:['exe']}]});
    if(r.canceled||!r.filePaths[0])return {ok:false,message:'Установка отменена'};
    const target=r.filePaths[0];
    if(!/Uchet-dilerov-Setup-.*\.exe$/i.test(path.basename(target))){
      const c=await dialog.showMessageBox(win,{type:'warning',buttons:['Продолжить','Отмена'],defaultId:1,cancelId:1,message:'Имя файла не похоже на установщик «Учёт дилеров».',detail:path.basename(target)});
      if(c.response!==0)return {ok:false,message:'Установка отменена'};
    }
    if(!(await closeForUpdateAndLaunch(target,[])))return {ok:false,message:'Обновление отменено.'};
    return {ok:true,message:'Программа закроется, затем установщик запустится автоматически.'};
  }catch(e){return {ok:false,message:'Ошибка запуска установщика: '+String(e&&e.message||e)}}
});

module.exports={cmpVersion,launchInstallerAfterAppExit};
