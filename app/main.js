const { app, BrowserWindow, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');

// Windows-only build. Disabling GPU acceleration avoids a common class of
// startup crashes on older/integrated Windows graphics drivers.
app.disableHardwareAcceleration();

let mainWindow = null;
let nmWatcher = null;
let nmTimers = new Map();
const nmFolder = 'C:\\NewMatRos Standart';

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

function decodeIni(buf) {
  try { return new TextDecoder('windows-1251').decode(buf); }
  catch (_) { return buf.toString('utf8'); }
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
      backgroundColor: '#f5f7fa',
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
    win.once('ready-to-show',()=>win.show());
    await win.loadFile(path.join(__dirname,'index.html'));
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
    const r = await dialog.showOpenDialog(mainWindow,{title:'Выбери файл NewMatRos',defaultPath:nmFolder,properties:['openFile'],filters:[{name:'NewMatRos INI',extensions:['ini']},{name:'Все файлы',extensions:['*']} ]});
    if(r.canceled||!r.filePaths[0]) return {canceled:true};
    const filePath=r.filePaths[0];
    return {canceled:false,name:path.basename(filePath),path:filePath,text:decodeIni(fs.readFileSync(filePath))};
  } catch (e) { return {canceled:true,error:e.message}; }
});
ipcMain.handle('newmatros:setWatch', (_e,enabled) => enabled ? startNmWatcher() : (stopNmWatcher(),{ok:true,folder:nmFolder}));

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
    return {ok:false,message:'Не удалось открыть WhatsApp Desktop. Установи приложение WhatsApp для Windows и повтори попытку.'};
  }
});

function cmpVersion(a,b){
  const A=String(a||'0').split('.').map(n=>parseInt(n,10)||0),B=String(b||'0').split('.').map(n=>parseInt(n,10)||0);
  for(let i=0;i<Math.max(A.length,B.length);i++){let x=A[i]||0,y=B[i]||0;if(x!==y)return x>y?1:-1}return 0;
}
async function fetchBuffer(url){
  const r=await fetch(url,{redirect:'follow'});if(!r.ok)throw new Error('HTTP '+r.status);return Buffer.from(await r.arrayBuffer());
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
    const u=new URL(String(manifestUrl||''));if(!/^https?:$/.test(u.protocol))return {ok:false,message:'Адрес обновлений должен начинаться с http:// или https://'};
    const r=await fetch(u,{cache:'no-store'});if(!r.ok)return {ok:false,message:'Сервер обновлений ответил HTTP '+r.status};
    const m=await r.json();if(!m||!m.version||!m.url)return {ok:false,message:'Неверный файл latest.json на сервере'};
    if(cmpVersion(m.version,app.getVersion())<=0)return {ok:true,message:'Установлена актуальная версия '+app.getVersion()};
    const fileUrl=new URL(m.url,u).toString();const buf=await fetchBuffer(fileUrl);
    if(m.sha256){const got=crypto.createHash('sha256').update(buf).digest('hex');if(got.toLowerCase()!==String(m.sha256).toLowerCase())return {ok:false,message:'Контрольная сумма обновления не совпала'};}
    const target=path.join(os.tmpdir(),'Uchet-dilerov-Setup-'+m.version+'.exe');fs.writeFileSync(target,buf);
    const child=spawn(target,['/S'],{detached:true,stdio:'ignore'});child.unref();setTimeout(()=>app.quit(),700);
    return {ok:true,message:'Версия '+m.version+' скачана. Запускаю установку…'};
  }catch(e){return {ok:false,message:'Ошибка обновления: '+String(e&&e.message||e)}}
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
    const r = await dialog.showOpenDialog(mainWindow, {
      title: 'Выбери установщик обновления',
      properties: ['openFile'],
      filters: [{ name: 'Установщик Учёт дилеров', extensions: ['exe'] }]
    });
    if (r.canceled || !r.filePaths[0]) return { ok:false, message:'Установка отменена' };
    const target=r.filePaths[0];
    if (!/Uchet-dilerov-Setup-.*\.exe$/i.test(path.basename(target))) {
      const c=await dialog.showMessageBox(mainWindow,{type:'warning',buttons:['Продолжить','Отмена'],defaultId:1,cancelId:1,message:'Имя файла не похоже на установщик «Учёт дилеров».',detail:path.basename(target)});
      if(c.response!==0)return {ok:false,message:'Установка отменена'};
    }
    const child=spawn(target,[],{detached:true,stdio:'ignore'});child.unref();setTimeout(()=>app.quit(),700);
    return {ok:true,message:'Запускаю установщик обновления…'};
  } catch(e) { return {ok:false,message:'Ошибка запуска установщика: '+String(e&&e.message||e)}; }
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
