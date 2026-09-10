(()=>{
  'use strict';
  if(window.__uchetAudio8933)return;
  const install=()=>{
    if(window.__uchetAudio8933)return true;
    if(!window.assistantAudio||!window.audioAPI)return false;
    window.__uchetAudio8933=true;
    const originalSpeak=window.assistantAudio.speak.bind(window.assistantAudio);
    const status=()=>document.getElementById('aiStatus');
    const setStatus=t=>{const s=status();if(s)s.textContent=t};

    function waitVoices(){
      return new Promise(resolve=>{
        if(!window.speechSynthesis)return resolve([]);
        const now=window.speechSynthesis.getVoices()||[];if(now.length)return resolve(now);
        let done=false;const finish=()=>{if(done)return;done=true;window.speechSynthesis.removeEventListener?.('voiceschanged',finish);resolve(window.speechSynthesis.getVoices()||[])};
        window.speechSynthesis.addEventListener?.('voiceschanged',finish,{once:true});
        setTimeout(finish,1200);
      });
    }
    function rankVoice(v){
      const n=String(v?.name||'').toLowerCase();let score=0;
      if(/^ru[-_]/i.test(v?.lang||'')||/russian|рус/i.test(n))score+=200;
      if(/natural|neural|online/.test(n))score+=140;
      if(/svetlana|светлана|irina|ирина|alena|алена|dariya|дарья/.test(n))score+=70;
      if(/microsoft|google/.test(n))score+=20;
      return score;
    }
    async function browserSpeak(text){
      if(!window.speechSynthesis||typeof SpeechSynthesisUtterance==='undefined')return false;
      const voices=(await waitVoices()).slice().sort((a,b)=>rankVoice(b)-rankVoice(a));
      const v=voices.find(x=>rankVoice(x)>=200);if(!v)return false;
      try{
        window.speechSynthesis.cancel();
        const u=new SpeechSynthesisUtterance(String(text));u.voice=v;u.lang=v.lang||'ru-RU';u.rate=.96;u.pitch=1;
        return await new Promise(resolve=>{
          let done=false,started=false;
          const finish=x=>{if(done)return;done=true;clearTimeout(timer);resolve(x)};
          u.onstart=()=>{started=true;finish(true)};
          u.onerror=()=>finish(false);
          const timer=setTimeout(()=>{if(!started){try{window.speechSynthesis.cancel()}catch(_){}finish(false)}},1600);
          window.speechSynthesis.speak(u);
        });
      }catch(_){return false}
    }

    window.assistantAudio.speak=async function(text){
      text=String(text||'').trim();if(!text)return;
      try{
        const cfg=await window.audioAPI.config();
        if(cfg?.mode==='cloud'&&cfg?.hasKey){
          return await originalSpeak(text);
        }
        setStatus('Озвучиваю ответ…');
        const browserOk=await browserSpeak(text);
        if(browserOk)return {ok:true,mode:'browser'};
        if(window.voiceAPI?.speakWindows){
          const r=await window.voiceAPI.speakWindows(text);
          if(r?.ok){setStatus('Ответ озвучен. Микрофон выключен.');return r}
          setStatus(r?.message||'Не удалось озвучить ответ.');return r;
        }
        return await originalSpeak(text);
      }catch(_){
        try{return await originalSpeak(text)}catch(__){setStatus('Не удалось озвучить ответ.');return {ok:false}}
      }
    };

    const settings=document.getElementById('assistantSettings');
    if(settings&&!document.getElementById('voiceTest8933')){
      const b=document.createElement('button');b.id='voiceTest8933';b.type='button';b.className='secondary';b.textContent='Проверить голос';
      b.onclick=()=>window.assistantAudio.speak('Проверка голосового помощника. Я готова работать.');
      const card=settings.querySelector('.card:last-child')||settings;card.appendChild(b);
    }
    document.documentElement.dataset.audioFix='8.9.33';
    return true;
  };
  let tries=0;const t=setInterval(()=>{tries++;if(install()||tries>100)clearInterval(t)},100);
})();
