(()=>{
  if(window.__uchetAssistant8915)return;
  window.__uchetAssistant8915=true;

  const UPDATE_MANIFEST='https://raw.githubusercontent.com/saypudsoffitto-a11y/uchet-dilerov-updates/main/latest.json';
  const STORE_KEY='uchet_dilerov_v8';

  // Однокнопочное обновление: адрес обновлений встроен в программу.
  try{
    state.update=state.update||{};
    state.update.manifestUrl=UPDATE_MANIFEST;
    localStorage.setItem(STORE_KEY,JSON.stringify(state));
    const updateInput=document.getElementById('updateManifestUrl');
    if(updateInput){
      updateInput.value=UPDATE_MANIFEST;
      updateInput.readOnly=true;
      const label=updateInput.closest('label');
      if(label){label.firstChild.textContent='Сервер обновлений настроен автоматически';updateInput.style.display='none'}
    }
    const hint=document.querySelector('#updates .sectionHint');
    if(hint)hint.textContent='Нажми кнопку обновления — программа сама проверит новую версию, скачает установщик и запустит установку с сохранением данных.';
  }catch(e){console.error('Auto update setup failed',e)}

  const originalCheck=window.checkForUpdate;
  if(typeof originalCheck==='function'){
    window.checkForUpdate=async function(){
      try{state.update=state.update||{};state.update.manifestUrl=UPDATE_MANIFEST;const i=document.getElementById('updateManifestUrl');if(i)i.value=UPDATE_MANIFEST}catch(_){}
      return originalCheck();
    };
  }

  // Настройки помощника локальны для конкретного компьютера.
  state.assistantSettings=state.assistantSettings||{};
  const cfg=state.assistantSettings;
  const defaults={enabled:true,microphoneEnabled:true,voiceReplies:true,allowPrices:true,allowStock:true,allowDebts:true,allowNavigate:true,allowDealerSelect:true,allowCart:true,allowSaveSale:true,alwaysConfirm:true};
  Object.entries(defaults).forEach(([k,v])=>{if(cfg[k]==null)cfg[k]=v});
  function persistCfg(){localStorage.setItem(STORE_KEY,JSON.stringify(state))}
  persistCfg();

  const css=document.createElement('style');
  css.textContent=`
    #assistantTopControls{position:fixed;right:24px;top:14px;z-index:350;display:flex;gap:8px;align-items:center}
    #assistantTopControls button{padding:8px 12px;border-radius:10px;box-shadow:0 2px 10px #00000012}
    #smartAssistantPanel{position:fixed;right:24px;top:66px;z-index:349;width:min(430px,calc(100vw - 32px));background:#fff;border:1px solid #dfe7e3;border-radius:16px;box-shadow:0 18px 55px #0003;padding:16px;color:#20302b}
    #smartAssistantPanel.hidden,#assistantSettingsModal.hidden{display:none!important}
    #smartAssistantPanel h3,#assistantSettingsModal h3{margin:0 0 6px;font-size:18px}
    .assistantSafety{font-size:12px;color:#68756f;margin:0 0 12px}
    #smartAssistantAnswer{background:#f3f7f5;border:1px solid #dfe7e3;border-radius:12px;padding:11px;min-height:58px;margin:10px 0;white-space:pre-wrap}
    .assistantRow{display:flex;gap:8px}.assistantRow input{flex:1}
    #smartAssistantMic.listening{animation:pulseAssistant 1s infinite}
    @keyframes pulseAssistant{50%{transform:scale(1.08)}}
    #assistantSettingsModal{position:fixed;inset:0;background:#0008;z-index:360;display:flex;align-items:center;justify-content:center;padding:20px}
    #assistantSettingsBox{background:#fff;width:min(780px,100%);max-height:86vh;overflow:auto;border-radius:16px;padding:20px;box-shadow:0 25px 80px #0004}
    .assistantSettingsGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px 18px;margin-top:14px}
    .assistantSetting{display:flex!important;flex-direction:row!important;align-items:center;gap:9px;padding:9px 10px;border:1px solid #e3e9e6;border-radius:10px;background:#fafcfb;font-weight:600}
    .assistantSetting input{width:auto}.assistantLocked{opacity:.7;background:#f5f5f5}
    .assistantSettingsSection{margin-top:18px;padding-top:14px;border-top:1px solid #e3e9e6}
    .assistantConfirm{background:#fff7e8;border:1px solid #efd59c;border-radius:10px;padding:10px;margin-top:12px;color:#76520d}
    @media(max-width:900px){#assistantTopControls{right:10px}.assistantSettingsGrid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(css);

  // Только две аккуратные кнопки сверху. Помощник сам не слушает и сам не начинает говорить.
  const top=document.createElement('div');
  top.id='assistantTopControls';
  top.innerHTML='<button type="button" class="primary" id="smartAssistantBtn">🎙 Помощник</button><button type="button" class="secondary" id="assistantSettingsBtn">⚙ Настройки</button>';
  document.body.appendChild(top);

  const panel=document.createElement('div');
  panel.id='smartAssistantPanel';panel.className='hidden';
  panel.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3>Умный помощник</h3><button type="button" class="secondary" id="smartAssistantClose">Закрыть</button></div>
    <p class="assistantSafety">Помощник включается только этой кнопкой. Микрофон запускается только после нажатия 🎤. Никакого фонового прослушивания.</p>
    <div id="smartAssistantAnswer">Можно спросить цену, остаток или долг. Во время продажи: «Открой продажи», «Выбери дилера Иван», «Добавь чёрный кантик». Изменения выполняются только после подтверждения.</div>
    <div class="assistantRow"><input id="smartAssistantInput" autocomplete="off" placeholder="Скажи или напиши команду"><button type="button" class="primary" id="smartAssistantMic" title="Начать говорить">🎤</button><button type="button" class="primary" id="smartAssistantAsk">Выполнить</button></div>`;
  document.body.appendChild(panel);

  const settings=document.createElement('div');
  settings.id='assistantSettingsModal';settings.className='hidden';
  settings.innerHTML=`<div id="assistantSettingsBox">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><div><h3>Настройки</h3><div class="muted">Голосовой помощник</div></div><button type="button" class="secondary" id="assistantSettingsClose">Закрыть</button></div>
    <div class="assistantSettingsSection"><b>Основное</b><div class="assistantSettingsGrid">
      <label class="assistantSetting"><input type="checkbox" data-assistant-setting="enabled"> Включить помощника</label>
      <label class="assistantSetting"><input type="checkbox" data-assistant-setting="microphoneEnabled"> Разрешить микрофон</label>
      <label class="assistantSetting"><input type="checkbox" data-assistant-setting="voiceReplies"> Озвучивать ответы</label>
      <label class="assistantSetting"><input type="checkbox" data-assistant-setting="alwaysConfirm"> Всегда подтверждать изменения</label>
    </div></div>
    <div class="assistantSettingsSection"><b>Что помощнику разрешено читать</b><div class="assistantSettingsGrid">
      <label class="assistantSetting"><input type="checkbox" data-assistant-setting="allowPrices"> Цены товаров</label>
      <label class="assistantSetting"><input type="checkbox" data-assistant-setting="allowStock"> Остатки товаров</label>
      <label class="assistantSetting"><input type="checkbox" data-assistant-setting="allowDebts"> Долги дилеров</label>
    </div></div>
    <div class="assistantSettingsSection"><b>Работа во время продажи</b><div class="assistantSettingsGrid">
      <label class="assistantSetting"><input type="checkbox" data-assistant-setting="allowNavigate"> Открывать разделы</label>
      <label class="assistantSetting"><input type="checkbox" data-assistant-setting="allowDealerSelect"> Выбирать дилера</label>
      <label class="assistantSetting"><input type="checkbox" data-assistant-setting="allowCart"> Добавлять товар в текущий чек</label>
      <label class="assistantSetting"><input type="checkbox" data-assistant-setting="allowSaveSale"> Сохранять продажу после подтверждения</label>
    </div><div class="assistantConfirm"><b>Безопасность:</b> любое изменение учёта требует подтверждения. Голосовое удаление товаров, накладных, чеков и дилеров запрещено навсегда и не может быть включено в настройках.</div>
    <div class="assistantSettingsGrid"><label class="assistantSetting assistantLocked"><input type="checkbox" disabled> Удаление товаров голосом — запрещено</label><label class="assistantSetting assistantLocked"><input type="checkbox" disabled> Удаление накладных/чеков голосом — запрещено</label></div></div>
  </div>`;
  document.body.appendChild(settings);

  const input=document.getElementById('smartAssistantInput');
  const answer=document.getElementById('smartAssistantAnswer');
  const mic=document.getElementById('smartAssistantMic');
  let pendingAction=null;

  function refreshSettingsUI(){
    settings.querySelectorAll('[data-assistant-setting]').forEach(el=>{const k=el.dataset.assistantSetting;el.checked=!!cfg[k]});
    mic.disabled=!cfg.enabled||!cfg.microphoneEnabled;
    document.getElementById('smartAssistantBtn').disabled=!cfg.enabled;
  }
  settings.addEventListener('change',e=>{const el=e.target;if(!el.dataset?.assistantSetting)return;cfg[el.dataset.assistantSetting]=!!el.checked;if(el.dataset.assistantSetting==='alwaysConfirm'&&!el.checked){cfg.alwaysConfirm=true;el.checked=true;alert('Для безопасности подтверждение изменений отключать нельзя.')}persistCfg();refreshSettingsUI()});
  refreshSettingsUI();

  function normText(s){return String(s||'').toLowerCase().replace(/ё/g,'е').replace(/[;,!:?()\[\]{}"']/g,' ').replace(/[\\/]/g,' ').replace(/\s+/g,' ').trim()}
  function comparable(s){return normText(s).replace(/[.,_-]/g,' ').replace(/\s+/g,' ').trim()}
  function compact(s){return comparable(s).replace(/\s+/g,'')}
  function tokenize(s){return comparable(s).split(' ').filter(Boolean)}
  function softStem(s){s=String(s||'');return s.length<=4?s:s.slice(0,Math.max(4,s.length-2))}

  const productStop=new Set(['узнай','скажи','покажи','мне','какая','какой','какую','цена','цену','цены','товар','товара','на','у','по','сколько','осталось','остаток','остатка','есть','розничная','розница','оптовая','опт','закупка','закупочная','стоит','стоимость','сейчас','текущий','текущая','добавь','добавить','положи','положить','в','чек','корзину','штук','штуки','штука','количество','один','одна','одно','два','две','три','четыре','пять','шесть','семь','восемь','девять','десять']);
  const dealerStop=new Set(['узнай','скажи','покажи','мне','сколько','должен','должна','должно','долг','долга','у','дилер','дилера','клиент','клиента','сейчас','текущий','выбери','выбрать','поставь','продажа','продажи']);

  function scoreMatch(candidate,query){
    const c=comparable(candidate),q=comparable(query);if(!q)return 0;if(c===q)return 1200;if(c.includes(q))return 950-q.length;if(compact(c).includes(compact(q)))return 900-q.length;
    const qt=tokenize(q),ct=tokenize(c);let hit=0,soft=0;
    qt.forEach(t=>{if(ct.some(x=>x===t||x.includes(t)||t.includes(x)))hit++;else if(ct.some(x=>softStem(x)===softStem(t)))soft++});
    return hit*180+soft*110-ct.length;
  }
  function productQuery(text){return tokenize(text).filter(x=>!productStop.has(x)&&!/^\d+(?:[.,]\d+)?$/.test(x)).join(' ')}
  function dealerQuery(text){return tokenize(text).filter(x=>!dealerStop.has(x)).join(' ')}
  function findProduct(text){const q=productQuery(text);let best=null,bestScore=0;(state.products||[]).filter(p=>!p.archived).forEach(p=>{const s=Math.max(scoreMatch(p.name,q),scoreMatch(p.article,q));if(s>bestScore){best=p;bestScore=s}});return bestScore>=110?best:null}
  function findDealer(text){const q=dealerQuery(text);let best=null,bestScore=0;(state.dealers||[]).forEach(d=>{const s=scoreMatch((d.name||'')+' '+(d.phone||''),q);if(s>bestScore){best=d;bestScore=s}});return bestScore>=110?best:null}

  const numberWords={один:1,одна:1,одно:1,два:2,две:2,три:3,четыре:4,пять:5,шесть:6,семь:7,восемь:8,девять:9,десять:10};
  function parseQty(text){const t=tokenize(text);for(let i=0;i<t.length;i++){if(numberWords[t[i]])return numberWords[t[i]];if(/^\d+(?:[.,]\d+)?$/.test(t[i])){const n=Number(t[i].replace(',','.'));if(Number.isFinite(n)&&n>0)return n}}return 1}
  function rub(n){return (+n||0).toLocaleString('ru-RU',{maximumFractionDigits:2})+' рублей'}
  function qtyText(p){return (+p.stock||0).toLocaleString('ru-RU',{maximumFractionDigits:3})+' '+(p.unit||'шт')}
  function say(text){answer.textContent=text;if(!cfg.voiceReplies)return;try{if(!('speechSynthesis' in window))return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='ru-RU';const v=speechSynthesis.getVoices().find(x=>String(x.lang||'').toLowerCase().startsWith('ru'));if(v)u.voice=v;u.rate=1;speechSynthesis.speak(u)}catch(e){console.error('Speech synthesis failed',e)}}
  function stage(description,fn){pendingAction={description,fn};say(description+' Скажи «подтверждаю» или нажми «Выполнить» ещё раз после слова подтверждаю.')}
  function confirmPending(){if(!pendingAction){say('Нет действия, которое нужно подтверждать.');return}const a=pendingAction;pendingAction=null;try{a.fn();say('Готово. '+a.description.replace(/^Подтверди:\s*/i,''))}catch(e){console.error(e);say('Не удалось выполнить действие: '+e.message)}}
  function cancelPending(){pendingAction=null;say('Действие отменено.')}

  function handleCommand(raw){
    const t=normText(raw);if(!t){say('Скажи или напиши вопрос.');return}
    if(/^(подтверждаю|подтвердить|да подтверждаю|выполняй|выполнить)$/.test(t)){confirmPending();return}
    if(/^(отмена|отмени|не надо|нет отмена)$/.test(t)){cancelPending();return}
    if(/(удал|стер|снес|убер).*(товар|наклад|чек|дилер)/.test(t)){say('Удаление голосом запрещено. Товары, накладные, чеки и дилеров можно удалять только вручную.');return}

    if(/(открой|перейди|покажи).*(продаж)/.test(t)){
      if(!cfg.allowNavigate){say('В настройках помощнику запрещено открывать разделы.');return}go('sales');say('Открыла раздел «Новая продажа».');return;
    }

    if(/(выбери|выбрать|поставь).*(дилер|клиент)/.test(t)){
      if(!cfg.allowDealerSelect){say('В настройках помощнику запрещено выбирать дилера.');return}
      const d=findDealer(t);if(!d){say('Не нашла дилера. Назови имя или телефон точнее.');return}
      if(cfg.allowNavigate)go('sales');
      if(typeof selectSaleDealer!=='function'){say('Не могу выбрать дилера в текущем окне.');return}
      selectSaleDealer(d.id);say('Выбран дилер '+d.name+'.');return;
    }

    if(/(добавь|добавить|положи|положить).*(товар|чек|корзин)/.test(t)||/^(добавь|добавить|положи|положить)\b/.test(t)){
      if(!cfg.allowCart){say('В настройках помощнику запрещено добавлять товары в чек.');return}
      const dId=document.getElementById('saleDealer')?.value;if(!dId){say('Сначала выбери дилера. Можно сказать: «Выбери дилера Иван».');return}
      const p=findProduct(t);if(!p){say('Не нашла товар. Назови его точнее. Порядок слов не важен: «чёрный кантик» и «кантик чёрный» считаются одним запросом.');return}
      const q=parseQty(t);const price=priceType?.value==='wholesale'?+p.wholesalePrice||0:+p.retailPrice||0;
      const desc='Подтверди: добавить «'+p.name+'», количество '+q+' '+(p.unit||'шт')+', цена '+rub(price)+'.';
      stage(desc,()=>{go('sales');selectSaleProduct(p.id);fillDefaultPrice();addToCart(q)});return;
    }

    if(/(сохрани|проведи|заверши).*(продаж|чек|наклад)/.test(t)){
      if(!cfg.allowSaveSale){say('В настройках помощнику запрещено сохранять продажу.');return}
      if(!document.getElementById('saleDealer')?.value){say('Дилер не выбран.');return}
      if(!(cart||[]).length){say('В текущей продаже нет товаров.');return}
      stage('Подтверди: сохранить текущую продажу и сформировать накладную.',()=>saveSale());return;
    }

    if(/\b(должен|долг|задолжен)\b/.test(t)){
      if(!cfg.allowDebts){say('Доступ к долгам отключён в настройках помощника.');return}const d=findDealer(t);if(!d){say('Не нашла дилера в базе. Назови имя или телефон точнее.');return}say('Дилер '+d.name+' должен '+rub(debtOf(d.id))+'.');return;
    }
    if(/(остат|сколько осталось|сколько есть)/.test(t)){
      if(!cfg.allowStock){say('Доступ к остаткам отключён в настройках помощника.');return}const p=findProduct(t);if(!p){say('Не нашла товар. Назови его точнее.');return}say(p.name+': текущий остаток '+qtyText(p)+'.');return;
    }
    if(/(цена|стоит|стоимость|почем|почём|опт|розниц|закуп)/.test(t)){
      if(!cfg.allowPrices){say('Доступ к ценам отключён в настройках помощника.');return}const p=findProduct(t);if(!p){say('Не нашла товар. Назови его точнее, например «гардина 2.05».');return}let label='розничная цена',v=+p.retailPrice||0;if(/опт/.test(t)){label='оптовая цена';v=+p.wholesalePrice||0}else if(/закуп/.test(t)){label='закупочная цена';v=+p.buyPrice||0}say(p.name+': '+label+' '+rub(v)+(cfg.allowStock?'. Остаток '+qtyText(p):'.'));return;
    }
    const p=findProduct(t);if(p&&cfg.allowPrices){say('Нашла '+p.name+'. Розничная цена '+rub(p.retailPrice)+', оптовая '+rub(p.wholesalePrice)+(cfg.allowStock?', остаток '+qtyText(p):'.'));return}
    say('Не поняла команду. Можно спросить цену, остаток, долг или сказать: «Открой продажи», «Выбери дилера …», «Добавь …».');
  }

  function submit(){handleCommand(input.value.trim())}
  document.getElementById('smartAssistantBtn').addEventListener('click',()=>{panel.classList.toggle('hidden');settings.classList.add('hidden');if(!panel.classList.contains('hidden'))setTimeout(()=>input.focus(),20)});
  document.getElementById('assistantSettingsBtn').addEventListener('click',()=>{refreshSettingsUI();settings.classList.remove('hidden');panel.classList.add('hidden')});
  document.getElementById('assistantSettingsClose').addEventListener('click',()=>settings.classList.add('hidden'));
  document.getElementById('smartAssistantClose').addEventListener('click',()=>panel.classList.add('hidden'));
  document.getElementById('smartAssistantAsk').addEventListener('click',submit);
  input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submit()}});

  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;let recognition=null;
  if(Recognition){
    recognition=new Recognition();recognition.lang='ru-RU';recognition.interimResults=false;recognition.continuous=false;recognition.maxAlternatives=1;
    recognition.onstart=()=>{mic.classList.add('listening');mic.textContent='⏹'};
    recognition.onend=()=>{mic.classList.remove('listening');mic.textContent='🎤'};
    recognition.onerror=e=>{answer.textContent='Не удалось распознать голос. Можно написать команду вручную.';console.error('Speech recognition',e)};
    recognition.onresult=e=>{const text=e.results?.[0]?.[0]?.transcript||'';input.value=text;handleCommand(text)};
    mic.addEventListener('click',()=>{if(!cfg.enabled||!cfg.microphoneEnabled)return;try{if(mic.classList.contains('listening'))recognition.stop();else recognition.start()}catch(e){console.error('Recognition start failed',e)}});
  }else{mic.disabled=true;mic.title='Голосовое распознавание недоступно на этом компьютере'}
})();
