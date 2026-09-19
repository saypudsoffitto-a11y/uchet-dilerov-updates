'use strict';
const {app,BrowserWindow,dialog,ipcMain,shell}=require('electron');
const fs=require('fs');
const path=require('path');
const os=require('os');
const crypto=require('crypto');
const {spawn}=require('child_process');
const windowSafety=require('./window-safety.js');
const DEFAULT_MANIFEST_URL='https://raw.githubusercontent.com/saypudsoffitto-a11y/uchet-dilerov-updates/main/latest.json';
const DEFAULT_MAC_MANIFEST_URL='https://raw.githubusercontent.com/saypudsoffitto-a11y/uchet-dilerov-updates/main/latest-macos.json';

function mainWindow(){
  const wins=BrowserWindow.getAllWindows();
  return wins.find(w=>!w.isDestroyed())||null;
}
function cmpVersion(a,b){
  const A=String(a||'0').split('.').map(n=>parseInt(n,10)||0),B=String(b||'0').split('.').map(n=>parseInt(n,10)||0);
  for(let i=0;i<Math.max(A.length,B.length);i++){const x=A[i]||0,y=B[i]||0;if(x!==y)return x>y?1:-1}return 0;
}
async function fetchBuffer(url){const r=await fetch(url,{redirect:'follow',cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);return Buffer.from(await r.arrayBuffer())}
async function fetchJson(url){const r=await fetch(url,{redirect:'follow',cache:'no-store',headers:{'Accept':'application/json'}});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}
function manifestUrls(requested){
  const urls=[];
  const add=u=>{if(u&&!urls.includes(u))urls.push(u)};
  try{const u=new URL(String(requested||''));if(/^https?:$/.test(u.protocol))add(u.toString())}catch(_){}
  add(DEFAULT_MANIFEST_URL);
  add('https://github.com/saypudsoffitto-a11y/uchet-dilerov-updates/releases/latest/download/latest.json');
  return urls;
}
async function fetchUpdateManifest(requested){
  const errors=[];
  for(const url of manifestUrls(requested)){
    try{const m=await fetchJson(url);if(m&&m.version&&m.url)return {manifest:m,source:url};errors.push(url+': неверный формат')}
    catch(e){errors.push(url+': '+String(e&&e.message||e))}
  }
  try{
    const rel=await fetchJson('https://api.github.com/repos/saypudsoffitto-a11y/uchet-dilerov-updates/releases/latest');
    const asset=(rel.assets||[]).find(a=>a&&a.name==='latest.json'&&a.browser_download_url);
    if(asset){const m=await fetchJson(asset.browser_download_url);if(m&&m.version&&m.url)return {manifest:m,source:asset.browser_download_url}}
  }catch(e){errors.push('GitHub API: '+String(e&&e.message||e))}
  throw new Error('Не удалось получить файл обновления. '+errors.join(' | '));
}
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
    '>> "%UCHET_UPDATE_LOG%" echo CMD_READY',
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
  const psPath=info.helperPath+'.ps1';
  const env={...process.env,UCHET_UPDATE_EXE:String(target),UCHET_UPDATE_PID:String(process.pid),UCHET_UPDATE_ARGS_JSON:JSON.stringify(args||[]),UCHET_UPDATE_LOG:info.logPath,UCHET_UPDATE_LOCK:info.lockPath};
  const script=[
    "$ErrorActionPreference='SilentlyContinue'",
    "Add-Content -LiteralPath $env:UCHET_UPDATE_LOG -Value 'PS_READY'",
    "$p=[int]$env:UCHET_UPDATE_PID",
    "Wait-Process -Id $p -ErrorAction SilentlyContinue",
    "Start-Sleep -Milliseconds 350",
    "try { New-Item -ItemType Directory -Path $env:UCHET_UPDATE_LOCK -ErrorAction Stop | Out-Null } catch { exit 0 }",
    "Add-Content -LiteralPath $env:UCHET_UPDATE_LOG -Value 'LAUNCHING_INSTALLER'",
    "$a=@(); if($env:UCHET_UPDATE_ARGS_JSON){ try { $a=@(ConvertFrom-Json $env:UCHET_UPDATE_ARGS_JSON) } catch { $a=@() } }",
    "try { if($a.Count -gt 0){ Start-Process -FilePath $env:UCHET_UPDATE_EXE -ArgumentList $a } else { Start-Process -FilePath $env:UCHET_UPDATE_EXE }; Add-Content -LiteralPath $env:UCHET_UPDATE_LOG -Value 'INSTALLER_STARTED' } catch { Add-Content -LiteralPath $env:UCHET_UPDATE_LOG -Value ('ERROR '+$_.Exception.Message); exit 1 }",
    "Remove-Item -LiteralPath $PSCommandPath -Force -ErrorAction SilentlyContinue"
  ].join("\r\n");
  fs.writeFileSync(psPath,script,'utf8');
  const errorFd=fs.openSync(info.logPath+'.stderr','a');
  const helper=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',psPath],{detached:true,stdio:['ignore','ignore',errorFd],windowsHide:true,env});
  fs.closeSync(errorFd);
  helper.on('error',()=>{});
  helper.unref();
  return helper;
}
function spawnNodeHelper(info,target,args){
  const helperPath=info.helperPath+'.cjs';
  const config={parentPid:process.pid,target,args:args||[],logPath:info.logPath,lockPath:info.lockPath};
  const code=`'use strict';
const fs=require('fs'),{spawn}=require('child_process');
const config=${JSON.stringify(config)};
fs.appendFileSync(config.logPath,'NODE_READY\\n');
const timer=setInterval(()=>{
  try{process.kill(config.parentPid,0);return}catch(e){if(e.code!=='ESRCH')return}
  clearInterval(timer);
  try{fs.mkdirSync(config.lockPath)}catch(e){process.exit(0)}
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  const child=spawn(config.target,config.args,{detached:true,stdio:'ignore',windowsHide:false,env});
  child.on('error',e=>{fs.appendFileSync(config.logPath,'ERROR '+e.message);process.exit(1)});
  child.on('spawn',()=>{fs.appendFileSync(config.logPath,'INSTALLER_STARTED');child.unref();try{fs.unlinkSync(__filename)}catch{}});
},200);
`;
  fs.writeFileSync(helperPath,code,'utf8');
  const helper=spawn(process.execPath,[helperPath],{detached:true,stdio:'ignore',windowsHide:true,env:{...process.env,ELECTRON_RUN_AS_NODE:'1'}});
  helper.on('error',()=>{});helper.unref();return helper;
}
async function launchInstallerAfterAppExit(target,args){
  if(process.platform!=='win32')throw new Error('Обновление поддерживается только в Windows');
  if(!fs.existsSync(target))throw new Error('Скачанный установщик не найден');
  const st=fs.statSync(target);if(!st.isFile()||st.size<1024*1024)throw new Error('Скачанный установщик повреждён или слишком мал');
  const info=helperFiles(target,args);

  // Запускаем сразу три независимых helper-а. Они используют общий lock:
  // после закрытия программы только один реально стартует установщик.
  // Это важно для Parallels/VPN/виртуальной Windows: если один механизм
  // завершится вместе с Electron, второй или третий продолжит обновление.
  let nodeHelper=null,ps=null,cmd=null;
  try{nodeHelper=spawnNodeHelper(info,target,args)}catch(_){}
  try{ps=spawnPowerShellFallback(info,target,args)}catch(_){}
  try{cmd=spawnCmdHelper(info)}catch(_){}

  const until=Date.now()+8000;
  let marker='';
  while(Date.now()<until&&!marker){
    try{
      const log=fs.existsSync(info.logPath)?fs.readFileSync(info.logPath,'utf8').replace(/\x00/g,''):'';
      for(const m of ['NODE_READY','PS_READY','CMD_READY'])if(log.includes(m)){marker=m;break}
    }catch(_){}
    if(!marker)await sleep(75);
  }
  if(marker)return {ok:true,mode:'multi',ready:marker,logPath:info.logPath};
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
    const isMac=process.platform==='darwin';
    const requested=isMac?DEFAULT_MAC_MANIFEST_URL:(String(manifestUrl||'').trim()||DEFAULT_MANIFEST_URL);
    const found=isMac?{manifest:await fetchJson(requested),source:requested}:await fetchUpdateManifest(requested);
    const m=found.manifest;if(!m||!m.version||!m.url)return {ok:false,message:'Неверный файл обновления на сервере'};
    if(cmpVersion(m.version,app.getVersion())<=0)return {ok:true,message:'Установлена актуальная версия '+app.getVersion()};
    const fileUrl=new URL(m.url,found.source).toString(),buf=await fetchBuffer(fileUrl);
    if(m.sha256){const got=crypto.createHash('sha256').update(buf).digest('hex');if(got.toLowerCase()!==String(m.sha256).toLowerCase())return {ok:false,message:'Контрольная сумма обновления не совпала'}}
    if(isMac){
      const target=path.join(os.tmpdir(),'Uchet-dilerov-macOS-'+m.version+'-arm64.dmg');
      fs.writeFileSync(target,buf);
      const openError=await shell.openPath(target);
      if(openError)return {ok:false,message:'DMG скачан, но macOS не смогла открыть его: '+openError};
      return {ok:true,message:'Версия '+m.version+' для macOS скачана и открыта. Перетащи «Учёт дилеров» в Applications, затем открой новую версию.'};
    }
    const updateDir=path.join(app.getPath('userData'),'updates');fs.mkdirSync(updateDir,{recursive:true});
    const target=path.join(updateDir,'Uchet-dilerov-Setup-'+m.version+'.exe');fs.writeFileSync(target,buf);
    await closeForUpdateAndLaunch(target,['/S']);
    return {ok:true,message:'Версия '+m.version+' скачана. Программа закроется автоматически, затем установка продолжится.'};
  }catch(e){return {ok:false,message:'Ошибка обновления: '+String(e&&e.message||e)}}
});

