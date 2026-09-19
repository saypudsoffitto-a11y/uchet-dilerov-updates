const { app, BrowserWindow, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const windowSafety = require('./window-safety.js');

// Windows-only build. Disabling GPU acceleration avoids a common class of
// startup crashes on older/integrated Windows graphics drivers.
if (process.platform === 'win32') app.disableHardwareAcceleration();

let mainWindow = null;
let nmWatcher = null;
let nmTimers = new Map();
const nmFolder = 'C:\\NewMatRos Standart';

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

function decodeIni(buf) {
  const bytes = new Uint8Array(buf);
  if(bytes[0]===0xff&&bytes[1]===0xfe)return new TextDecoder('utf-16le').decode(bytes).replace(/^\uFEFF/,'');
  if(bytes[0]===0xfe&&bytes[1]===0xff)return new TextDecoder('utf-16be').decode(bytes).replace(/^\uFEFF/,'');
  try { return new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,''); }
  catch (_) { return new TextDecoder('windows-1251').decode(bytes).replace(/^\uFEFF/,''); }
}
function sendIniFile(filePath) {
  try {
    const text = decodeIni(fs.readFileSync(filePath));
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('newmatros:ini', { name: path.basename(filePath), path: filePath, text });
    }
  } catch (e) {
    console.error('NewMatRos INI read error:', e);
  }
}
function stopNmWatcher(){
  if(nmWatcher){ try{nmWatcher.close()}catch(_){} nmWatcher=null; }
  for(const t of nmTimers.values()) clearTimeout(t);
  nmTimers.clear();
}
function startNmWatcher(){
  stopNmWatcher();
  if(process.platform!=='win32') return {ok:false,error:'Автоматическое слежение NewMatRos доступно только в Windows. На Mac можно выбрать INI-файл вручную.'};
  if(!fs.existsSync(nmFolder)) return {ok:false,error:'Папка '+nmFolder+' не найдена. Можно выбрать INI-файл вручную.'};
  try{
    nmWatcher=fs.watch(nmFolder,{persistent:false},(_event,filename)=>{
      if(!filename || path.extname(filename).toLowerCase()!=='.ini') return;
      const full=path.join(nmFolder,filename);
      if(nmTimers.has(full)) clearTimeout(nmTimers.get(full));
      nmTimers.set(full,setTimeout(()=>{
        nmTimers.delete(full);
        if(fs.existsSync(full)) sendIniFile(full);
      },900));
    });
    return {ok:true,folder:nmFolder};
  }catch(e){return {ok:false,error:e.message};}
}

async function createWindow() {
  try {
    const win = new BrowserWindow({
      width: 1360,
      height: 860,
      minWidth: 1100,
      minHeight: 700,
      show: false,
      backgroundColor: '#f3f6f4',
      title: 'Учёт дилеров',
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        preload: path.join(__dirname,'preload.js')
      }
    });
    mainWindow = win;
    windowSafety.install(win);
    win.once('ready-to-show',()=>win.show());
    await win.loadFile(path.join(__dirname,'index.html'));
    try {
      const patchPath=path.join(__dirname,'renderer-patch.js');
      if(fs.existsSync(patchPath)){
        const patch=fs.readFileSync(patchPath,'utf8');
        await win.webContents.executeJavaScript(patch,true);
      }
    } catch(e) { console.error('Renderer patch error:',e); }
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//i.test(url)) { shell.openExternal(url); return { action: 'deny' }; }
      return { action: 'deny' };
    });
    win.on('closed',()=>{ if(mainWindow===win) mainWindow=null; stopNmWatcher(); });
  } catch (e) {
    console.error('Window startup error:', e);
    dialog.showErrorBox('Учёт дилеров — ошибка запуска', 'Приложение не смогло открыть главное окно.\n\n'+String(e && e.message || e));
    app.quit();
  }
}

