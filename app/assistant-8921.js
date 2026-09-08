(()=>{
  if(window.__uchetAssistant8921)return;
  window.__uchetAssistant8921=true;

  const SETTINGS_KEY='uchetAssistant8921';
  const VOICE_KEY='uchetVoiceSelected8917';
  let settings={speak:true};
  try{settings={...settings,...JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}}catch(_){ }
  const saveSettings=()=>{try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings))}catch(_){}};

  const css=document.createElement('style');
  css.textContent=`
  #voiceAssistantBtn{position:fixed;right:24px;bottom:24px;z-index:72;background:#2f6f68;color:#fff;border:0;border-radius:999px;padding:13px 18px;box-shadow:0 10px 30px #0003;font-weight:800;cursor:pointer}
  #voiceAssistantBtn.listening{background:#b0443b}
  #voiceAssistantModal{position:fixed;inset:0;z-index:300;background:#0008;display:flex;align-items:center;justify-content:center;padding:20px}
  #voiceAssistantModal.hidden{display:none!important}.aiBox{width:min(760px,96vw);max-height:90vh;overflow:auto;background:#fff;border-radius:18px;padding:22px;box-shadow:0 25px 80px #0005}
  .aiHead{display:flex;justify-content:space-between;gap:12px;align-items:center}.aiHead h2{margin:0}.aiStatus{padding:8px 10px;border-radius:10px;background:#f1f5f3;color:#40534d;margin:14px 0}.aiTranscript{min-height:92px;border:1px solid #dfe7e3;background:#fbfcfb;border-radius:12px;padding:12px;white-space:pre-wrap}.aiActions{display:flex;gap:9px;flex-wrap:wrap;margin-top:12px}.aiInputRow{display:grid;grid-template-columns:1fr auto;gap:9px;margin-top:12px}.aiHint{font-size:12px;color:#68756f;margin-top:10px;line-height:1.45}.aiDanger{color:#b0443b;font-weight:700}.aiSettingRow{display:flex;gap:10px;align-items:center;margin:10px 0}.aiSettingRow input{width:auto}
  #assistantPricePopup8921{position:fixed;inset:0;z-index:340;background:#0007;display:flex;align-items:center;justify-content:center;padding:20px}#assistantPricePopup8921.hidden{display:none!important}.aiPriceBox{width:min(520px,94vw);background:#fff;border-radius:18px;padding:22px;box-shadow:0 24px 80px #0005;position:relative}.aiPriceX{position:absolute;right:12px;top:8px;border:0;background:transparent;font-size:28px;cursor:pointer}.aiPriceName{font-size:21px;font-weight:800;margin-right:42px}.aiPriceValue{font-size:34px;font-weight:850;margin:8px 0 18px}
  #runtime8921Badge{display:inline-flex;margin-left:10px;padding:4px 8px;border-radius:999px;background:#e8f2ef;color:#245b54;font-size:11px;font-weight:800;vertical-align:middle}
  `;
  document.head.appendChild(css);

  function escText(v){return String(v||'')}
  function normalize(v){return String(v||'').toLowerCase().replace(/ё/g,'е').replace(/[–—]/g,'-').replace(/[^a-zа-я0-9.,+\- ]/gi,' ').replace(/\s+/g,' ').trim()}
  const stop=new Set('скажи покажи мне пожалуйста какая какой какое какие сколько стоит стоят цена цены остаток остатки на складе склад товар товара товары у по для дилер дилера долг долга задолженность задолженности найди найти выбери выбрать открой открыть перейди продажа продажи новую новый новая добавь добавить в корзину позицию штук штуки штука шт метр метра метров м м2 кв квадратных розничная розницу оптовая опт оптовую'.split(' '));
  function words(v){return normalize(v).split(' ').filter(x=>x&&!stop.has(x))}
  function score(query,name,article=''){
    const q=words(query),c=normalize(name+' '+article).split(' ').filter(Boolean);if(!q.length)return 0;let s=0,m=0;
    for(const a of q){let b=0;for(const x of c){if(a===x)b=Math.max(b,5);else if(x.startsWith(a)||a.startsWith(x))b=Math.max(b,3);else if(x.includes(a)||a.includes(x))b=Math.max(b,1.5)}if(b){m++;s+=b}}
    if(m===q.length)s+=6;return s+m/q.length*3;
  }
  function bestProduct(q){const a=(state?.products||[]).filter(p=>!p.archived).map(p=>({p,s:score(q,p.name,p.article)})).filter(x=>x.s>0).sort((x,y)=>y.s-x.s);if(!a.length)return null;if(a.length>1&&a[0].s<6&&a[1].s>a[0].s-.5)return null;return a[0].p}
  function bestDealer(q){const t=words(q);const a=(state?.dealers||[]).map(d=>{const h=normalize([d.name,d.fio,d.company,d.phone].filter(Boolean).join(' '));let s=0;t.forEach(x=>{if(h.includes(x))s+=5});return{d,s}}).filter(x=>x.s>0).sort((x,y)=>y.s-x.s);return a[0]?.d||null}
  function moneyText(n){return typeof money==='function'?money(n):((+n||0).toLocaleString('ru-RU')+' ₽')}
  function qtyFrom(v){const s=normalize(v);const m=s.match(/(?:^|\s)(\d+(?:[.,]\d+)?)(?:\s|$)/);if(m)return Math.max(0,+m[1].replace(',','.')||0);const map={один:1,одна:1,одно:1,одну:1,два:2,две:2,три:3,четыре:4,пять:5,шесть:6,семь:7,восемь:8,девять:9,десять:10,одиннадцать:11,двенадцать:12,тринадцать:13,четырнадцать:14,пятнадцать:15,шестнадцать:16,семнадцать:17,восемнадцать:18,девятнадцать:19,двадцать:20};for(const [k,n] of Object.entries(map))if(new RegExp('(^|\\s)'+k+'(\\s|$)').test(s))return n;return 1}
  function removeQty(v){return normalize(v).replace(/(?:^|\s)\d+(?:[.,]\d+)?(?:\s|$)/g,' ').replace(/\b(один|одна|одно|одну|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|одиннадцать|двенадцать|тринадцать|четырнадцать|пятнадцать|шестнадцать|семнадцать|восемнадцать|девятнадцать|двадцать)\b/g,' ')}
  function confirmChange(text){return confirm(text+'\n\nПодтвердить действие?')}

  function chooseVoice(){
    if(!('speechSynthesis' in window))return null;const all=speechSynthesis.getVoices()||[];const saved=localStorage.getItem(VOICE_KEY)||'';if(saved){const v=all.find(x=>x.name===saved);if(v)return v}
    const ru=all.filter(v=>/^ru(-|_)?/i.test(v.lang)||/russian|рус/i.test(v.name));const rank=v=>{const n=String(v.name||'').toLowerCase();let s=0;if(/natural|neural|online/.test(n))s+=100;if(/svetlana|светлана|irina|ирина|alena|алена/.test(n))s+=60;if(/microsoft|google/.test(n))s+=20;if(v.localService===false)s+=10;return s};return ru.sort((a,b)=>rank(b)-rank(a))[0]||all[0]||null;
  }
  function speak(text){if(settings.speak===false||!('speechSynthesis' in window))return;try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(String(text));const v=chooseVoice();if(v){u.voice=v;u.lang=v.lang||'ru-RU'}else u.lang='ru-RU';u.rate=.96;u.pitch=1;speechSynthesis.speak(u)}catch(_){ }}

  const btn=document.createElement('button');btn.id='voiceAssistantBtn';btn.type='button';btn.textContent='🤖 ИИ-помощник';document.body.appendChild(btn);
  const modal=document.createElement('div');modal.id='voiceAssistantModal';modal.className='hidden';modal.innerHTML=`<div class="aiBox"><div class="aiHead"><h2>ИИ-помощник</h2><button id="aiClose" class="secondary" type="button">Закрыть</button></div><div id="aiStatus" class="aiStatus">Готов. Микрофон выключен.</div><div id="voiceTranscript" class="aiTranscript">Можно говорить обычными фразами: «найди дилера Карчигу», «какой долг у Карчиги», «цена мат 303 380», «остаток светильник 48 ватт», «открой продажу», «выбери дилера Магомед», «добавь 3 светильника 48 ватт».</div><div class="aiActions"><button id="aiListen" class="primary" type="button">🎙 Слушать один запрос</button><button id="aiStop" class="secondary" type="button">Стоп</button></div><div class="aiInputRow"><input id="aiText" placeholder="Или напиши команду обычными словами"><button id="aiRun" class="primary" type="button">Выполнить</button></div><div class="aiHint">Микрофон включается только после нажатия. Любое действие, меняющее данные или корзину, требует подтверждения. <span class="aiDanger">Удаление голосом запрещено.</span></div></div>`;document.body.appendChild(modal);
  const status=modal.querySelector('#aiStatus'),transcript=modal.querySelector('#voiceTranscript'),input=modal.querySelector('#aiText'),listen=modal.querySelector('#aiListen'),stopBtn=modal.querySelector('#aiStop');
  let rec=null;
  const setStatus=t=>status.textContent=t;const answer=t=>{transcript.textContent=String(t);setStatus('Готов. Микрофон выключен.');speak(t)};
  function openAssistant(){modal.classList.remove('hidden');setStatus('Готов. Микрофон выключен.');setTimeout(()=>input.focus(),30)}
  function stopListening(){try{rec?.stop()}catch(_){ }rec=null;btn.classList.remove('listening');listen.classList.remove('listening')}
  function closeAssistant(){stopListening();modal.classList.add('hidden')}
  btn.addEventListener('click',openAssistant);modal.querySelector('#aiClose').addEventListener('click',closeAssistant);modal.addEventListener('click',e=>{if(e.target===modal)closeAssistant()});

  function showPrice(p,wholesale){let o=document.getElementById('assistantPricePopup8921');if(!o){o=document.createElement('div');o.id='assistantPricePopup8921';o.className='hidden';o.innerHTML='<div class="aiPriceBox"><button class="aiPriceX" type="button">×</button><div class="aiPriceName"></div><div class="aiPriceValue"></div><div style="display:flex;justify-content:flex-end"><button class="primary aiPriceClose" type="button">Закрыть</button></div></div>';document.body.appendChild(o);const close=()=>o.classList.add('hidden');o.querySelector('.aiPriceX').onclick=close;o.querySelector('.aiPriceClose').onclick=close;o.addEventListener('click',e=>{if(e.target===o)close()})}const val=wholesale?(+p.wholesalePrice||0):(+p.retailPrice||0);o.querySelector('.aiPriceName').textContent=p.name;o.querySelector('.aiPriceValue').textContent=moneyText(val);o.classList.remove('hidden')}

  async function runCommand(raw){
    const cmd=normalize(raw);if(!cmd)return;transcript.textContent='Запрос: '+raw;setStatus('Обрабатываю…');
    if(/\b(удали|удалить|сотри|стереть|очисти|очистить)\b/.test(cmd)){answer('Удаление голосом запрещено. Удалять дилеров, товары, чеки и накладные можно только вручную.');return}
    if(/\bнастройк/.test(cmd)){if(typeof go==='function')go('assistantSettings');answer('Открыла настройки ИИ-помощника.');return}
    if(/\b(найди|открой|покажи)\b.*\bдилер/.test(cmd)&&!/\bдолг|задолж/.test(cmd)){const d=bestDealer(cmd);if(!d){answer('Не смогла однозначно найти дилера. Назови его точнее.');return}if(typeof openDealer==='function')openDealer(d.id);answer('Нашла дилера '+d.name+'.');return}
    if(/\bдолг\b|\bзадолж/.test(cmd)){const d=bestDealer(cmd);if(!d){answer('Не смогла однозначно найти дилера. Назови его точнее.');return}const debt=typeof debtOf==='function'?debtOf(d.id):0;answer('Долг дилера '+d.name+': '+moneyText(debt)+'.');return}
    if(/\bостат/.test(cmd)){const p=bestProduct(cmd);if(!p){answer('Не смогла однозначно найти товар. Назови товар точнее.');return}answer('Остаток '+p.name+': '+(+p.stock||0).toLocaleString('ru-RU')+' '+(p.unit||'шт')+'.');return}
    if(/\bцен/.test(cmd)||/\bстоит\b/.test(cmd)){const p=bestProduct(cmd);if(!p){answer('Не смогла однозначно найти товар. Назови товар точнее.');return}const wholesale=/\b(опт|оптов)/.test(cmd);showPrice(p,wholesale);answer((wholesale?'Оптовая':'Розничная')+' цена '+p.name+': '+moneyText(wholesale?(+p.wholesalePrice||0):(+p.retailPrice||0))+'.');return}
    if(/\b(найди|покажи)\b.*\bтовар/.test(cmd)){const p=bestProduct(cmd);if(!p){answer('Не смогла однозначно найти товар. Назови товар точнее.');return}if(typeof go==='function')go('products');const s=document.getElementById('productListSearch');if(s){s.value=p.name;if(typeof renderProducts==='function')renderProducts()}answer('Нашла товар '+p.name+'.');return}
    const wantsSale=/\b(открой|перейди|покажи)\b.*\bпродаж/.test(cmd)||/^продажа$/.test(cmd);
    const wantsAdd=/\b(добавь|добавить)\b/.test(cmd);
    if(wantsSale&&typeof go==='function')go('sales');
    if(/\bвыбер/.test(cmd)&&/\bдилер/.test(cmd)){const d=bestDealer(cmd);if(!d){answer('Не смогла однозначно найти дилера. Назови его точнее.');return}if(!confirmChange('Выбрать дилера «'+d.name+'» в новой продаже?')){answer('Действие отменено.');return}if(typeof go==='function')go('sales');if(typeof selectSaleDealer==='function')selectSaleDealer(d.id);answer('Дилер '+d.name+' выбран.');return}
    if(wantsAdd){const q=qtyFrom(cmd),p=bestProduct(removeQty(cmd));if(!p){answer('Не смогла однозначно найти товар. Назови товар точнее.');return}if(!confirmChange('Добавить в продажу: '+p.name+', '+q+' '+(p.unit||'шт')+'?')){answer('Действие отменено.');return}if(typeof go==='function')go('sales');if(typeof selectSaleProduct==='function')selectSaleProduct(p.id);if(typeof addToCart==='function')addToCart(q);answer('Добавила '+q+' '+(p.unit||'шт')+' — '+p.name+'.');return}
    if(wantsSale){answer('Открыла раздел «Новая продажа».');return}
    const navMap=[[/\bтовар/.test(cmd),'products'],[/\bоплат/.test(cmd),'payments'],[/\bдолг/.test(cmd),'debts'],[/newmatros|нью матрос|матрос/.test(cmd),'newmatros']];for(const [ok,id] of navMap){if(ok&&/\b(открой|перейди|покажи)\b/.test(cmd)){if(typeof go==='function')go(id);answer('Открыла нужный раздел.');return}}
    answer('Команду не распознала. Можно спросить цену, остаток или долг, найти дилера или товар, открыть продажу, выбрать дилера и добавить товар.');
  }

  modal.querySelector('#aiRun').addEventListener('click',()=>{const v=input.value.trim();if(v){input.value='';runCommand(v)}});input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();modal.querySelector('#aiRun').click()}});
  listen.addEventListener('click',()=>{stopListening();const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){answer('Голосовой ввод недоступен в этой системе. Напиши команду текстом.');return}try{rec=new SR();rec.lang='ru-RU';rec.interimResults=false;rec.continuous=false;rec.maxAlternatives=1;rec.onstart=()=>{setStatus('Слушаю один запрос…');btn.classList.add('listening');listen.classList.add('listening')};rec.onresult=e=>{const t=e.results?.[0]?.[0]?.transcript||'';if(t){transcript.textContent='Вы сказали: '+t;runCommand(t)}};rec.onerror=e=>{answer(e.error==='not-allowed'?'Нет доступа к микрофону. Разреши микрофон для приложения в настройках Windows.':'Ошибка микрофона: '+(e.error||'неизвестная ошибка'))};rec.onend=()=>{btn.classList.remove('listening');listen.classList.remove('listening');rec=null};rec.start()}catch(e){answer('Не удалось включить микрофон. Можно использовать текстовую команду.')}});stopBtn.addEventListener('click',()=>{stopListening();setStatus('Микрофон выключен.')});

  const nav=document.querySelector('nav'),main=document.querySelector('main');
  if(nav&&main&&!document.getElementById('assistantSettings')){
    const b=document.createElement('button');b.type='button';b.dataset.section='assistantSettings';b.innerHTML='<span class="navIcon">⚙</span>ИИ-помощник';b.onclick=()=>{if(typeof show==='function')show('assistantSettings',b)};nav.appendChild(b);
    const sec=document.createElement('section');sec.id='assistantSettings';sec.className='hidden';sec.innerHTML=`<h2>ИИ-помощник</h2><p class="sectionHint">Настройки помощника и голоса. Микрофон не слушает в фоне.</p><div class="card"><h3 style="margin-top:0">Настройки помощника</h3><label class="aiSettingRow"><input id="aiSpeak" type="checkbox"> Озвучивать ответы</label><label>Голос<select id="voiceNaturalSelect"><option value="">Автоматически — лучший русский голос</option></select></label><div class="aiActions"><button id="aiTestVoice" class="secondary" type="button">Проверить голос</button><button id="assistantClearMemory" class="secondary" type="button">Очистить память помощника</button></div><p class="muted">Если в Windows установлен голос Natural/Neural, он выбирается первым. Подтверждение изменяющих действий всегда включено. Удаление голосом запрещено.</p></div>`;main.appendChild(sec);
    const speakBox=sec.querySelector('#aiSpeak');speakBox.checked=settings.speak!==false;speakBox.onchange=()=>{settings.speak=!!speakBox.checked;saveSettings()};
    const sel=sec.querySelector('#voiceNaturalSelect');const fill=()=>{const vs=(speechSynthesis.getVoices()||[]).filter(v=>/^ru(-|_)?/i.test(v.lang)||/russian|рус/i.test(v.name));const cur=localStorage.getItem(VOICE_KEY)||'';sel.innerHTML='<option value="">Автоматически — лучший русский голос</option>'+vs.map(v=>'<option></option>').join('');vs.forEach((v,i)=>{sel.options[i+1].value=v.name;sel.options[i+1].textContent=v.name+' · '+v.lang});sel.value=vs.some(v=>v.name===cur)?cur:''};fill();speechSynthesis.addEventListener?.('voiceschanged',fill);sel.onchange=()=>{if(sel.value)localStorage.setItem(VOICE_KEY,sel.value);else localStorage.removeItem(VOICE_KEY)};
    sec.querySelector('#aiTestVoice').onclick=()=>speak('Проверка голоса. ИИ-помощник готов к работе.');sec.querySelector('#assistantClearMemory').onclick=()=>{if(!confirm('Очистить только настройки и память ИИ-помощника? Данные учёта останутся.'))return;localStorage.removeItem(SETTINGS_KEY);localStorage.removeItem(VOICE_KEY);alert('Память помощника очищена. Дилеры, товары, продажи и долги не затронуты.')};
  }

  const headerTitle=document.querySelector('header b');if(headerTitle&&!document.getElementById('runtime8921Badge')){const badge=document.createElement('span');badge.id='runtime8921Badge';badge.textContent='исправления 8.9.21 активны';headerTitle.appendChild(badge)}
})();