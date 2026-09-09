const { ipcMain } = require('electron');
const { spawn } = require('child_process');

let activeListen=null;
require('electron').app.on('before-quit',()=>{if(activeListen)activeListen()});
ipcMain.handle('assistant:stopWindows',()=>{if(activeListen)activeListen();return {ok:true}});

// 8.9.22: Electron/Chromium Web Speech can return "network" even when the
// microphone itself works. Use the Windows speech engine for one short Russian
// dictation request so the assistant does not depend on Chromium's cloud STT.
ipcMain.handle('assistant:listenWindows', async () => {
  if(activeListen)activeListen();
  if (process.platform !== 'win32') return { ok:false, message:'Голосовой ввод Windows доступен только в Windows.' };
  return await new Promise(resolve => {
    const script = `
$ErrorActionPreference='Stop'
$OutputEncoding=[System.Text.Encoding]::UTF8
[Console]::OutputEncoding=[System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Speech
$info=[System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers() | Where-Object {$_.Culture.Name -eq 'ru-RU'} | Select-Object -First 1
if(-not $info){exit 4}
$rec=New-Object System.Speech.Recognition.SpeechRecognitionEngine($info)
$rec.SetInputToDefaultAudioDevice()
$grammar=New-Object System.Speech.Recognition.DictationGrammar
$rec.LoadGrammar($grammar)
try{$result=$rec.Recognize([TimeSpan]::FromSeconds(9))}finally{$rec.Dispose()}
if($result -and $result.Text){ Write-Output $result.Text; exit 0 }
exit 3
`;
    let out='', err='', done=false, timer;
    const cancel=()=>{try{p?.kill()}catch(_){}finish({ok:false,message:'Запись остановлена.'})};
    activeListen=cancel;
    const finish = value => { if(done) return; done=true; clearTimeout(timer); if(activeListen===cancel)activeListen=null; resolve(value); };
    let p;
    try {
      p=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command',script],{windowsHide:true});
    } catch(e) {
      return finish({ok:false,message:'Не удалось запустить распознавание речи Windows: '+String(e&&e.message||e)});
    }
    p.stdout.on('data',d=>{out+=d.toString('utf8')});
    p.stderr.on('data',d=>{err+=d.toString('utf8')});
    p.on('error',e=>finish({ok:false,message:'Ошибка голосового ввода Windows: '+String(e&&e.message||e)}));
    p.on('exit',code=>{
      const text=out.replace(/^\uFEFF/,'').trim();
      if(code===0 && text) return finish({ok:true,text});
      const low=(err+' '+out).toLowerCase();
      if(/recognizer|culture|speechrecognitionengine|ru-ru/.test(low)) return finish({ok:false,message:'В Windows не установлен русский пакет распознавания речи. Открой Параметры → Время и язык → Язык и регион → Русский → Параметры языка → Речь.'});
      if(code===4)return finish({ok:false,message:'В Windows нет совместимого русского распознавателя. Проверь микрофон кнопкой «Проверить микрофон»; для распознавания подключи облачную речь в настройках помощника.'});
      if(code===3) return finish({ok:false,message:'Речь не распознана. Нажми кнопку и скажи фразу ещё раз.'});
      finish({ok:false,message:'Не удалось распознать речь через Windows.'});
    });
    timer=setTimeout(()=>{try{p.kill()}catch(_){}finish({ok:false,message:'Время ожидания речи истекло. Нажми кнопку и повтори.'})},13000);
  });
});

require('./main.js');