ipcMain.handle('newmatros:chooseIni', async () => {
  try {
    const r = await dialog.showOpenDialog(mainWindow,{title:'Выбери файл NewMatRos',defaultPath:process.platform==='win32'?nmFolder:app.getPath('documents'),properties:['openFile'],filters:[{name:'NewMatRos INI',extensions:['ini']},{name:'Все файлы',extensions:['*']} ]});
    if(r.canceled||!r.filePaths[0]) return {canceled:true};
    const filePath=r.filePaths[0];
    return {canceled:false,name:path.basename(filePath),path:filePath,text:decodeIni(fs.readFileSync(filePath))};
  } catch (e) { return {canceled:true,error:e.message}; }
});
ipcMain.handle('newmatros:setWatch', (_e,enabled) => enabled ? startNmWatcher() : (stopNmWatcher(),{ok:true,folder:nmFolder}));

ipcMain.handle('newmatros:rereadIni', (_e, name) => {
  try {
    // Recovery is restricted to INI basenames in the existing NewMatRos folder.
    if(typeof name!=='string'||name!==path.win32.basename(name)||/[\\/\x00:]/.test(name)||!/^.+\.ini$/i.test(name))return {error:'Некорректное имя выгрузки'};
    const filePath=path.join(nmFolder,name);
    const realFolder=fs.realpathSync(nmFolder),realFile=fs.realpathSync(filePath);
    if(path.dirname(realFile)!==realFolder)return {error:'Файл находится вне папки NewMatRos'};
    return {name,path:filePath,text:decodeIni(fs.readFileSync(realFile))};
  }catch(e){return {error:'Не удалось перечитать выгрузку: '+String(e&&e.message||e)}}
});

function decodeCsv(buf) {
  try { return new TextDecoder('windows-1251').decode(buf); }
  catch (_) { return buf.toString('utf8'); }
}
ipcMain.handle('stock:chooseCsv', async (_e, kind) => {
  try {
    const r = await dialog.showOpenDialog(mainWindow,{title:kind==='dealers'?'Выбери CSV со списком дилеров':'Выбери CSV с товарами из программы «Склад»',properties:['openFile'],filters:[{name:'CSV',extensions:['csv']},{name:'Все файлы',extensions:['*']}]});
    if(r.canceled||!r.filePaths[0]) return {canceled:true};
    const filePath=r.filePaths[0];
    return {canceled:false,name:path.basename(filePath),path:filePath,text:decodeCsv(fs.readFileSync(filePath))};
  } catch(e) { return {canceled:true,error:e.message}; }
});
ipcMain.handle('stock:loadBundledProducts', async () => {
  try {
    const candidates=[path.join(__dirname,'tovar.csv'),path.join(process.resourcesPath,'app.asar.unpacked','tovar.csv')];
    const filePath=candidates.find(fs.existsSync);
    if(!filePath)return {canceled:true,error:'Встроенный файл tovar.csv не найден'};
    return {canceled:false,name:'tovar.csv',path:filePath,text:decodeCsv(fs.readFileSync(filePath))};
  } catch(e) { return {canceled:true,error:e.message}; }
});

ipcMain.handle('clients:loadBundledNewMatRos', async () => {
  try {
    const candidates=[path.join(__dirname,'newmatros_clients.json'),path.join(process.resourcesPath,'app.asar.unpacked','newmatros_clients.json')];
    const filePath=candidates.find(fs.existsSync);
    if(!filePath)return {canceled:true,error:'Встроенный список клиентов NewMatRos не найден'};
    return {canceled:false,name:'newmatros_clients.json',path:filePath,clients:JSON.parse(fs.readFileSync(filePath,'utf8'))};
  } catch(e) { return {canceled:true,error:e.message}; }
});

ipcMain.handle('app:info',()=>({version:app.getVersion(),platform:process.platform,arch:process.arch,userData:app.getPath('userData')}));

ipcMain.handle('whatsapp:send', async (_e, payload) => {
  try {
    let phone=String(payload&&payload.phone||'').replace(/\D/g,'');
    if(phone.length===11&&phone[0]==='8')phone='7'+phone.slice(1);
    const text=String(payload&&payload.text||'');
    const url='whatsapp://send?'+(phone?('phone='+encodeURIComponent(phone)+'&'):'')+'text='+encodeURIComponent(text);
    await shell.openExternal(url);
    return {ok:true};
  } catch(e) {
    return {ok:false,message:'Не удалось открыть WhatsApp Desktop. Установи WhatsApp Desktop и повтори попытку.'};
  }
});

