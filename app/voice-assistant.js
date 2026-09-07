(()=>{
  if(window.__uchetVoice8915)return;
  window.__uchetVoice8915=true;

  const SETTINGS_KEY='uchetVoiceSettings8915';
  let voiceSettings={speak:true,microphone:true};
  try{voiceSettings={...voiceSettings,...JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}}catch(_){ }
  const saveVoiceSettings=()=>{try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(voiceSettings))}catch(_){}};

  // Alias memory stays on this computer and contains only local product IDs.
  const ALIASES_KEY='uchetProductAliases8916';
  let aliases={};
  try{const saved=JSON.parse(localStorage.getItem(ALIASES_KEY)||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))aliases=saved}catch(_){}
  let pendingProduct=null;
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
    <div id="voiceTranscript" class="voiceTranscript">Начните: «Создай чек Ахмеду Карчеги». Затем: «Добавь 3 светильника 48 ватт». Если количество не названо, помощник переспросит. Синоним: «Запомни: парящий профиль = профиль Fly 01» — только после подтверждения.</div>
    <div class="voiceActions"><button id="voiceListen" class="primary" type="button">🎙 Слушать один запрос</button><button id="voiceStop" class="secondary" type="button">Стоп</button><button id="voiceAISettings" class="secondary" type="button">Настройки ИИ-помощника</button></div>
    <div class="voiceInputRow"><input id="voiceText" placeholder="Или введи команду текстом"><button id="voiceRun" class="primary" type="button">Выполнить</button></div>
    <div class="voiceHint">Микрофон включается <b>только</b> после нажатия «Слушать» и выключается после одного запроса. Изменяющие действия выполняются только после подтверждения. <span class="voiceDanger">Удаление голосом полностью запрещено.</span><br>Не произносите цены, долги и суммы оплат: онлайн-распознавание может передать запись сервису. Суммы вводите вручную; финансовые ответы показаны только на экране.</div>
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

  // Native modal overlays the current section without navigation or re-rendering.
  const priceDialog=document.createElement('dialog');
  priceDialog.id='voicePriceDialog';
  priceDialog.setAttribute('aria-labelledby','voicePriceHeading');
  priceDialog.style.cssText='width:min(420px,90vw);border:1px solid #dfe7e3;border-radius:16px;padding:22px;color:#20302b';
  priceDialog.innerHTML='<div class="voiceHead"><h2 id="voicePriceHeading">Цена товара</h2><button type="button" id="voicePriceCross" aria-label="Закрыть окно цены">×</button></div><p id="voicePriceName" style="font-size:20px;font-weight:700"></p><p id="voicePriceType"></p><p id="voicePriceValue" style="font-size:28px;font-weight:700"></p><button type="button" id="voicePriceClose" class="primary">Закрыть</button>';
  document.body.appendChild(priceDialog);
  let priceReturnFocus=null;
  function closePriceDialog(){priceDialog.close()}
  priceDialog.querySelector('#voicePriceCross').addEventListener('click',closePriceDialog);
  priceDialog.querySelector('#voicePriceClose').addEventListener('click',closePriceDialog);
  priceDialog.addEventListener('close',()=>{if(priceReturnFocus?.isConnected)priceReturnFocus.focus({preventScroll:true});priceReturnFocus=null});
  function showPriceDialog(product,price,wholesale){
    priceDialog.querySelector('#voicePriceName').textContent=product.name;
    priceDialog.querySelector('#voicePriceType').textContent=wholesale?'Оптовая цена':'Розничная цена';
    priceDialog.querySelector('#voicePriceValue').textContent=fmtMoney(price);
    if(!priceDialog.open){priceReturnFocus=document.activeElement;priceDialog.showModal()}
    priceDialog.querySelector('#voicePriceClose').focus({preventScroll:true});
  }

  const aiSettings=document.createElement('dialog');
  aiSettings.id='voiceAISettingsDialog';
  aiSettings.setAttribute('aria-labelledby','voiceAISettingsTitle');
  aiSettings.style.cssText='width:min(620px,90vw);max-height:85vh;overflow:auto;border:1px solid #dfe7e3;border-radius:16px;padding:22px';
  aiSettings.innerHTML='<h2 id="voiceAISettingsTitle">Настройки ИИ-помощника</h2><label class="voiceSettingRow"><input id="voiceAllowMic" type="checkbox"> Разрешить микрофон по кнопке</label><label class="voiceSettingRow"><input id="voiceAllowSpeech" type="checkbox"> Озвучивать нейтральные ответы</label><p>Финансовые суммы показываются только на экране. Не произносите их в микрофон.</p><p>Изменения требуют подтверждения. Удаление голосом запрещено.</p><h3>Запомненные названия</h3><p id="voiceMemoryCount"></p><ul id="voiceMemoryList"></ul><p>Память хранится на этом компьютере. Для нового соответствия введите в помощнике: «Запомни: короткое название = название товара из базы».</p><button id="voiceClearMemory" type="button" class="secondary">Очистить память помощника</button><p>Товары, дилеры, чеки и оплаты не удаляются. История разговоров помощником не сохраняется.</p><button id="voiceAISettingsClose" type="button" class="primary">Закрыть</button>';
  document.body.appendChild(aiSettings);
  function refreshMemory(){
    const entries=Object.entries(aliases);
    aiSettings.querySelector('#voiceMemoryCount').textContent='Запомнено названий: '+entries.length;
    const list=aiSettings.querySelector('#voiceMemoryList');list.textContent='';
    entries.forEach(([key,id])=>{
      const p=(state.products||[]).find(p=>String(p.id)===String(id));
      const row=document.createElement('li'),label=document.createElement('span'),remove=document.createElement('button');
      label.textContent=key+' → '+(p?p.name:'Товар больше не найден')+' ';
      remove.type='button';remove.textContent='Удалить соответствие';
      remove.addEventListener('click',()=>{
        if(!confirmAction('Забыть название «'+key+'»? Сам товар останется.'))return;
        delete aliases[key];pendingProduct=null;localStorage.setItem(ALIASES_KEY,JSON.stringify(aliases));refreshMemory();
      });
      row.appendChild(label);row.appendChild(remove);list.appendChild(row);
    });
  }
  modal.querySelector('#voiceAISettings').addEventListener('click',()=>{
    stopListening();pendingProduct=null;refreshMemory();
    aiSettings.querySelector('#voiceAllowMic').checked=voiceSettings.microphone!==false;
    aiSettings.querySelector('#voiceAllowSpeech').checked=voiceSettings.speak!==false;
    if(!aiSettings.open)aiSettings.showModal();
  });
  aiSettings.querySelector('#voiceAISettingsClose').addEventListener('click',()=>aiSettings.close());
  aiSettings.querySelector('#voiceAllowMic').addEventListener('change',e=>{
    voiceSettings.microphone=!!e.target.checked;saveVoiceSettings();if(!voiceSettings.microphone)stopListening();
    listenBtn.disabled=!voiceSettings.microphone;
  });
  aiSettings.querySelector('#voiceAllowSpeech').addEventListener('change',e=>{
    voiceSettings.speak=!!e.target.checked;saveVoiceSettings();
    const oldSetting=document.getElementById('voiceSpeakSetting');if(oldSetting)oldSetting.checked=voiceSettings.speak;
    if(!voiceSettings.speak)window.speechSynthesis?.cancel();
  });
  aiSettings.querySelector('#voiceClearMemory').addEventListener('click',()=>{
    if(!confirmAction('Очистить все запомненные названия помощника на этом компьютере? Товары, дилеры, чеки и оплаты останутся.'))return;
    aliases={};pendingProduct=null;localStorage.removeItem(ALIASES_KEY);refreshMemory();
  });

  const status=modal.querySelector('#voiceStatus');
  const transcript=modal.querySelector('#voiceTranscript');
  const textInput=modal.querySelector('#voiceText');
  const listenBtn=modal.querySelector('#voiceListen');
  const stopBtn=modal.querySelector('#voiceStop');
  listenBtn.disabled=voiceSettings.microphone===false;
  let recognition=null;

  function setStatus(t){status.textContent=t}
  function openAssistant(){modal.classList.remove('hidden');setStatus('Готов. Микрофон выключен.');setTimeout(()=>textInput.focus(),50)}
  function closeAssistant(){pendingProduct=null;stopListening();modal.classList.add('hidden')}
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
  // Only a fixed phrase may cross the speech boundary. Never pass answer text,
  // names, errors, database objects, prices or transcripts to synthesis.
  function speak(){
    if(voiceSettings.speak===false||!('speechSynthesis' in window))return;
    try{
      speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance('Ответ готов. Посмотрите на экран программы.');
      u.lang='ru-RU';
      u.voice=softFemaleVoice||selectSoftFemaleVoice();
      u.rate=0.92;
      u.pitch=1.03;
      u.volume=1;
      speechSynthesis.speak(u);
    }catch(_){ }
  }
  function answer(text){stopListening();transcript.textContent=String(text);setStatus('Готов. Микрофон выключен.');speak()}

  function normalize(s){return String(s||'').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9.,+\- ]/gi,' ').replace(/\s+/g,' ').trim()}
  const commonStop=new Set('скажи покажи мне пожалуйста какая какой какое какие сколько стоит стоят цена цены остаток остатки на складе склад товар товара товары у по для дилер дилера долг долга задолженность задолженности найди найти выбери выбрать открой открыть продажа продажи новую новый новая добавь добавить в корзину позицию штук штуки штука шт метр метра метров м м2 кв квадратных розничная розницу оптовая опт оптовую'.split(' '));
  function tokens(s,extra=[]){const stop=new Set([...commonStop,...extra]);return normalize(s).replace(/(\d)[.,](?=\d)/g,'$1 ').split(' ').filter(x=>x&&!stop.has(x))}
  function scoreName(query,name,article=''){
    const q=tokens(query),c=tokens(name+' '+article,[]);if(!q.length)return 0;
    let score=0,matched=0;
    for(const qt of q){let best=0;for(const ct of c){if(qt===ct)best=Math.max(best,4);else if(ct.startsWith(qt)||qt.startsWith(ct))best=Math.max(best,2.7);else if(ct.includes(qt)||qt.includes(ct))best=Math.max(best,1.5)}if(best){matched++;score+=best}}
    if(matched!==q.length)return 0;
    score+=5;
    score+=matched/q.length*3;
    return score;
  }
  function bestProduct(query){
    const aliasKey=tokens(query).sort().join(' ');
    if(Object.prototype.hasOwnProperty.call(aliases,aliasKey)){
      return (state.products||[]).find(p=>String(p.id)===String(aliases[aliasKey])&&!p.archived)||null;
    }
    const arr=(typeof state!=='undefined'&&state.products||[]).filter(p=>!p.archived).map(p=>({p,score:scoreName(query,p.name,p.article)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
    if(!arr.length)return null;
    if(arr.length>1&&arr[1].score>=arr[0].score-.4)return null;
    return arr[0].p;
  }
  function bestDealer(query){
    const q=tokens(query,['создай','создать','чек','накладную','клиента','клиенту','дилеру']);
    const matchWord=(x,y)=>x===y||(x.length>=4&&y.length>=4&&x.replace(/[аеиоуыя]$/u,'')===y.replace(/[аеиоуыя]$/u,''));
    const arr=(state.dealers||[]).filter(d=>{
      const name=normalize([d.name,d.fio,d.company].filter(Boolean).join(' ')).split(' ');
      return q.length>0&&q.every(x=>name.some(y=>matchWord(x,y)));
    });
    return arr.length===1?arr[0]:null;
  }
  function fmtMoney(n){return typeof money==='function'?money(n):((+n||0).toLocaleString('ru-RU')+' ₽')}
  const quantityWords={один:1,одна:1,одно:1,одну:1,два:2,две:2,три:3,четыре:4,пять:5,шесть:6,семь:7,восемь:8,девять:9,десять:10};
  function parseAddition(text){
    let query=normalize(text).replace(/^(добавь|добавить|положи)\s+/u,'');
    // Quantity must be explicitly first. Product specifications such as 48 W
    // or 2.05 m are retained in the name, never silently treated as quantity.
    const match=query.match(/^(\d+(?:[.,]\d+)?|один|одна|одно|одну|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять)(?:\s+|$)/u);
    let qty=null;
    if(match){qty=quantityWords[match[1]]??Number(match[1].replace(',','.'));query=query.slice(match[0].length)}
    // Also accept "парящий профиль 3 штуки"; avoid confusing "гардина 2 05"
    // with a quantity by requiring an explicit unit for trailing quantities.
    if(qty===null){
      const trailing=query.match(/\s+(\d+(?:[.,]\d+)?|один|одна|одно|одну|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять)\s+(?:шт|штук|штуки|штука|метр|метра|метров)[.!?]*$/u);
      if(trailing){qty=quantityWords[trailing[1]]??Number(trailing[1].replace(',','.'));query=query.slice(0,trailing.index)}
    }
    return {qty,query};
  }
  function confirmAction(text){return window.confirm(text+'\n\nПодтвердить действие?')}

  async function runCommand(raw){
    stopListening();
    const cmd=normalize(raw);if(!cmd)return;
    transcript.textContent='Вы сказали: '+raw;setStatus('Обрабатываю…');
    if(/^(отмена|отмени|не надо)$/u.test(cmd)){pendingProduct=null;answer('Добавление отменено.');return}
    if(pendingProduct){
      const amount=parseAddition('добавь '+cmd);
      if(amount.qty!==null&&tokens(amount.query).length===0){
        const pending=pendingProduct;pendingProduct=null;
        if(document.getElementById('saleDealer')?.value!==pending.dealer){answer('Дилер изменился. Назовите товар заново.');return}
        return runCommand('добавь '+amount.qty+' '+pending.query);
      }
      pendingProduct=null;
    }
    if(/^запомни(?=\s|:)/u.test(cmd)){
      const parts=String(raw).replace(/^запомни\s*:?\s*/iu,'').split('=');
      if(parts.length!==2){answer('Напишите: Запомни: короткое название = название товара из базы.');return}
      const p=bestProduct(parts[1]);
      const key=tokens(parts[0]).sort().join(' ');
      if(!p||!key||key.length>120){answer('Не нашла однозначный товар для этого названия. Уточните название из базы.');return}
      if(!confirmAction('Запомнить на этом компьютере: «'+parts[0].trim()+'» означает «'+p.name+'»?')){answer('Запоминание отменено.');return}
      aliases[key]=String(p.id);
      localStorage.setItem(ALIASES_KEY,JSON.stringify(aliases));
      answer('Запомнила название «'+parts[0].trim()+'» для товара «'+p.name+'».');return;
    }
    if(/^(создай|создать)\s+(чек|накладную)(?=\s|$)/u.test(cmd)){
      const d=bestDealer(cmd);
      if(!d){answer('Уточните дилера: назовите имя и населённый пункт как в карточке.');return}
      if(typeof cart!=='undefined'&&cart.length){answer('В продаже уже есть товары. Сначала завершите текущий чек вручную.');return}
      if(typeof selectSaleDealer!=='function'){answer('Создание чека недоступно.');return}
      if(!confirmAction('Открыть черновик чека для дилера «'+d.name+'»?')){answer('Действие отменено.');return}
      if(typeof go==='function')go('sales');selectSaleDealer(d.id);
      answer('Открыла черновик чека для '+d.name+'. Назовите товар и количество. Продажа пока не сохранена.');return;
    }

    if(/(^|\s)(удали|удалить|сотри|стереть|очисти|очистить)(?=\s|$)/u.test(cmd)){
      answer('Удаление голосовому помощнику запрещено. Удалить товар, дилера, чек или накладную можно только вручную.');return;
    }
    if(/^настройки$/u.test(cmd)){
      if(typeof go==='function')go('assistantSettings');answer('Открыла настройки голосового помощника.');return;
    }
    if(/^(?:(?:открой|перейди|покажи)\s+.*продаж\S*|продажа)$/u.test(cmd)){
      if(typeof go==='function')go('sales');answer('Открыла раздел «Новая продажа».');return;
    }
    if(/(^|\s)(долг|задолж)/u.test(cmd)){
      const d=bestDealer(cmd);if(!d){answer('Не смогла однозначно найти дилера. Назови его точнее.');return}
      const debt=typeof debtOf==='function'?debtOf(d.id):0;answer('Долг дилера '+d.name+': '+fmtMoney(debt)+'.');return;
    }
    if(/(^|\s)остат/u.test(cmd)){
      const p=bestProduct(cmd);if(!p){answer('Не смогла однозначно найти товар. Назови товар точнее.');return}
      const stock=Number.isFinite(+p.stock)?+p.stock:0;answer('Остаток '+p.name+': '+stock.toLocaleString('ru-RU')+' '+(p.unit||'шт')+'.');return;
    }
    if(/(^|\s)(цен|стоит)/u.test(cmd)){
      const p=bestProduct(cmd);if(!p){answer('Не смогла однозначно найти товар. Назови товар точнее.');return}
      const wholesale=/(^|\s)опт/u.test(cmd);const price=wholesale?(+p.wholesalePrice||0):(+p.retailPrice||0);answer((wholesale?'Оптовая':'Розничная')+' цена '+p.name+': '+fmtMoney(price)+'.');showPriceDialog(p,price,wholesale);return;
    }
    if(/(^|\s)выб[еи]р/u.test(cmd)&&/(^|\s)(дилер|клиент)/u.test(cmd)){
      const d=bestDealer(cmd);if(!d){answer('Не смогла однозначно найти дилера. Назови его точнее.');return}
      if(!confirmAction('Выбрать дилера «'+d.name+'» в новой продаже?')){answer('Действие отменено.');return}
      if(typeof selectSaleDealer!=='function'){answer('Выбор дилера недоступен.');return}
      if(typeof go==='function')go('sales');selectSaleDealer(d.id);answer('Дилер '+d.name+' выбран.');return;
    }
    if(/^(добавь|добавить|положи)(?=\s|$)/u.test(cmd)){
      if(!document.getElementById('saleDealer')?.value){answer('Сначала выберите дилера.');return}
      if(typeof selectSaleProduct!=='function'||typeof addToCart!=='function'||typeof fillDefaultPrice!=='function'){answer('Добавление товара недоступно.');return}
      const parsed=parseAddition(cmd),q=parsed.qty;
      if(q!==null&&(!Number.isFinite(q)||q<=0)){answer('Укажите положительное количество.');return}
      const p=bestProduct(parsed.query);if(!p){answer('Не смогла однозначно найти товар. Назови его точнее.');return}
      if(q===null){pendingProduct={query:parsed.query,dealer:document.getElementById('saleDealer').value};answer('Нашла «'+p.name+'». Сколько добавить? Назовите количество.');return}
      const priceTypeEl=document.getElementById('priceType');
      const wholesale=/(^|\s)опт/u.test(cmd)||(!/(^|\s)розниц/u.test(cmd)&&priceTypeEl?.value==='wholesale');
      const price=wholesale?(+p.wholesalePrice||0):(+p.retailPrice||0);
      if(!Number.isFinite(price)||price<=0){answer('Укажите цену товара вручную.');return}
      if(!confirmAction('Добавить в продажу: '+p.name+', '+q+' '+(p.unit||'шт')+', цена '+fmtMoney(price)+'?')){answer('Действие отменено.');return}
      if(typeof go==='function')go('sales');
      if(typeof selectSaleProduct==='function')selectSaleProduct(p.id);
      if(priceTypeEl)priceTypeEl.value=wholesale?'wholesale':'retail';
      fillDefaultPrice();
      if(typeof addToCart==='function')addToCart(q);
      answer('Добавила '+q+' '+(p.unit||'шт')+' — '+p.name+' в текущую продажу.');return;
    }
    if(/^(сохрани|сохранить|оформи|оформить)\s+.*(продаж|чек|наклад)/u.test(cmd)){
      if(!document.getElementById('saleDealer')?.value||typeof cart==='undefined'||!cart.length||typeof saveSale!=='function'){answer('Сначала выберите дилера и добавьте товары.');return}
      if(!confirmAction('Сохранить текущую продажу и сформировать накладную?')){answer('Сохранение отменено.');return}
      if(typeof saveSale==='function')saveSale();answer('Команда на сохранение продажи выполнена. Проверь сформированную накладную.');return;
    }
    // Once the dealer is selected, allow dictating a product without "добавь".
    // A known product must still resolve locally; unrelated questions do nothing.
    if(document.getElementById('saleDealer')?.value){
      let dictated=cmd;
      const took=cmd.match(/^(.+?)\s+взял[аи]?\s+(.+)$/u);
      if(took){
        const d=bestDealer(took[1]);
        if(!d||String(d.id)!==document.getElementById('saleDealer').value){
          answer('Имя в команде не совпадает с выбранным дилером. Уточните клиента.');return;
        }
        dictated=took[2];
      }
      if(bestProduct(parseAddition(dictated).query))return runCommand('добавь '+dictated);
    }
    answer('Команду не распознала. Можно спросить цену, остаток, долг дилера или сказать: «Открой продажу», «Выбери дилера …», «Добавь 3 …».');
  }

  function stopListening(){
    const active=recognition;recognition=null;
    try{if(active){active.onstart=null;active.onresult=null;active.onerror=null;active.onend=null;active.abort()}}catch(_){ }
    try{window.speechSynthesis?.cancel()}catch(_){ }
    btn.classList.remove('listening');btn.textContent='🎙 Ассистент';setStatus('Готов. Микрофон выключен.');
  }
  function startListening(){
    if(voiceSettings.microphone===false){answer('Микрофон отключён в настройках помощника.');return}
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){answer('На этом компьютере распознавание речи в приложении недоступно. Можно вводить команды в поле ниже.');return}
    stopListening();
    try{
      recognition=new SR();recognition.lang='ru-RU';recognition.continuous=false;recognition.interimResults=false;recognition.maxAlternatives=1;
      recognition.onstart=()=>{btn.classList.add('listening');btn.textContent='🔴 Слушаю';setStatus('Слушаю один запрос…')};
      recognition.onresult=e=>{const t=e.results?.[0]?.[0]?.transcript||'';stopListening();if(t){textInput.value=t;runCommand(t)}};
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
