(()=>{
  if(window.__uchetRuntime8922)return;
  window.__uchetRuntime8922=true;

  function activateNewMatRosVisibility(){
    if(!window.newmatrosAPI?.onIni)return;
    window.newmatrosAPI.onIni(payload=>{
      if(!payload?.text)return;
      try{
        const data=typeof parseIni==='function'?parseIni(payload.text):null;
        if(typeof go==='function')go('newmatros');
        if(data&&typeof showNewMatRosPreview==='function')showNewMatRosPreview(data,payload.name||'NewMatRos');
        if(typeof clearNewMatRosNotification==='function')clearNewMatRosNotification();
        setTimeout(()=>document.getElementById('nmPreview')?.scrollIntoView({behavior:'smooth',block:'start'}),80);
      }catch(e){
        console.error('8.9.22 NewMatRos visibility fix',e);
        try{if(typeof go==='function')go('newmatros')}catch(_){ }
        const s=document.getElementById('nmStatus');if(s)s.textContent='Файл NewMatRos получен, но при разборе произошла ошибка: '+String(e&&e.message||e);
      }
    });
  }

  function activateSpeechFallback(){
    const listen=document.getElementById('aiListen');
    const input=document.getElementById('aiText');
    const run=document.getElementById('aiRun');
    const status=document.getElementById('aiStatus');
    const transcript=document.getElementById('voiceTranscript');
    if(!listen||!input||!run||!window.voiceAPI?.listenOnce)return;
    listen.addEventListener('click',async e=>{
      e.preventDefault();e.stopImmediatePropagation();
      listen.disabled=true;
      if(status)status.textContent='Слушаю через Windows…';
      try{
        const r=await window.voiceAPI.listenOnce();
        if(!r?.ok){if(transcript)transcript.textContent=r?.message||'Не удалось распознать речь.';if(status)status.textContent='Микрофон выключен.';return}
        const text=String(r.text||'').trim();
        if(!text)return;
        if(transcript)transcript.textContent='Вы сказали: '+text;
        input.value=text;
        run.click();
      }catch(err){
        if(transcript)transcript.textContent='Ошибка голосового ввода: '+String(err&&err.message||err);
        if(status)status.textContent='Микрофон выключен.';
      }finally{listen.disabled=false}
    },true);
  }

  activateNewMatRosVisibility();
  activateSpeechFallback();

  const old=document.getElementById('runtime8921Badge');
  if(old)old.textContent='исправления 8.9.22 активны';
})();