function safePdfName(name){
  let n=String(name||'Товарная_накладная.pdf').replace(/[<>:"/\\|?*\x00-\x1F]/g,'_').trim();
  if(!/\.pdf$/i.test(n))n+='.pdf';
  return n||'Товарная_накладная.pdf';
}
async function htmlToPdf(html){
  const w=new BrowserWindow({show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,javascript:false}});
  try{
    await w.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(String(html||'')));
    return await w.webContents.printToPDF({printBackground:true,pageSize:'A4',margins:{top:0.35,bottom:0.35,left:0.35,right:0.35}});
  } finally {
    if(!w.isDestroyed())w.destroy();
  }
}
function copyFileToClipboardWindows(filePath){
  return new Promise(resolve=>{
    if(process.platform!=='win32')return resolve(false);
    const q=String(filePath).replace(/'/g,"''");
    const script=`Add-Type -AssemblyName System.Windows.Forms; $f=New-Object System.Collections.Specialized.StringCollection; [void]$f.Add('${q}'); [System.Windows.Forms.Clipboard]::SetFileDropList($f)`;
    try{
      const p=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true});
      let done=false;const finish=v=>{if(done)return;done=true;resolve(v)};
      p.on('error',()=>finish(false));p.on('exit',code=>finish(code===0));setTimeout(()=>{try{p.kill()}catch(_){}finish(false)},5000);
    }catch(_){resolve(false)}
  });
}

ipcMain.handle('receipt:savePdf', async (_e,payload)=>{
  try{
    const pdf=await htmlToPdf(payload&&payload.html);
    const name=safePdfName(payload&&payload.fileName);
    const r=await dialog.showSaveDialog(mainWindow,{title:'Сохранить товарную накладную PDF',defaultPath:path.join(app.getPath('documents'),name),filters:[{name:'PDF',extensions:['pdf']}]});
    if(r.canceled||!r.filePath)return {ok:false,canceled:true};
    fs.writeFileSync(r.filePath,pdf);
    return {ok:true,path:r.filePath};
  }catch(e){return {ok:false,message:'Не удалось создать PDF: '+String(e&&e.message||e)}}
});

ipcMain.handle('receipt:sendPdfWhatsApp', async (_e,payload)=>{
  try{
    const pdf=await htmlToPdf(payload&&payload.html);
    const dir=path.join(app.getPath('temp'),'uchet-dilerov-pdf');fs.mkdirSync(dir,{recursive:true});
    const filePath=path.join(dir,safePdfName(payload&&payload.fileName));fs.writeFileSync(filePath,pdf);
    const copied=await copyFileToClipboardWindows(filePath);
    let phone=String(payload&&payload.phone||'').replace(/\D/g,'');if(phone.length===11&&phone[0]==='8')phone='7'+phone.slice(1);
    await shell.openExternal('whatsapp://send?'+(phone?'phone='+encodeURIComponent(phone):''));
    if(!copied){shell.showItemInFolder(filePath);return {ok:true,path:filePath,message:'PDF создан. WhatsApp открыт, а файл выделен в Проводнике — прикрепи его к сообщению.'}}
    return {ok:true,path:filePath,message:'PDF создан и скопирован как файл. В открывшемся WhatsApp нажми Ctrl+V и отправь накладную.'};
  }catch(e){return {ok:false,message:'Не удалось подготовить PDF для WhatsApp: '+String(e&&e.message||e)}}
});

