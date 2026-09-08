(()=>{
  if(window.__uchetEnh8916)return;
  window.__uchetEnh8916=true;

  const css=document.createElement('style');
  css.textContent=`
    #assistantPricePopup{position:fixed;inset:0;z-index:320;background:#0007;display:flex;align-items:center;justify-content:center;padding:20px}
    #assistantPricePopup.hidden{display:none!important}
    #assistantPricePopup .pricePopupBox{width:min(520px,94vw);background:#fff;border-radius:18px;padding:22px;box-shadow:0 24px 80px #0005;position:relative}
    #assistantPricePopup .pricePopupName{font-size:21px;font-weight:800;margin:0 42px 10px 0}
    #assistantPricePopup .pricePopupValue{font-size:34px;font-weight:850;margin:6px 0 18px}
    #assistantPricePopup .pricePopupX{position:absolute;right:12px;top:10px;border:0;background:transparent;font-size:28px;cursor:pointer;line-height:1}
    .assistantMemoryRow{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:14px;padding-top:14px;border-top:1px solid #e2e8e5}
  `;
  document.head.appendChild(css);

  function ensurePricePopup(){
    let p=document.getElementById('assistantPricePopup');
    if(p)return p;
    p=document.createElement('div');p.id='assistantPricePopup';p.className='hidden';
    p.innerHTML='<div class="pricePopupBox"><button id="assistantPriceX" class="pricePopupX" type="button" aria-label="Закрыть">×</button><div class="pricePopupName" id="assistantPriceName">Товар</div><div class="pricePopupValue" id="assistantPriceValue">0 ₽</div><div style="display:flex;justify-content:flex-end"><button id="assistantPriceClose" class="primary" type="button">Закрыть</button></div></div>';
    document.body.appendChild(p);
    const close=()=>p.classList.add('hidden');
    p.querySelector('#assistantPriceClose').addEventListener('click',close);
    p.querySelector('#assistantPriceX').addEventListener('click',close);
    p.addEventListener('click',e=>{if(e.target===p)close()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!p.classList.contains('hidden'))close()});
    return p;
  }
  function showPricePopup(name,value){
    const p=ensurePricePopup();
    p.querySelector('#assistantPriceName').textContent=name||'Товар';
    p.querySelector('#assistantPriceValue').textContent=value||'';
    p.classList.remove('hidden');
  }

  let transcriptObserverAttached=false;
  function attachTranscriptObserver(){
    const el=document.getElementById('voiceTranscript');if(!el)return false;
    if(transcriptObserverAttached)return true;transcriptObserverAttached=true;
    let last='';
    const check=()=>{
      const t=String(el.textContent||'').trim();if(!t||t===last)return;last=t;
      const m=t.match(/^(Розничная|Оптовая) цена (.+?):\s*([\d\s.,]+\s*₽)\.?$/i);
      if(m)showPricePopup(m[2],m[3]);
    };
    new MutationObserver(check).observe(el,{childList:true,subtree:true,characterData:true});
    check();return true;
  }

  function addMemoryControls(){
    const sec=document.getElementById('assistantSettings');if(!sec||sec.querySelector('#assistantClearMemory'))return !!sec;
    const card=sec.querySelector('.card')||sec;
    const row=document.createElement('div');row.className='assistantMemoryRow';
    row.innerHTML='<button id="assistantClearMemory" class="secondary" type="button">Очистить память помощника</button><span class="muted">Удаляются только локальные настройки и история AI-помощника. Дилеры, товары, чеки, долги и настройки программы не затрагиваются.</span>';
    card.appendChild(row);
    row.querySelector('#assistantClearMemory').addEventListener('click',()=>{
      if(!confirm('Очистить локальную память и настройки голосового помощника? Данные учёта не будут удалены.'))return;
      const keys=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&/^(uchetVoice|uchetAssistant|assistantMemory)/i.test(k))keys.push(k)}
      keys.forEach(k=>localStorage.removeItem(k));
      alert('Память помощника очищена. Данные дилеров, товаров, продаж и долгов сохранены.');
    });
    return true;
  }

  // NewMatRos 8.9.17: отдельная категория 5,80 м и приоритет цены из карточки товара.
  function normText(v){return String(v||'').toLowerCase().replace(/ё/g,'е').replace(/,/g,'.').replace(/\s+/g,' ').trim()}
  function materialTokens(z){const s=normText([z['МатериалКаталог'],z['МатериалМатериал'],z['МатериалЦвет']].filter(Boolean).join(' '));return [...new Set((s.match(/[a-zа-я]+|\d{2,4}/gi)||[]).filter(x=>x.length>=2))]}
  function priceFromProductCard(z,width){
    if(typeof state==='undefined'||!Array.isArray(state.products))return 0;
    const toks=materialTokens(z),color=normText(z['МатериалЦвет']||'');
    const widthHints=width>=5.7?['5.8','580','5 8']:width>=3.8?['3.8','380','4.0','400','4.5','450','5.0','500']:['3.2','320','3.6','360','узк'];
    const arr=state.products.filter(p=>!p.archived).map(p=>{const hay=normText([p.name,p.article,p.extraInfo].filter(Boolean).join(' '));let score=0;if(color&&hay.includes(color))score+=8;toks.forEach(t=>{if(hay.includes(t))score+=t===color?5:2});if(widthHints.some(h=>hay.includes(h)))score+=7;if(width>=5.7&&/(5[., ]?8|580)/.test(hay))score+=8;if(width<=3.6&&/узк/.test(hay))score+=4;return {p,score}}).filter(x=>x.score>=7).sort((a,b)=>b.score-a.score);
    const p=arr[0]?.p;if(!p)return 0;return +p.wholesalePrice||+p.retailPrice||0;
  }
  function patchNewMatRos(){
    if(typeof window.nmBuildItems!=='function'||typeof window.nmFindRollWidth!=='function'||typeof window.nmPrices!=='function')return false;
    if(window.__nmBuildItems8916)return true;window.__nmBuildItems8916=true;const original=window.nmBuildItems;
    window.nmBuildItems=function(data){const items=original(data),z=data?.['Заказ']||{},width=window.nmFindRollWidth(data),p=window.nmPrices();const mat=items.find(i=>i.article==='NM-MAT');if(!mat)return items;const cardPrice=priceFromProductCard(z,width);let fallback=0;if(width>=5.7)fallback=+p.material580||+p.materialWide||+p.material||0;else if(width>=3.8)fallback=+p.materialWide||+p.material||0;else if(width>0&&width<=3.6)fallback=+p.materialNarrow||+p.material||0;else fallback=+p.material||0;const price=cardPrice||fallback;mat.price=price;mat.total=(+mat.qty||0)*price;mat.productPriceSource=cardPrice?'Карточка товара':'Настройки NewMatRos';return items};
    return true;
  }

  let tries=0;const timer=setInterval(()=>{tries++;const a=attachTranscriptObserver(),b=addMemoryControls(),c=patchNewMatRos();if((a&&b&&c)||tries>80)clearInterval(timer)},250);
})();
