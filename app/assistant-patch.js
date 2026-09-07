(()=>{
  if(window.__uchetAssistant8915)return;
  window.__uchetAssistant8915=true;

  const UPDATE_MANIFEST='https://raw.githubusercontent.com/saypudsoffitto-a11y/uchet-dilerov-updates/main/latest.json';

  // Однокнопочное обновление: адрес обновлений встроен в программу.
  try{
    state.update=state.update||{};
    state.update.manifestUrl=UPDATE_MANIFEST;
    localStorage.setItem('uchet_dilerov_v8',JSON.stringify(state));
    const input=document.getElementById('updateManifestUrl');
    if(input){
      input.value=UPDATE_MANIFEST;
      input.readOnly=true;
      const label=input.closest('label');
      if(label){
        label.firstChild.textContent='Сервер обновлений настроен автоматически';
        input.style.display='none';
      }
    }
    const hint=document.querySelector('#updates .sectionHint');
    if(hint)hint.textContent='Нажми кнопку обновления — программа сама проверит новую версию, скачает установщик и запустит установку с сохранением данных.';
  }catch(e){console.error('Auto update setup failed',e)}

  // Подстраховка: перед каждым нажатием принудительно используем встроенный latest.json.
  const originalCheck=window.checkForUpdate;
  if(typeof originalCheck==='function'){
    window.checkForUpdate=async function(){
      try{
        state.update=state.update||{};
        state.update.manifestUrl=UPDATE_MANIFEST;
        const input=document.getElementById('updateManifestUrl');
        if(input)input.value=UPDATE_MANIFEST;
      }catch(_){}
      return originalCheck();
    };
  }

  const css=document.createElement('style');
  css.textContent=`
    #smartAssistantBtn{position:fixed;right:22px;bottom:22px;z-index:320;width:58px;height:58px;border-radius:50%;border:0;background:#2f6f68;color:#fff;font-size:25px;box-shadow:0 10px 30px #0003;cursor:pointer}
    #smartAssistantPanel{position:fixed;right:22px;bottom:92px;z-index:319;width:min(390px,calc(100vw - 28px));background:#fff;border:1px solid #dfe7e3;border-radius:16px;box-shadow:0 18px 55px #0003;padding:16px;color:#20302b}
    #smartAssistantPanel.hidden{display:none!important}
    #smartAssistantPanel h3{margin:0 0 6px;font-size:18px}
    #smartAssistantPanel .assistantSafety{font-size:12px;color:#68756f;margin:0 0 12px}
    #smartAssistantAnswer{background:#f3f7f5;border:1px solid #dfe7e3;border-radius:12px;padding:11px;min-height:52px;margin:10px 0;white-space:pre-wrap}
    #smartAssistantPanel .assistantRow{display:flex;gap:8px}
    #smartAssistantPanel input{flex:1}
    #smartAssistantMic.listening{animation:pulseAssistant 1s infinite}
    @keyframes pulseAssistant{50%{transform:scale(1.08)}}
  `;
  document.head.appendChild(css);

  const panel=document.createElement('div');
  panel.id='smartAssistantPanel';
  panel.className='hidden';
  panel.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
      <h3>Умный помощник</h3>
      <button type="button" class="secondary" id="smartAssistantClose">Закрыть</button>
    </div>
    <p class="assistantSafety">Помощник только читает данные и отвечает. Удалять товары, накладные или менять учёт голосом он не может.</p>
    <div id="smartAssistantAnswer">Спроси, например: «Какая цена гардины 2.05?», «Сколько её осталось?», «Сколько должен дилер Иван?»</div>
    <div class="assistantRow">
      <input id="smartAssistantInput" autocomplete="off" placeholder="Скажи или напиши вопрос">
      <button type="button" class="primary" id="smartAssistantMic" title="Говорить">🎤</button>
      <button type="button" class="primary" id="smartAssistantAsk">Спросить</button>
    </div>
  `;
  document.body.appendChild(panel);

  const btn=document.createElement('button');
  btn.id='smartAssistantBtn';
  btn.type='button';
  btn.title='Умный голосовой помощник';
  btn.textContent='🎙';
  document.body.appendChild(btn);

  const input=document.getElementById('smartAssistantInput');
  const answer=document.getElementById('smartAssistantAnswer');
  const mic=document.getElementById('smartAssistantMic');

  function normText(s){
    return String(s||'').toLowerCase().replace(/ё/g,'е').replace(/[,;:!?()\[\]{}"']/g,' ').replace(/[\\/]/g,' ').replace(/\s+/g,' ').trim();
  }
  function comparable(s){return normText(s).replace(/[.,-]/g,' ').replace(/\s+/g,' ').trim()}
  function compact(s){return comparable(s).replace(/\s+/g,'')}
  function tokenize(s){return comparable(s).split(' ').filter(Boolean)}

  const productStop=new Set(['узнай','скажи','покажи','мне','какая','какой','какую','цена','цену','цены','товар','товара','на','у','по','сколько','осталось','остаток','остатка','есть','розничная','розница','оптовая','опт','закупка','закупочная','стоит','стоимость','сейчас','текущий','текущая']);
  const dealerStop=new Set(['узнай','скажи','покажи','мне','сколько','должен','должна','должно','долг','долга','у','дилер','дилера','клиент','клиента','сейчас','текущий']);

  function scoreMatch(candidate,query){
    const c=comparable(candidate),q=comparable(query);
    if(!q)return 0;
    if(c===q)return 1000;
    if(c.includes(q))return 800-q.length;
    if(compact(c).includes(compact(q)))return 760-q.length;
    const qt=tokenize(q),ct=tokenize(c);
    let hit=0;
    qt.forEach(t=>{if(ct.some(x=>x===t||x.includes(t)||t.includes(x)))hit++});
    return hit?hit*100-ct.length:0;
  }

  function productQuery(text){return tokenize(text).filter(x=>!productStop.has(x)).join(' ')}
  function dealerQuery(text){return tokenize(text).filter(x=>!dealerStop.has(x)).join(' ')}

  function findProduct(text){
    const q=productQuery(text);
    let best=null,bestScore=0;
    (state.products||[]).filter(p=>!p.archived).forEach(p=>{
      const s=Math.max(scoreMatch(p.name,q),scoreMatch(p.article,q));
      if(s>bestScore){best=p;bestScore=s}
    });
    return bestScore>=100?best:null;
  }

  function findDealer(text){
    const q=dealerQuery(text);
    let best=null,bestScore=0;
    (state.dealers||[]).forEach(d=>{
      const s=scoreMatch((d.name||'')+' '+(d.phone||''),q);
      if(s>bestScore){best=d;bestScore=s}
    });
    return bestScore>=100?best:null;
  }

  function rub(n){return (+n||0).toLocaleString('ru-RU',{maximumFractionDigits:2})+' рублей'}
  function qtyText(p){return (+p.stock||0).toLocaleString('ru-RU',{maximumFractionDigits:3})+' '+(p.unit||'шт')}

  function answerQuestion(raw){
    const t=normText(raw);
    if(!t)return 'Скажи или напиши вопрос.';

    if(/(удал|стер|снес|убер).*(товар|наклад|чек|дилер)/.test(t)){
      return 'Я не удаляю товары, накладные, чеки или дилеров. Такие действия разрешены только вручную.';
    }

    if(/\b(должен|долг|задолжен)\b/.test(t)){
      const d=findDealer(t);
      if(!d)return 'Не нашла дилера в базе. Назови имя или телефон точнее.';
      return 'Дилер '+d.name+' должен '+rub(debtOf(d.id))+'.';
    }

    if(/(остат|сколько осталось|сколько есть)/.test(t)){
      const p=findProduct(t);
      if(!p)return 'Не нашла товар. Назови его точнее, например по названию или артикулу.';
      return p.name+': текущий остаток '+qtyText(p)+'.';
    }

    if(/(цена|стоит|стоимость|почем|почём|опт|розниц|закуп)/.test(t)){
      const p=findProduct(t);
      if(!p)return 'Не нашла товар. Назови его точнее, например «гардина 2.05».';
      let label='розничная цена',v=+p.retailPrice||0;
      if(/опт/.test(t)){label='оптовая цена';v=+p.wholesalePrice||0}
      else if(/закуп/.test(t)){label='закупочная цена';v=+p.buyPrice||0}
      return p.name+': '+label+' '+rub(v)+'. Текущий остаток '+qtyText(p)+'.';
    }

    const p=findProduct(t);
    if(p)return 'Нашла '+p.name+'. Розничная цена '+rub(p.retailPrice)+', оптовая '+rub(p.wholesalePrice)+', остаток '+qtyText(p)+'.';

    return 'Я пока умею безопасно отвечать по товарам, ценам, остаткам и долгам дилеров. Ничего в базе без твоего подтверждения не меняю.';
  }

  function speak(text){
    try{
      if(!('speechSynthesis' in window))return;
      speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance(text);
      u.lang='ru-RU';
      const voice=speechSynthesis.getVoices().find(v=>String(v.lang||'').toLowerCase().startsWith('ru'));
      if(voice)u.voice=voice;
      u.rate=1;
      speechSynthesis.speak(u);
    }catch(e){console.error('Speech synthesis failed',e)}
  }

  function ask(){
    const q=input.value.trim();
    const a=answerQuestion(q);
    answer.textContent=a;
    speak(a);
  }

  btn.addEventListener('click',()=>{panel.classList.toggle('hidden');if(!panel.classList.contains('hidden'))setTimeout(()=>input.focus(),20)});
  document.getElementById('smartAssistantClose').addEventListener('click',()=>panel.classList.add('hidden'));
  document.getElementById('smartAssistantAsk').addEventListener('click',ask);
  input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();ask()}});

  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  let recognition=null;
  if(Recognition){
    recognition=new Recognition();
    recognition.lang='ru-RU';
    recognition.interimResults=false;
    recognition.continuous=false;
    recognition.maxAlternatives=1;
    recognition.onstart=()=>{mic.classList.add('listening');mic.textContent='⏹'};
    recognition.onend=()=>{mic.classList.remove('listening');mic.textContent='🎤'};
    recognition.onerror=e=>{answer.textContent='Не удалось распознать голос. Можно написать вопрос вручную.';console.error('Speech recognition',e)};
    recognition.onresult=e=>{
      const text=e.results?.[0]?.[0]?.transcript||'';
      input.value=text;
      ask();
    };
    mic.addEventListener('click',()=>{
      try{
        if(mic.classList.contains('listening'))recognition.stop();else recognition.start();
      }catch(e){console.error('Recognition start failed',e)}
    });
  }else{
    mic.disabled=true;
    mic.title='Голосовое распознавание недоступно на этом компьютере';
  }
})();