function cmpVersion(a,b){
  const A=String(a||'0').split('.').map(n=>parseInt(n,10)||0),B=String(b||'0').split('.').map(n=>parseInt(n,10)||0);
  for(let i=0;i<Math.max(A.length,B.length);i++){let x=A[i]||0,y=B[i]||0;if(x!==y)return x>y?1:-1}return 0;
}
async function fetchBuffer(url){
  const r=await fetch(url,{redirect:'follow',cache:'no-store'});
  if(!r.ok)throw new Error('HTTP '+r.status);
  return Buffer.from(await r.arrayBuffer());
}
async function fetchJson(url){
  const r=await fetch(url,{redirect:'follow',cache:'no-store',headers:{'Accept':'application/json'}});
  if(!r.ok)throw new Error('HTTP '+r.status);
  return await r.json();
}
function updaterManifestName(){
  return process.platform==='darwin'?'latest-macos.json':'latest.json';
}
function updaterManifestUrls(requested){
  const name=updaterManifestName();
  const urls=[];
  const add=u=>{if(u&&!urls.includes(u))urls.push(u)};
  try{
    if(requested){
      const u=new URL(String(requested));
      if(/^https?:$/.test(u.protocol)){
        if(process.platform==='darwin'&&/latest\.json$/i.test(u.pathname))u.pathname=u.pathname.replace(/latest\.json$/i,'latest-macos.json');
        if(process.platform==='win32'&&/latest-macos\.json$/i.test(u.pathname))u.pathname=u.pathname.replace(/latest-macos\.json$/i,'latest.json');
        add(u.toString());
      }
    }
  }catch(_){}
  add('https://raw.githubusercontent.com/saypudsoffitto-a11y/uchet-dilerov-updates/main/'+name);
  add('https://github.com/saypudsoffitto-a11y/uchet-dilerov-updates/releases/latest/download/'+name);
  return urls;
}
async function fetchUpdateManifest(requested){
  const errors=[];
  for(const url of updaterManifestUrls(requested)){
    try{
      const m=await fetchJson(url);
      if(m&&m.version&&m.url)return {manifest:m,source:url};
      errors.push(url+': неверный формат');
    }catch(e){errors.push(url+': '+String(e&&e.message||e))}
  }
  try{
    const rel=await fetchJson('https://api.github.com/repos/saypudsoffitto-a11y/uchet-dilerov-updates/releases/latest');
    const name=updaterManifestName();
    const asset=(rel.assets||[]).find(a=>a&&a.name===name&&a.browser_download_url);
    if(asset){
      const m=await fetchJson(asset.browser_download_url);
      if(m&&m.version&&m.url)return {manifest:m,source:asset.browser_download_url};
    }
  }catch(e){errors.push('GitHub API: '+String(e&&e.message||e))}
  throw new Error('Не удалось получить файл обновления. '+errors.join(' | '));
}
function sha256(buf){return crypto.createHash('sha256').update(buf).digest('hex').toLowerCase()}
function runProcess(command,args,options){
  return new Promise((resolve,reject)=>{
    let p;
    try{p=spawn(command,args||[],{stdio:'ignore',...(options||{})})}catch(e){reject(e);return}
    p.once('error',reject);
    p.once('exit',code=>code===0?resolve():reject(new Error(path.basename(command)+' завершился с кодом '+code)));
  });
}
function findMacApp(dir){
  const queue=[dir];
  while(queue.length){
    const cur=queue.shift();
    let entries=[];try{entries=fs.readdirSync(cur,{withFileTypes:true})}catch(_){continue}
    for(const e of entries){
      const full=path.join(cur,e.name);
      if(e.isDirectory()&&/\.app$/i.test(e.name))return full;
      if(e.isDirectory()&&queue.length<20)queue.push(full);
    }
  }
  return '';
}
function shellQuote(v){return "'"+String(v).replace(/'/g,"'\\''")+"'";}
async function prepareMacZipInstall(zipPath,version){
  const root=path.join(os.tmpdir(),'uchet-dilerov-macos-'+String(version).replace(/[^0-9A-Za-z._-]/g,'_'));
  try{fs.rmSync(root,{recursive:true,force:true})}catch(_){}
  fs.mkdirSync(root,{recursive:true});
  await runProcess('/usr/bin/ditto',['-x','-k',zipPath,root]);
  const src=findMacApp(root);
  if(!src)throw new Error('В архиве обновления не найдено приложение .app');
  let current=path.resolve(path.dirname(process.execPath),'../..');
  if(!/\.app$/i.test(current)||/AppTranslocation/i.test(current))current=path.join(os.homedir(),'Applications','Учёт дилеров.app');
  const fallback=path.join(os.homedir(),'Applications',path.basename(current));
  const script=path.join(os.tmpdir(),'uchet-dilerov-install-'+String(version).replace(/[^0-9A-Za-z._-]/g,'_')+'.sh');
  const scriptText=[
    '#!/bin/sh',
    'PID='+String(process.pid),
    'SRC='+shellQuote(src),
    'DST='+shellQuote(current),
    'FALLBACK='+shellQuote(fallback),
    'while /bin/kill -0 "$PID" 2>/dev/null; do /bin/sleep 0.3; done',
    'PARENT=$(/usr/bin/dirname "$DST")',
    'if [ -w "$PARENT" ]; then',
    '  /bin/rm -rf "$DST"',
    '  /usr/bin/ditto "$SRC" "$DST" || exit 1',
    '  /usr/bin/xattr -dr com.apple.quarantine "$DST" 2>/dev/null || true',
    '  /usr/bin/open "$DST"',
    'else',
    '  /bin/mkdir -p "$HOME/Applications"',
    '  /bin/rm -rf "$FALLBACK"',
    '  /usr/bin/ditto "$SRC" "$FALLBACK" || exit 1',
    '  /usr/bin/xattr -dr com.apple.quarantine "$FALLBACK" 2>/dev/null || true',
    '  /usr/bin/open "$FALLBACK"',
    'fi',
    '/bin/rm -f "$0"'
  ].join('\n')+'\n';
  fs.writeFileSync(script,scriptText,{mode:0o700});
  const child=spawn('/bin/sh',[script],{detached:true,stdio:'ignore'});
  child.unref();
}
ipcMain.handle('update:saveBackup', async (_e, jsonText) => {
  try {
    const dir=path.join(app.getPath('userData'),'update-backups');
    fs.mkdirSync(dir,{recursive:true});
    const stamp=new Date().toISOString().replace(/[:.]/g,'-');
    const file=path.join(dir,'uchet-before-update-'+stamp+'.json');
    fs.writeFileSync(file,String(jsonText||''),'utf8');
    const files=fs.readdirSync(dir).filter(x=>x.endsWith('.json')).sort().reverse();
    files.slice(10).forEach(x=>{try{fs.unlinkSync(path.join(dir,x))}catch(_){}});
    return {ok:true,path:file};
  } catch(e) { return {ok:false,message:String(e&&e.message||e)}; }
});

ipcMain.handle('update:checkAndInstall', async (_e, manifestUrl) => {
  try{
    const found=await fetchUpdateManifest(manifestUrl);
    const m=found.manifest;
    if(m.platform&&process.platform==='darwin'&&m.platform!=='darwin')return {ok:false,message:'Сервер вернул обновление не для macOS'};
    if(cmpVersion(m.version,app.getVersion())<=0)return {ok:true,message:'Установлена актуальная версия '+app.getVersion()};

    if(process.platform==='darwin'){
      const downloadUrl=String(m.zipUrl||m.url||'');
      if(!downloadUrl)return {ok:false,message:'В обновлении macOS не указан файл для загрузки'};
      const buf=await fetchBuffer(downloadUrl);
      const expected=String(m.zipSha256||(!m.zipUrl?m.sha256:'')||'').toLowerCase();
      if(expected&&sha256(buf)!==expected)return {ok:false,message:'Контрольная сумма обновления macOS не совпала'};
      if(m.zipUrl||/\.zip(?:\?|$)/i.test(downloadUrl)){
        const target=path.join(os.tmpdir(),'Uchet-dilerov-macOS-'+m.version+'-'+process.arch+'.zip');
        fs.writeFileSync(target,buf);
        if(!(await windowSafety.confirmExit(mainWindow)))return {ok:false,message:'Обновление отменено.'};
        await prepareMacZipInstall(target,m.version);
        windowSafety.allowClose(mainWindow);
        setTimeout(()=>app.quit(),500);
        return {ok:true,message:'Версия '+m.version+' скачана. Устанавливаю и перезапускаю программу…'};
      }
      const target=path.join(os.tmpdir(),'Uchet-dilerov-macOS-'+m.version+'.dmg');
      fs.writeFileSync(target,buf);
      const openError=await shell.openPath(target);
      if(openError)return {ok:false,message:'DMG скачан, но не удалось открыть: '+openError};
      return {ok:true,message:'Версия '+m.version+' скачана. Открыт установочный DMG.'};
    }

    if(process.platform!=='win32')return {ok:false,message:'Автообновление для этой системы пока не поддерживается'};
    const fileUrl=String(m.url||'');
    const buf=await fetchBuffer(fileUrl);
    if(m.sha256&&sha256(buf)!==String(m.sha256).toLowerCase())return {ok:false,message:'Контрольная сумма обновления не совпала'};
    const target=path.join(os.tmpdir(),'Uchet-dilerov-Setup-'+m.version+'.exe');
    fs.writeFileSync(target,buf);
    if(!(await windowSafety.confirmExit(mainWindow)))return {ok:false,message:'Обновление отменено.'};
    const child=spawn(target,['/S'],{detached:true,stdio:'ignore'});
    child.unref();
    windowSafety.allowClose(mainWindow);
    setTimeout(()=>app.quit(),700);
    return {ok:true,message:'Версия '+m.version+' скачана. Запускаю установку…'};
  }catch(e){
    return {ok:false,message:'Ошибка обновления: '+String(e&&e.message||e)};
  }
});

ipcMain.handle('sync:request', async (_e, req) => {
  try {
    const base = String(req && req.baseUrl || '').trim().replace(/\/+$/,'');
    const u = new URL(base + '/api/state');
    if (!/^https?:$/.test(u.protocol)) return {ok:false,message:'Адрес сервера должен начинаться с http:// или https://'};
    const method = String(req && req.method || 'GET').toUpperCase();
    const headers = {'Accept':'application/json'};
    const token = String(req && req.token || '');
    if (token) headers['Authorization'] = 'Bearer ' + token;
    let options={method,headers,cache:'no-store'};
    if(method==='PUT' || method==='POST') { headers['Content-Type']='application/json'; options.body=JSON.stringify(req.body||{}); }
    const r=await fetch(u,options); let data=null;
    try{data=await r.json()}catch(_){data={message:'Сервер вернул не JSON'}}
    if(r.status===409) return {ok:false,conflict:true,revision:data&&data.revision,state:data&&data.state,message:data&&data.message||'Конфликт версии базы'};
    if(!r.ok) return {ok:false,message:(data&&data.message)||('HTTP '+r.status)};
    return data;
  } catch(e) { return {ok:false,message:'Ошибка связи с сервером: '+String(e&&e.message||e)}; }
});

ipcMain.handle('update:installFromFile', async () => {
  try {
    const isMac=process.platform==='darwin';
    const filters=isMac
      ? [{name:'Обновление Учёт дилеров',extensions:['zip','dmg']}]
      : [{name:'Установщик Учёт дилеров',extensions:['exe']}];
    const r=await dialog.showOpenDialog(mainWindow,{title:'Выбери файл обновления',properties:['openFile'],filters});
    if(r.canceled||!r.filePaths[0])return {ok:false,message:'Установка отменена'};
    const target=r.filePaths[0];

    if(isMac){
      if(/\.dmg$/i.test(target)){
        const err=await shell.openPath(target);
        return err?{ok:false,message:'Не удалось открыть DMG: '+err}:{ok:true,message:'Установочный DMG открыт.'};
      }
      if(!/\.zip$/i.test(target))return {ok:false,message:'Для macOS выбери ZIP или DMG обновления'};
      if(!(await windowSafety.confirmExit(mainWindow)))return {ok:false,message:'Обновление отменено.'};
      await prepareMacZipInstall(target,'file');
      windowSafety.allowClose(mainWindow);
      setTimeout(()=>app.quit(),500);
      return {ok:true,message:'Устанавливаю обновление и перезапускаю программу…'};
    }

    if(process.platform!=='win32')return {ok:false,message:'Установка из файла для этой системы не поддерживается'};
    if(!/\.exe$/i.test(target))return {ok:false,message:'Для Windows выбери EXE-установщик'};
    if(!(await windowSafety.confirmExit(mainWindow)))return {ok:false,message:'Обновление отменено.'};
    const child=spawn(target,[],{detached:true,stdio:'ignore'});
    child.unref();
    windowSafety.allowClose(mainWindow);
    setTimeout(()=>app.quit(),700);
    return {ok:true,message:'Запускаю установщик обновления…'};
  } catch(e) {
    return {ok:false,message:'Ошибка запуска обновления: '+String(e&&e.message||e)};
  }
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

process.on('uncaughtException', e => console.error('uncaughtException', e));
process.on('unhandledRejection', e => console.error('unhandledRejection', e));

app.whenReady().then(() => {
  if (!gotLock) return;
  createWindow();
});
app.on('window-all-closed', () => { stopNmWatcher(); app.quit(); });
