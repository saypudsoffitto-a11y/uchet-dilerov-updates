(()=>{
  if(window.__uchetVoice8915)return;
  window.__uchetVoice8915=true;

  const SETTINGS_KEY='uchetVoiceSettings8915';
  let voiceSettings={speak:true};
  try{voiceSettings={...voiceSettings,...JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}}catch(_){ }
  const saveVoiceSettings=()=>{try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(voiceSettings))}catch(_){}};

  const css=document.createElement('style');
  css.textContent=`
  #voiceAssistantBtn{position:fixed;right:24px;bottom:24px;z-index:70;background:#2f6f68;color:#fff;border:0;border-radius:999px;padding:13px 18px;box-shadow:0 10px 30px #0003;font-weight:800;cursor:pointer}
  #voiceAssistantBtn.listening{background:#b0443b;animation:voicePulse 1s infinite alternate}
  @keyframes voicePulse{from{transform:scale(1)}to{transform:scale(1.04)}}
  #voiceAssistantModal{position:fixed;inset:0;z-index:260;background:#0008;display:flex;align-items:center;justify-content:center;padding:20px}
  #voiceAssistantModal.hidden{display:none!important}.voiceBox{width:min(720px,96vw);max-height:88vh;overflow:auto;background:#fff;border-radius:18px;padding:22px;box-shadow:0 25px 80px #0005}
  .voiceHead{display:flex;justify-content:space-between;gap:12px;align-items:center}.voiceHead h2{margin:0}.voiceStatus{padding:8px 10px;border-radius:10px;background:#f1f5f3;color:#40534d;margin:14px 0}.voiceTranscript{min-height:86px;border:1px solid #dfe7e3;background:#fbfcfb;border-radius:12px;padding:12px;white-space:pre-wrap}.voiceActions{display:flex;gap:9px;flex-wrap:wrap;margin-top:12px}.voiceInputRow{display:grid;grid-template-columns:1fr auto;gap:9px;margin-top:12px}.voiceHint{font-size:12px;color:#68756f;margin-top:10px;line-height:1.45}.voiceDanger{color:#b0443b;font-weight:700}.voiceSettingRow{display:flex;gap:10px;align-items:center;margin:10px 0}.voiceSettingRow input{width:auto}
  `;
  document.head.appendChild(css);

  const btn=document.createElement('button');
  btn.id='voiceAssistantBtn';
  btn.type='button';
  btn.textContent='🎙 Ассистент';
  document.body.appendChild(btn);

  const modal=document.createElement('div');
  modal.id='voiceAssistantModal';modal.className='hidden';
  modal.innerHTML=`<div class="voiceBox">
    <div class="voiceHead"><h2>Голосовой помощник</h2><button id="voiceClose" class="secondary" type="button">Закрыть</button></div>
    <div id="voiceStatus" class="voiceStatus">Готов. Микрофон выключен.</div>
    <div id="voiceTranscript" class="voiceTranscript">Можно спросить: «Цена люстры 80 ватт», «Остаток профиль 2 метра», «Долг Ахмеда», «Открой продажу», «Выбери дилера Магомед», «Добавь 3 светильника 48 ватт».</div>
    <div class="voiceActions"><button id="voiceListen" class="primary" type="button">🎙 Слушать один запрос</button><button id="voiceStop" class="secondary" type="button">Стоп</button></div>
    <div class="voiceInputRow"><input id="voiceText" placeholder="Или введи команду текстом"><button id="voiceRun" class="primary" type="button">Выполнить</button></div>
    <div class="voiceHint">Микрофон включается <b>только</b> после нажатия «Слушать» и выключается после одного запроса. Изменяющие действия выполняются только после подтверждения. <span class="voiceDanger">Удаление голосом полностью запрещено.</span></div>
  </div>`;
  document.body.appendChild(modal);

  // Отдельный раздел «Настройки» — здесь хранятся только настройки помощника.
  const nav=document.querySelector('nav'),main=document.querySelector('main');
  if(nav&&main&&!document.getElementById('assistantSettings')){
    const settingsBtn=document.createElement('button');
    settingsBtn.type='button';settingsBtn.dataset.section='assistantSettings';
    settingsBtn.innerHTML='<span class="navIcon">⚙</span>Настройки';
    settingsBtn.addEventListener('click',()=>{if(typeof show==='function')show('assistantSettings',settingsBtn)});
    nav.appendChild(settingsBtn);
    const sec=document.createElement('section');sec.id='assistantSettings';sec.className='hidden';
    sec.innerHTML=`<h2>Настройки</h2><p class="sectionHint">Настройки голосового помощника. Сам помощник не слушает в фоне.</p><div class="card">
      <h3 style="margin-top:0">Голосовой помощник</h3>
      <label class="voiceSettingRow"><input id="voiceSpeakSetting" type="checkbox"> Озвучивать ответы</label>
      <label class="voiceSettingRow"><input type="checkbox" checked disabled> Подтверждение любых изменяющих действий — всегда включено</label>
      <label class="voiceSettingRow"><input type="checkbox" checked disabled> Удаление дилеров, товаров, чеков и накладных голосом — запрещено</label>
      <p class="muted">Микрофон включается только отдельной кнопкой «Ассистент» → «Слушать один запрос».</p>
    </div>`;
    main.appendChild(sec);
    const speakSetting=sec.querySelector('#voiceSpeakSetting');
    speakSetting.checked=voiceSettings.speak!==false;
    speakSetting.addEventListener('change',()=>{voiceSettings.speak=!!speakSetting.checked;saveVoiceSettings()});
  }

  const status=modal.querySelector('#voiceStatus');
  const transcript=modal.querySelector('#voiceTranscript');
  const textInput=modal.querySelector('#voiceText');
  const listenBtn=modal.querySelector('#voiceListen');
  const stopBtn=modal.querySelector('#voiceStop');
  let recognition=null;

  function setStatus(t){status.textContent=t}
  function openAssistant(){modal.classList.remove('hidden');setStatus('Готов. Микрофон выключен.');setTimeout(()=>textInput.focus(),50)}
  function closeAssistant(){stopListening();modal.classList.add('hidden')}
  btn.addEventListener('click',openAssistant);
  modal.querySelector('#voiceClose').addEventListener('click',closeAssistant);
  modal.addEventListener('click',e=>{if(e.target===modal)closeAssistant()});

  let softFemaleVoice=null;
  function selectSoftFemaleVoice(){
    if(!('speechSynthesis' in window))return null;
    const voices=speechSynthesis.getVoices().filter(v=>/^ru(?:-|_)/i.test(String(v.lang||'')));
    if(!voices.length)return null;
    const score=v=>{
      const n=String(v.name||'').toLowerCase();
      let s=0;
      if(/natural|натурал/.test(n))s+=100;
      if(/светлана|svetlana/.test(n))s+=70;
      if(/female|женск/.test(n))s+=55;
      if(/ирина|irina|милена|milena|алёна|alena|alyona/.test(n))s+=45;
      if(/online/.test(n))s+=25;
      if(/microsoft/.test(n))s+=10;
      if(v.localService)s+=3;
      return s;
    };
    return voices.sort((a,b)=>score(b)-score(a))[0]||null;
  }
  function refreshAssistantVoice(){softFemaleVoice=selectSoftFemaleVoice()}
  if('speechSynthesis' in window){
    refreshAssistantVoice();
    speechSynthesis.addEventListener?.('voiceschanged',refreshAssistantVoice);
  }
  function speak(text){
    if(voiceSettings.speak===false||!('speechSynthesis' in window))return;
    try{
      speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance(String(text));
      u.lang='ru-RU';
      u.voice=softFemaleVoice||selectSoftFemaleVoice();
      u.rate=0.92;
      u.pitch=1.03;
      u.volume=1;
      speechSynthesis.speak(u);
    }catch(_){ }
  }
  function answer(text){transcript.textContent=String(text);setStatus('Готов. Микрофон выключен.');speak(text)}

  function normalize(s){return String(s||'').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9.,+\- ]/gi,' ').replace(/\s+/g,' ').trim()}
  const commonStop=new Set('скажи покажи мне пожалуйста какая какой какое какие сколько стоит стоят цена цены остаток остатки на складе склад товар товара товары у по для дилер дилера долг долга задолженность задолженности найди найти выбери выбрать открой открыть продажа продажи новую новый новая добавь добавить в корзину позицию штук штуки штука шт метр метра метров м м2 кв квадратных розничная розницу оптовая опт оптовую'.split(' '));
  function tokens(s,extra=[]){const stop=new Set([...commonStop,...extra]);return normalize(s).split(' ').filter(x=>x&&!stop.has(x))}
  function scoreName(query,name,article=''){
    const q=tokens(query),c=tokens(name+' '+article,[]);if(!q.length)return 0;
    let score=0,matched=0;
    for(const qt of q){let best=0;for(const ct of c){if(qt===ct)best=Math.max(best,4);else if(ct.startsWith(qt)||qt.startsWith(ct))best=Math.max(best,2.7);else if(ct.includes(qt)||qt.includes(ct))best=Math.max(best,1.5)}if(best){matched++;score+=best}}
    if(matched===q.length)score+=5;
    score+=matched/q.length*3;
    return score;
  }
  function bestProduct(query){
    const arr=(typeof state!=='undefined'&&state.products||[]).filter(p=>!p.archived).map(p=>({p,score:scoreName(query,p.name,p.article)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
    if(!arr.length)return null;
    if(arr.length>1&&arr[0].score<5&&arr[1].score>=arr[0].score-.4)return null;
    return arr[0].p;
  }
  function bestDealer(query){
    const extra=['ах','ам','ом'];
    const q=tokens(query,extra),arr=(typeof state!=='undefined'&&state.dealers||[]).map(d=>{let name=normalize([d.name,d.fio,d.company,d.phone].filter(Boolean).join(' ')),score=0;for(const qt of q){if(name.includes(qt))score+=4}return{d,score}}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
    return arr[0]?.d||null;
  }
  function fmtMoney(n){return typeof money==='function'?money(n):((+n||0).toLocaleString('ru-RU')+' ₽')}
  function qtyFrom(text){
    const m=normalize(text).match(/(?:^|\s)(\d+(?:[.,]\d+)?)(?:\s|$)/);if(m)return Math.max(0,Number(m[1].replace(',','.'))||0);
    const map={один:1,одна:1,одно:1,одну:1,два:2,две:2,три:3,четыре:4,пять:5,шесть:6,семь:7,восемь:8,девять:9,десять:10,одиннадцать:11,двенадцать:12,тринадцать:13,четырнадцать:14,пятнадцать:15,шестнадцать:16,семнадцать:17,восемнадцать:18,девятнадцать:19,двадцать:20};
    for(const [w,n] of Object.entries(map))if(new RegExp('(^|\\s)'+w+'(\\s|$)').test(normalize(text)))return n;return 1;
  }
  function stripQty(text){return normalize(text).replace(/(?:^|\s)\d+(?:[.,]\d+)?(?:\s|$)/g,' ').replace(/\b(один|одна|одно|одну|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|одиннадцать|двенадцать|тринадцать|четырнадцать|пятнадцать|шестнадцать|семнадцать|восемнадцать|девятнадцать|двадцать)\b/g,' ')}
  function confirmAction(text){return window.confirm(text+'\n\nПодтвердить действие?')}

  async function runCommand(raw){
    const cmd=normalize(raw);if(!cmd)return;
    transcript.textContent='Вы сказали: '+raw;setStatus('Обрабатываю…');

    if(/\b(удали|удалить|сотри|стереть|очисти|очистить)\b/.test(cmd)){
      answer('Удаление голосовому помощнику запрещено. Удалить товар, дилера, чек или накладную можно только вручную.');return;
    }
    if(/\b(настройки)\b/.test(cmd)){
      if(typeof go==='function')go('assistantSettings');answer('Открыла настройки голосового помощника.');return;
    }
    if(/\b(открой|перейди|покажи)\b.*\b(продаж|продажу)\b|^продажа$/.test(cmd)){
      if(typeof go==='function')go('sales');answer('Открыла раздел «Новая продажа».');return;
    }
    if(/\bдолг\b|\bзадолж/.test(cmd)){
      const d=bestDealer(cmd);if(!d){answer('Не смогла однозначно найти дилера. Назови его точнее.');return}
      const debt=typeof debtOf==='function'?debtOf(d.id):0;answer('Долг дилера '+d.name+': '+fmtMoney(debt)+'.');return;
    }
    if(/\bостат/.test(cmd)){
      const p=bestProduct(cmd);if(!p){answer('Не смогла однозначно найти товар. Назови товар точнее.');return}
      const stock=Number.isFinite(+p.stock)?+p.stock:0;answer('Остаток '+p.name+': '+stock.toLocaleString('ru-RU')+' '+(p.unit||'шт')+'.');return;
    }
    if(/\bцен/.test(cmd)|/\bстоит\b/.test(cmd)){
      const p=bestProduct(cmd);if(!p){answer('Не смогла однозначно найти товар. Назови товар точнее.');return}
      const wholesale=/\b(опт|оптов)/.test(cmd);const price=wholesale?(+p.wholesalePrice||0):(+p.retailPrice||0);answer((wholesale?'Оптовая':'Розничная')+' цена '+p.name+': '+fmtMoney(price)+'.');return;
    }
    if(/\bвыбер/.test(cmd)&&/\bдилер/.test(cmd)){
      const d=bestDealer(cmd);if(!d){answer('Не смогла однозначно найти дилера. Назови его точнее.');return}
      if(!confirmAction('Выбрать дилера «'+d.name+'» в новой продаже?')){answer('Действие отменено.');return}
      if(typeof go==='function')go('sales');if(typeof selectSaleDealer==='function')selectSaleDealer(d.id);answer('Дилер '+d.name+' выбран.');return;
    }
    if(/\b(добавь|добавить)\b/.test(cmd)){
      const q=qtyFrom(cmd),p=bestProduct(stripQty(cmd));if(!p){answer('Не смогла однозначно найти товар. Назови его точнее.');return}
      const wholesale=/\b(опт|оптов)/.test(cmd);const price=wholesale?(+p.wholesalePrice||0):(+p.retailPrice||0);
      if(!confirmAction('Добавить в продажу: '+p.name+', '+q+' '+(p.unit||'шт')+', цена '+fmtMoney(price)+'?')){answer('Действие отменено.');return}
      if(typeof go==='function')go('sales');
      if(typeof selectSaleProduct==='function')selectSaleProduct(p.id);
      const priceTypeEl=document.getElementById('priceType');if(priceTypeEl){priceTypeEl.value=wholesale?'wholesale':'retail';priceTypeEl.dispatchEvent(new Event('change'))}
      if(typeof addToCart==='function')addToCart(q);
      answer('Добавила '+q+' '+(p.unit||'шт')+' — '+p.name+' в текущую продажу.');return;
    }
    if(/\b(сохрани|сохранить|оформи|оформить)\b.*\bпродаж/.test(cmd)){
      if(!confirmAction('Сохранить текущую продажу и сформировать накладную?')){answer('Сохранение отменено.');return}
      if(typeof saveSale==='function')saveSale();answer('Команда на сохранение продажи выполнена. Проверь сформированную накладную.');return;
    }
    answer('Команду не распознала. Можно спросить цену, остаток, долг дилера или сказать: «Открой продажу», «Выбери дилера …», «Добавь 3 …».');
  }

  function stopListening(){
    try{if(recognition)recognition.abort()}catch(_){ }
    recognition=null;btn.classList.remove('listening');btn.textContent='🎙 Ассистент';setStatus('Готов. Микрофон выключен.');
  }
  function startListening(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){answer('На этом компьютере распознавание речи в приложении недоступно. Можно вводить команды в поле ниже.');return}
    stopListening();
    try{
      recognition=new SR();recognition.lang='ru-RU';recognition.continuous=false;recognition.interimResults=false;recognition.maxAlternatives=1;
      recognition.onstart=()=>{btn.classList.add('listening');btn.textContent='🔴 Слушаю';setStatus('Слушаю один запрос…')};
      recognition.onresult=e=>{const t=e.results?.[0]?.[0]?.transcript||'';if(t){textInput.value=t;runCommand(t)}};
      recognition.onerror=e=>{const code=e.error||'ошибка';answer(code==='not-allowed'?'Нет доступа к микрофону. Разреши микрофон для приложения в настройках Windows.':'Не удалось распознать речь: '+code+'. Попробуй ещё раз.')};
      recognition.onend=()=>{btn.classList.remove('listening');btn.textContent='🎙 Ассистент';if(!modal.classList.contains('hidden'))setStatus('Готов. Микрофон выключен.');recognition=null};
      recognition.start();
    }catch(e){answer('Не удалось включить микрофон: '+String(e&&e.message||e))}
  }
  listenBtn.addEventListener('click',startListening);stopBtn.addEventListener('click',stopListening);
  modal.querySelector('#voiceRun').addEventListener('click',()=>runCommand(textInput.value));
  textInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();runCommand(textInput.value)}});

  // Для диагностики и ручного вызова из консоли без фонового прослушивания.
  window.voiceAssistant8915={open:openAssistant,run:runCommand,stop:stopListening};
})();