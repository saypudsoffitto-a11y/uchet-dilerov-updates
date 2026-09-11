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
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
function cmdValue(v){return String(v==null?'':v).replace(/%/g,'%%').replace(/[\r\n]/g,' ')}
async function waitForMarker(logPath,marker,timeoutMs){
  const until=Date.now()+(timeoutMs||1800);
  while(Date.now()<until){
    try{if(fs.existsSync(logPath)&&fs.readFileSync(logPath,'utf8').replace(/\x00/g,'').includes(marker))return true}catch(_){}
    await sleep(75);
  }
  return false;
}
function helperFiles(target,args){
  const token=process.pid+'-'+Date.now();
  const helperPath=path.join(os.tmpdir(),'uchet-update-'+token+'.cmd');
  const logPath=path.join(os.tmpdir(),'uchet-update-'+token+'.log');
  const lockPath=path.join(os.tmpdir(),'uchet-update-'+token+'.lock');
  const argLine=(args||[]).map(a=>'"'+cmdValue(a).replace(/"/g,'""')+'"').join(' ');
  const lines=[
    '@echo off',
    'setlocal DisableDelayedExpansion',
    'set "UCHET_UPDATE_EXE='+cmdValue(target)+'"',
    'set "UCHET_UPDATE_PID='+process.pid+'"',
    'set "UCHET_UPDATE_LOG='+cmdValue(logPath)+'"',
    'set "UCHET_UPDATE_LOCK='+cmdValue(lockPath)+'"',
    '> "%UCHET_UPDATE_LOG%" echo CMD_READY',
    ':waitloop',
    'tasklist /FI "PID eq %UCHET_UPDATE_PID%" /NH 2>nul | findstr /R /C:"[ ]%UCHET_UPDATE_PID%[ ]" >nul',
    'if not errorlevel 1 (',
    '  >nul 2>&1 ping 127.0.0.1 -n 2',
    '  goto waitloop',
    ')',
    'mkdir "%UCHET_UPDATE_LOCK%" 2>nul',
    'if errorlevel 1 exit /b 0',
    '>> "%UCHET_UPDATE_LOG%" echo LAUNCHING_INSTALLER',
    'start "" "%UCHET_UPDATE_EXE%" '+argLine,
    'set "UCHET_UPDATE_EC=%errorlevel%"',
    '>> "%UCHET_UPDATE_LOG%" echo START_RESULT=%UCHET_UPDATE_EC%',
    'endlocal',
    'del "%~f0" >nul 2>&1'
  ];
  fs.writeFileSync(helperPath,lines.join('\r\n'),'utf8');
  try{fs.unlinkSync(logPath)}catch(_){}
  return {helperPath,logPath,lockPath};
}
function spawnCmdHelper(info){
  const comspec=process.env.ComSpec||process.env.COMSPEC||'cmd.exe';
  const helper=spawn(comspec,['/d','/s','/c','""'+info.helperPath+'""'],{detached:true,stdio:'ignore',windowsHide:true,windowsVerbatimArguments:true,env:{...process.env}});
  helper.on('error',()=>{});
  helper.unref();
  return helper;
}
function spawnPowerShellFallback(info,target,args){
  const env={...process.env,UCHET_UPDATE_EXE:String(target),UCHET_UPDATE_PID:String(process.pid),UCHET_UPDATE_ARGS:(args||[]).map(a=>'"'+String(a).replace(/"/g,'\\"')+'"').join(' '),UCHET_UPDATE_LOG:info.logPath,UCHET_UPDATE_LOCK:info.lockPath};
  const script=`$ErrorActionPreference='SilentlyContinue'; Add-Content -Path $env:UCHET_UPDATE_LOG -Value 'PS_READY'; $p=[int]$env:UCHET_UPDATE_PID; Wait-Process -Id $p -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 300; try { New-Item -ItemType Directory -Path $env:UCHET_UPDATE_LOCK -ErrorAction Stop | Out-Null } catch { exit 0 }; if($env:UCHET_UPDATE_ARGS){ Start-Process -FilePath $env:UCHET_UPDATE_EXE -ArgumentList $env:UCHET_UPDATE_ARGS } else { Start-Process -FilePath $env:UCHET_UPDATE_EXE }`;
  const helper=spawn('powershell.exe',['-NoProfile','-NonInteractive','-WindowStyle','Hidden','-ExecutionPolicy','Bypass','-Command',script],{detached:true,stdio:'ignore',windowsHide:true,env});
  helper.on('error',()=>{});
  helper.unref();
  return helper;
}
async function launchInstallerAfterAppExit(target,args){
  if(process.platform!=='win32')throw new Error('Обновление поддерживается только в Windows');
  if(!fs.existsSync(target))throw new Error('Скачанный установщик не найден');
  const st=fs.statSync(target);if(!st.isFile()||st.size<1024*1024)throw new Error('Скачанный установщик повреждён или слишком мал');
  const info=helperFiles(target,args);
  let ps=null;try{ps=spawnPowerShellFallback(info,target,args)}catch(_){}
  if(ps&&ps.pid&&await waitForMarker(info.logPath,'PS_READY',5000))return {ok:true,mode:'powershell',logPath:info.logPath};
  let cmd=null;try{cmd=spawnCmdHelper(info)}catch(_){}
  if(cmd&&cmd.pid&&await waitForMarker(info.logPath,'CMD_READY',5000))return {ok:true,mode:'cmd',logPath:info.logPath};
  throw new Error('Не удалось запустить службу обновления. Программа останется открытой.');
}
async function closeForUpdateAndLaunch(target,args){
  const win=mainWindow();
  // Сначала убеждаемся, что отдельный helper реально запущен. Только потом закрываем приложение.
  const helper=await launchInstallerAfterAppExit(target,args);
  // При обновлении НЕ показываем обычное подтверждение закрытия: нажатие кнопки обновления уже является явным действием пользователя.
  if(win)windowSafety.allowClose(win);
  setImmediate(()=>app.quit());
  const timer=setTimeout(()=>{try{app.exit(0)}catch(_){}},1800);
  if(timer&&typeof timer.unref==='function')timer.unref();
  return helper;
}

ipcMain.removeHandler('update:checkAndInstall');
ipMainSafeHandle('update:checkAndInstall',async(_e,manifestUrl)=>{
  try{
    const u=new URL(String(manifestUrl||''));if(!/^https?:$/.test(u.protocol))return {ok:false,message:'Адрес обновлений должен начинаться с http:// или https://'};
    const r=await fetch(u,{cache:'no-store'});if(!r.ok)return {ok:false,message:'Сервер обновлений ответил HTTP '+r.status};
    const m=await r.json();if(!m||!m.version||!m.url)return {ok:false,message:'Неверный файл latest.json на сервере'};
    if(cmpVersion(m.version,app.getVersion())<=0)return {ok:true,message:'Установлена актуальная версия '+app.getVersion()};
    const fileUrl=new URL(m.url,u).toString(),buf=await fetchBuffer(fileUrl);
    if(m.sha256){const got=crypto.createHash('sha256').update(buf).digest('hex');if(got.toLowerCase()!==String(m.sha256).toLowerCase())return {ok:false,message:'Контрольная сумма обновления не совпала'}}
    const target=path.join(os.tmpdir(),'Uchet-dilerov-Setup-'+m.version+'.exe');fs.writeFileSync(target,buf);
    await closeForUpdateAndLaunch(target,['/S']);
    return {ok:true,message:'Версия '+m.version+' скачана. Программа закроется автоматически, затем установка продолжится.'};
  }catch(e){return {ok:false,message:'Ошибка обновления: '+String(e&&e.message||e)}}
});

ipcMain.removeHandler('update:installFromFile');
ipMainSafeHandle('update:installFromFile',async()=>{
  try{
    const win=mainWindow();
    const r=await dialog.showOpenDialog(win,{title:'Выбери установщик обновления',properties:['openFile'],filters:[{name:'Установщик Учёт дилеров',extensions:['exe']}]});
    if(r.canceled||!r.filePaths[0])return {ok:false,message:'Установка отменена'};
    const target=r.filePaths[0];
    if(!/Uchet-dilerov-Setup-.*\.exe$/i.test(path.basename(target))){
      const c=await dialog.showMessageBox(win,{type:'warning',buttons:['Продолжить','Отмена'],defaultId:1,cancelId:1,message:'Имя файла не похоже на установщик «Учёт дилеров».',detail:path.basename(target)});
      if(c.response!==0)return {ok:false,message:'Установка отменена'};
    }
    await closeForUpdateAndLaunch(target,[]);
    return {ok:true,message:'Программа закроется автоматически, затем установщик запустится.'};
  }catch(e){return {ok:false,message:'Ошибка запуска установщика: '+String(e&&e.message||e)}}
});

function ipMainSafeHandle(channel,handler){ipcMain.handle(channel,handler)}
module.exports={cmpVersion,launchInstallerAfterAppExit,closeForUpdateAndLaunch};
