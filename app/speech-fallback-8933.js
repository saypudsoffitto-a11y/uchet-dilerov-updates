'use strict';
const {ipcMain}=require('electron');
const {spawn}=require('child_process');

ipcMain.removeHandler('assistant:speakWindows');
ipcMain.handle('assistant:speakWindows',async(_event,text)=>{
  text=String(text||'').trim();
  if(!text)return {ok:false,message:'Нет текста для озвучки.'};
  if(text.length>3000)text=text.slice(0,3000);
  if(process.platform!=='win32')return {ok:false,message:'Системная озвучка доступна только в Windows.'};
  return await new Promise(resolve=>{
    const env={...process.env,UCHET_SPEAK_TEXT:text};
    const script=`
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Speech
$s=New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $voices=$s.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo }
  $ru=$voices | Where-Object { $_.Culture.Name -eq 'ru-RU' }
  $preferred=$ru | Where-Object { $_.Gender -eq [System.Speech.Synthesis.VoiceGender]::Female } | Select-Object -First 1
  if(-not $preferred){$preferred=$ru | Select-Object -First 1}
  if($preferred){$s.SelectVoice($preferred.Name)}
  $s.Volume=100
  $s.Rate=0
  $s.Speak($env:UCHET_SPEAK_TEXT)
  Write-Output ($s.Voice.Name)
} finally { $s.Dispose() }
`;
    let out='',err='',done=false;
    const finish=v=>{if(done)return;done=true;clearTimeout(timer);resolve(v)};
    let p;
    try{p=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command',script],{windowsHide:true,env})}
    catch(e){return finish({ok:false,message:'Не удалось запустить системный голос: '+String(e&&e.message||e)})}
    p.stdout.on('data',d=>out+=d.toString('utf8'));
    p.stderr.on('data',d=>err+=d.toString('utf8'));
    p.on('error',e=>finish({ok:false,message:'Ошибка системного голоса: '+String(e&&e.message||e)}));
    p.on('exit',code=>code===0?finish({ok:true,voice:out.trim()}):finish({ok:false,message:'Windows не смог озвучить ответ. '+err.trim()}));
    const timer=setTimeout(()=>{try{p.kill()}catch(_){}finish({ok:false,message:'Озвучка Windows не ответила вовремя.'})},30000);
    timer.unref?.();
  });
});
