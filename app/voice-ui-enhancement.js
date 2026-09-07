(()=>{
  if(window.__uchetVoiceUiEnhancement8915)return;
  window.__uchetVoiceUiEnhancement8915=true;

  const KEY='uchetNaturalVoice8915';
  const defaults={enabled:true,voiceName:'',rate:0.96,pitch:1.0};
  let cfg={...defaults};
  try{cfg={...cfg,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch(_){ }
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(cfg))}catch(_){}};

  const style=document.createElement('style');
  style.textContent=`
    #voiceAssistantBtn{
      position:static!important;right:auto!important;bottom:auto!important;top:auto!important;
      margin-left:auto!important;margin-right:12px!important;height:42px!important;
      display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:8px!important;
      padding:0 17px!important;border-radius:14px!important;border:1px solid rgba(255,255,255,.28)!important;
      color:#fff!important;background:linear-gradient(135deg,#2f6f68 0%,#3f887c 58%,#5b9d91 100%)!important;
      box-shadow:0 8px 20px rgba(47,111,104,.22),inset 0 1px 0 rgba(255,255,255,.18)!important;
      font-weight:800!important;letter-spacing:.01em!important;cursor:pointer!important;transition:transform .15s ease,box-shadow .15s ease,filter .15s ease!important;
      z-index:31!important;white-space:nowrap!important;
    }
    #voiceAssistantBtn:hover{transform:translateY(-1px)!important;box-shadow:0 11px 24px rgba(47,111,104,.28),inset 0 1px 0 rgba(255,255,255,.2)!important;filter:brightness(1.03)!important}
    #voiceAssistantBtn:active{transform:translateY(0)!important}
    #voiceAssistantBtn.listening{background:linear-gradient(135deg,#a83d36,#c75449)!important;animation:voiceTopPulse .9s infinite alternate!important}
    @keyframes voiceTopPulse{from{box-shadow:0 7px 18px rgba(176,68,59,.25)}to{box-shadow:0 10px 28px rgba(176,68,59,.48)}}
    .voiceNaturalBlock{margin-top:16px;padding-top:15px;border-top:1px solid #dfe7e3}
    .voiceNaturalBlock h4{margin:0 0 10px;font-size:15px;color:#294039}
    .voiceNaturalGrid{display:grid;grid-template-columns:1fr 150px;gap:10px;align-items:end}
    .voiceNaturalGrid label{font-size:13px}
    .voiceNaturalGrid select,.voiceNaturalGrid input[type="range"]{width:100%}
    .voiceNaturalActions{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin-top:11px}
    .voiceNaturalNote{font-size:12px;color:#68756f;line-height:1.45;margin-top:8px}
    @media(max-width:900px){#voiceAssistantBtn{padding:0 12px!important;margin-right:8px!important}.voiceNaturalGrid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  const btn=document.getElementById('voiceAssistantBtn');
  const header=document.querySelector('header');
  const statusPill=header?.querySelector('.statusPill');
  if(btn&&header){
    btn.textContent='✦ Ассистент';
    if(statusPill)header.insertBefore(btn,statusPill);else header.appendChild(btn);
  }

  const synth=window.speechSynthesis;
  const NativeUtterance=window.SpeechSynthesisUtterance;
  let nativeSpeak=null;
  if(synth&&NativeUtterance&&typeof synth.speak==='function'){
    nativeSpeak=synth.speak.bind(synth);

    function voiceScore(v){
      const name=String(v?.name||'').toLowerCase();
      const lang=String(v?.lang||'').toLowerCase();
      const russian=lang.startsWith('ru')||/russian|русск/.test(name);
      if(!russian)return -10000;
      let s=10;
      if(/natural|online|neural/.test(name))s+=140;
      if(/svetlana|dariya|daria|irina|milena|female|женск/.test(name))s+=70;
      if(/microsoft/.test(name))s+=30;
      if(/google/.test(name))s+=22;
      if(/desktop/.test(name))s-=5;
      if(v.default)s+=6;
      return s;
    }
    function voices(){return (synth.getVoices?.()||[]).slice()}
    function bestVoice(){
      const list=voices();
      if(cfg.voiceName){const selected=list.find(v=>v.name===cfg.voiceName);if(selected)return selected}
      return list.sort((a,b)=>voiceScore(b)-voiceScore(a))[0]||null;
    }
    function applyVoice(u){
      if(!cfg.enabled)return u;
      const v=bestVoice();
      if(v)u.voice=v;
      u.lang='ru-RU';
      u.rate=Math.max(.75,Math.min(1.15,Number(cfg.rate)||.96));
      u.pitch=Math.max(.85,Math.min(1.15,Number(cfg.pitch)||1));
      u.volume=1;
      return u;
    }
    synth.speak=function(utterance){
      try{if(utterance instanceof NativeUtterance)applyVoice(utterance)}catch(_){ }
      return nativeSpeak(utterance);
    };

    const settingsCard=document.querySelector('#assistantSettings .card');
    if(settingsCard&&!document.getElementById('voiceNaturalSelect')){
      const block=document.createElement('div');
      block.className='voiceNaturalBlock';
      block.innerHTML=`
        <h4>Естественный голос</h4>
        <label class="voiceSettingRow"><input id="voiceNaturalEnabled" type="checkbox"> Использовать более естественное звучание</label>
        <div class="voiceNaturalGrid">
          <label>Русский голос<select id="voiceNaturalSelect"></select></label>
          <label>Темп речи<input id="voiceNaturalRate" type="range" min="0.82" max="1.08" step="0.01"></label>
        </div>
        <div class="voiceNaturalActions"><button id="voiceNaturalTest" class="secondary" type="button">🔊 Проверить голос</button><span id="voiceNaturalChosen" class="muted"></span></div>
        <div class="voiceNaturalNote">Программа автоматически отдаёт приоритет русским голосам Windows с пометкой Natural / Online, если они доступны на этом компьютере.</div>`;
      settingsCard.appendChild(block);

      const enabled=block.querySelector('#voiceNaturalEnabled');
      const select=block.querySelector('#voiceNaturalSelect');
      const rate=block.querySelector('#voiceNaturalRate');
      const chosen=block.querySelector('#voiceNaturalChosen');
      const test=block.querySelector('#voiceNaturalTest');
      enabled.checked=cfg.enabled!==false;
      rate.value=String(cfg.rate||.96);

      function renderVoices(){
        const list=voices().filter(v=>String(v.lang||'').toLowerCase().startsWith('ru')||/russian|русск/i.test(v.name||''));
        const auto=bestVoice();
        select.innerHTML='<option value="">Автоматически — лучший доступный</option>'+list.sort((a,b)=>voiceScore(b)-voiceScore(a)).map(v=>'<option value="'+String(v.name).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')+'">'+String(v.name).replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</option>').join('');
        select.value=cfg.voiceName&&list.some(v=>v.name===cfg.voiceName)?cfg.voiceName:'';
        chosen.textContent='Сейчас: '+(auto?.name||'системный русский голос');
      }
      renderVoices();
      if('onvoiceschanged' in synth)synth.addEventListener?.('voiceschanged',renderVoices);
      setTimeout(renderVoices,350);
      setTimeout(renderVoices,1200);

      enabled.addEventListener('change',()=>{cfg.enabled=!!enabled.checked;save()});
      select.addEventListener('change',()=>{cfg.voiceName=select.value;save();renderVoices()});
      rate.addEventListener('input',()=>{cfg.rate=Number(rate.value)||.96;save()});
      test.addEventListener('click',()=>{
        try{
          synth.cancel();
          const u=new NativeUtterance('Здравствуйте. Я ваш ассистент по учёту дилеров. Чем могу помочь?');
          applyVoice(u);nativeSpeak(u);
        }catch(_){ }
      });
    }
  }
})();