ipcMain.removeHandler('update:installFromFile');
ipMainSafeHandle('update:installFromFile',async()=>{
  try{
    const win=mainWindow();
    const isMac=process.platform==='darwin';
    const r=await dialog.showOpenDialog(win,{title:'Выбери установщик обновления',properties:['openFile'],filters:[isMac?{name:'Учёт дилеров для macOS',extensions:['dmg']}:{name:'Установщик Учёт дилеров',extensions:['exe']}]});
    if(r.canceled||!r.filePaths[0])return {ok:false,message:'Установка отменена'};
    const target=r.filePaths[0];
    if(isMac){
      const openError=await shell.openPath(target);
      if(openError)return {ok:false,message:'Не удалось открыть DMG: '+openError};
      return {ok:true,message:'DMG открыт. Перетащи «Учёт дилеров» в Applications.'};
    }
    if(!/Uchet-dilerov-Setup-.*\.exe$/i.test(path.basename(target))){
      const c=await dialog.showMessageBox(win,{type:'warning',buttons:['Продолжить','Отмена'],defaultId:1,cancelId:1,message:'Имя файла не похоже на установщик «Учёт дилеров».',detail:path.basename(target)});
      if(c.response!==0)return {ok:false,message:'Установка отменена'};
    }
    await closeForUpdateAndLaunch(target,[]);
    return {ok:true,message:'Программа закроется автоматически, затем установщик запустится.'};
  }catch(e){return {ok:false,message:'Ошибка запуска установщика: '+String(e&&e.message||e)}}
});

function ipMainSafeHandle(channel,handler){ipcMain.handle(channel,handler)}
module.exports={cmpVersion,launchInstallerAfterAppExit,closeForUpdateAndLaunch,DEFAULT_MANIFEST_URL,DEFAULT_MAC_MANIFEST_URL};
