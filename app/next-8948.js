(()=>{
  'use strict';
  if(window.__next8948Installed)return;
  window.__next8948Installed=true;

  const h=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rub=v=>typeof money==='function'?money(v):(Number(v||0).toLocaleString('ru-RU')+' ₽');

  function formatWidth8948(v){
    const n=Number(v)||0;
    if(!n)return '';
    return n.toLocaleString('ru-RU',{minimumFractionDigits:Number.isInteger(n)?0:1,maximumFractionDigits:2});
  }
  function compactMaterialName8948(data){
    const z=data?.['Заказ']||{};
    let width=0;
    try{if(typeof nmFindRollWidth==='function')width=+nmFindRollWidth(data)||0}catch(_){}
    const material=String(z['МатериалКаталог']||z['МатериалМатериал']||'Материал').trim();
    const widthText=formatWidth8948(width);
    const film=width>0&&width<=3.60?'узкая плёнка':width>=3.80?'широкая плёнка':'плёнка';
    return material+(widthText?' · рулон '+widthText+' м':'')+' · '+film;
  }

  const previousNmBuildItems=typeof nmBuildItems==='function'?nmBuildItems:window.nmBuildItems;
  if(typeof previousNmBuildItems==='function'){
    const wrapped=function(data){
      const items=previousNmBuildItems(data)||[];
      const material=items.find(i=>i&&i.article==='NM-MAT');
      if(material)material.name=compactMaterialName8948(data);
      return items;
    };
    window.nmBuildItems=wrapped;
    try{nmBuildItems=wrapped}catch(_){}
  }

  const style=document.createElement('style');
  style.id='next8948Style';
  style.textContent=`
    #products .productTable{table-layout:fixed!important;width:100%!important;min-width:1030px!important}
    #products .productTable th:nth-child(1),#products .productTable td:nth-child(1){width:130px!important}
    #products .productTable th:nth-child(2),#products .productTable td:nth-child(2){width:90px!important}
    #products .productTable th:nth-child(3),#products .productTable td:nth-child(3){width:360px!important;white-space:normal!important}
    #products .productTable th:nth-child(4),#products .productTable td:nth-child(4){width:78px!important;text-align:right}
    #products .productTable th:nth-child(5),#products .productTable td:nth-child(5){width:66px!important}
    #products .productTable th:nth-child(6),#products .productTable td:nth-child(6),
    #products .productTable th:nth-child(7),#products .productTable td:nth-child(7),
    #products .productTable th:nth-child(8),#products .productTable td:nth-child(8){width:88px!important;text-align:right}
    #products .productTable th:nth-child(9),#products .productTable td:nth-child(9){width:126px!important}
    #products .productTable th,#products .productTable td{padding:6px 7px!important}
    .productContextMenu8948{position:fixed;z-index:760;background:#fff;border:1px solid #cfd6e0;border-radius:10px;box-shadow:0 14px 40px #0003;padding:6px;min-width:235px}
    .productContextMenu8948 button{display:block;width:100%;text-align:left;background:#fff;color:#172033;padding:9px 11px;border:0;border-radius:7px}
    .productContextMenu8948 button:hover{background:#edf4ff}
    .productContextMenu8948 .dangerMenuItem{color:#b42318}
    .productContextMenu8948 .dangerMenuItem:hover{background:#fff0f0}

    /* Интерфейс из присланной улучшенной версии: читаемость без потери компактных рабочих таблиц. */
    html body{line-height:1.5}
    html button,html .btn{min-height:40px;padding:12px 16px;display:inline-flex;align-items:center;justify-content:center}
    html .miniBtn,html .receipt .actions button,html #products .productTable .actions button{min-height:auto}
    html th,html td{padding:12px 13px;font-size:14px;line-height:1.4;vertical-align:middle}
    html #products .productTable th,html #products .productTable td{font-size:14px!important;line-height:1.35!important}
    html .choiceRow{min-height:36px;font-size:14px}
    html .modal{backdrop-filter:blur(2px)}
    html .modalBox{border:1px solid var(--line)}
  `;
  (document.head||document.documentElement).appendChild(style);

  const closeMenu=()=>document.getElementById('productContextMenu8948')?.remove();
  async function copyText8948(text){
    try{
      if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return true}
    }catch(_){}
    try{
      const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();
      const ok=document.execCommand('copy');ta.remove();return !!ok;
    }catch(_){return false}
  }
  function productText8948(p){
    const g=(state.groups||[]).find(x=>String(x.id)===String(p.groupId));
    return [
      'Товар: '+String(p.name||''),
      'Группа: '+String(g?.name||''),
      'Артикул: '+String(p.article||''),
      'Ед.: '+String(p.unit||'шт'),
      'Закупка: '+rub(p.buyPrice),
      'Розница: '+rub(p.retailPrice),
      'Опт: '+rub(p.wholesalePrice)
    ].join('\n');
  }
  function createProductCopy8948(id){
    const p=(state.products||[]).find(x=>String(x.id)===String(id));if(!p)return;
    const copy={...p,id:Date.now(),name:String(p.name||'Товар')+' (копия)',stock:0,archived:false,createdAt:new Date().toLocaleString('ru-RU')};
    delete copy.updatedAt;
    state.products.push(copy);
    save();
    if(typeof editProduct==='function')editProduct(copy.id);
  }
  function createNewProduct8948(){
    if(typeof toggleAddProductForm==='function')toggleAddProductForm(true);
    for(const id of ['pname','particle','pbuy','pretail','pwholesale']){
      const el=document.getElementById(id);if(el)el.value='';
    }
    const unit=document.getElementById('punit');if(unit)unit.value='шт';
    const photo=document.getElementById('pphoto');if(photo)photo.value='';
    setTimeout(()=>document.getElementById('pname')?.focus(),50);
  }
  function showProductContextMenu8948(e,id){
    e.preventDefault();e.stopPropagation();closeMenu();
    const p=(state.products||[]).find(x=>String(x.id)===String(id));if(!p)return;
    const menu=document.createElement('div');menu.id='productContextMenu8948';menu.className='productContextMenu8948';
    menu.style.left=Math.min(e.clientX,window.innerWidth-255)+'px';
    menu.style.top=Math.min(e.clientY,window.innerHeight-245)+'px';
    const actions=[
      ['Изменить товар',()=>editProduct(id),''],
      ['Копировать',async()=>{const ok=await copyText8948(productText8948(p));if(!ok)alert('Не удалось скопировать товар в буфер обмена.');},''],
      ['Создать копию карточки',()=>createProductCopy8948(id),''],
      ['Создать новый товар',()=>createNewProduct8948(),''],
      ['Удалить товар',()=>{if(typeof delProduct==='function')delProduct(id)},'dangerMenuItem']
    ];
    for(const [label,fn,cls] of actions){
      const b=document.createElement('button');b.type='button';b.textContent=label;b.className=cls;
      b.onclick=()=>{closeMenu();fn()};menu.appendChild(b);
    }
    document.body.appendChild(menu);
  }
  window.showProductContextMenu8948=showProductContextMenu8948;
  document.addEventListener('click',closeMenu);window.addEventListener('blur',closeMenu);

  function enhanceProductRows8948(){
    document.querySelectorAll('#productRows tr').forEach(row=>{
      const open=[...row.querySelectorAll('button')].find(b=>/editProduct\(/.test(b.getAttribute('onclick')||''));
      const m=(open?.getAttribute('onclick')||'').match(/editProduct\((\d+)\)/);
      if(!m)return;
      row.dataset.productId=m[1];
      row.title='Правая кнопка мыши: действия с товаром';
      row.oncontextmenu=e=>showProductContextMenu8948(e,m[1]);
    });
  }
  const previousRenderProducts=typeof renderProducts==='function'?renderProducts:window.renderProducts;
  if(typeof previousRenderProducts==='function'){
    const wrappedRenderProducts=function(){const out=previousRenderProducts.apply(this,arguments);enhanceProductRows8948();return out};
    window.renderProducts=wrappedRenderProducts;
    try{renderProducts=wrappedRenderProducts}catch(_){}
  }
  enhanceProductRows8948();
  new MutationObserver(enhanceProductRows8948).observe(document.getElementById('productRows')||document.body,{childList:true,subtree:true});

  function receiptJpegHtml8948(op,d){
    const rows=(op.items||[]).map((i,n)=>`<tr><td>${n+1}</td><td>${h(i.article||'')}</td><td>${h(i.name||'')}</td><td>${h(i.qty)} ${h(i.unit||'шт')}</td><td>${rub(i.price)}</td><td>${rub(i.total)}</td></tr>`).join('');
    return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
      *{box-sizing:border-box}html,body{margin:0;background:#fff}body{font-family:Arial,sans-serif;color:#111;width:980px;padding:34px;font-size:17px}
      h1{text-align:center;font-size:24px;margin:0 0 18px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:10px 22px;margin-bottom:16px}
      table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #222;padding:8px 9px;text-align:left;vertical-align:top}th{background:#f3f3f3}
      td:nth-child(3){width:42%}.total{text-align:right;font-size:22px;font-weight:700;margin-top:16px}.debt{text-align:right;margin-top:8px}
      .sign{display:flex;justify-content:space-between;margin-top:34px;padding-bottom:16px}
    </style></head><body><h1>ТОВАРНАЯ НАКЛАДНАЯ № ${h(op.receiptNo)} от ${h(op.date)}</h1>
    <div class="meta"><div><b>Поставщик:</b> ____________________</div><div><b>Покупатель:</b> ${h(d?.name||op.dealer||'')}</div></div>
    <table><thead><tr><th>№</th><th>Артикул</th><th>Наименование</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="total">Итого: ${rub(op.total)}</div><div class="debt"><b>Остаток долга:</b> ${rub(debtOf(op.dealerId))}</div>
    <div class="sign"><span>Отпустил: ____________________</span><span>Получил: ____________________</span></div></body></html>`;
  }

  const modalCloseMap8948={
    productModal:'closeProductModal',
    dealerModal:'closeDealerModal',
    receiptViewModal:'closeReceiptView',
    qtyModal:'closeQtyModal',
    initialDebtModal:'closeInitialDebtModal',
    debtReportModal:'closeDebtReport'
  };
  function closeModalOnEscape8948(e){
    if(e.key!=='Escape'||e.defaultPrevented)return;
    const open=[...document.querySelectorAll('.modal:not(.hidden)')].filter(m=>m.offsetParent!==null||m.getClientRects().length);
    if(!open.length)return;
    const modal=open[open.length-1],fnName=modalCloseMap8948[modal.id];
    const fn=fnName&&(window[fnName]||globalThis[fnName]);
    if(typeof fn==='function'){e.preventDefault();fn();return}
    const close=modal.querySelector('.actions button.secondary,button[onclick*="close"],button[onclick*="Close"]');
    if(close){e.preventDefault();close.click()}
  }
  document.addEventListener('keydown',closeModalOnEscape8948);

  window.sendWhatsApp=async function(id){
    const op=(state.ops||[]).find(x=>String(x.id)===String(id)),d=op&&(state.dealers||[]).find(x=>String(x.id)===String(op.dealerId));
    if(!op)return;
    if(!window.receiptAPI?.sendJpeg)return alert('Отправка JPEG появится после установки следующего обновления.');
    const r=await window.receiptAPI.sendJpeg({phone:d?.phone||'',fileName:`Товарная_накладная_${op.receiptNo}.jpg`,html:receiptJpegHtml8948(op,d)});
    if(!r?.ok)return alert(r?.message||'Не удалось подготовить JPEG для WhatsApp');
    if(r.message)alert(r.message);
  };


  // 8.9.48: один и тот же дилер (нормализованные имя + телефон) должен
  // существовать в общей базе только один раз, даже если три ПК создали
  // разные ID до синхронизации.
  const normDealerName8948=v=>String(v??'')
    .normalize('NFKC').replace(/\u00a0/g,' ').trim().replace(/\s+/g,' ')
    .replace(/ё/g,'е').toLocaleLowerCase('ru-RU');
  const normDealerPhone8948=v=>{
    let d=String(v??'').replace(/\D/g,'');
    if(d.length===11&&d[0]==='8')d='7'+d.slice(1);
    if(d.length===10)d='7'+d;
    return d;
  };
  const dealerKey8948=d=>{
    const name=normDealerName8948(d?.name),phone=normDealerPhone8948(d?.phone);
    return name&&phone?name+'\u0000'+phone:'';
  };
  const dealerStamp8948=d=>{
    const direct=Number(d?.updatedAt||d?.ts||0);
    if(Number.isFinite(direct)&&direct>0)return direct;
    const parsed=Date.parse(String(d?.updatedAt||''));
    if(Number.isFinite(parsed))return parsed;
    const id=Number(d?.id||0);
    return Number.isFinite(id)?id:0;
  };
  const dealerScore8948=d=>[
    'city','company','fio','address','email','www','clientGroup',
    'paymentMethod','shippingMethod','note','photo','source'
  ].reduce((n,k)=>n+(String(d?.[k]??'').trim()?1:0),0);
  const mergeAliases8948=(a,b)=>{
    const out={};
    for(const src of [a||{},b||{}])for(const [k,v] of Object.entries(src)){
      const from=String(k),to=String(v??'');
      if(from&&to&&from!==to)out[from]=to;
    }
    return out;
  };
  const resolveAlias8948=(aliases,id)=>{
    let cur=String(id??''),seen=new Set();
    for(let i=0;i<24&&cur&&aliases?.[cur]&&!seen.has(cur);i++){
      seen.add(cur);cur=String(aliases[cur]);
    }
    return cur;
  };
  const mergeDealerFields8948=(target,source)=>{
    if(!target||!source)return target;
    for(const k of ['phone','city','company','fio','address','email','www','clientGroup','paymentMethod','shippingMethod','note','photo','source']){
      if(!String(target[k]??'').trim()&&String(source[k]??'').trim())target[k]=source[k];
    }
    const t=dealerStamp8948(target),s=dealerStamp8948(source);
    if(s>t&&source.updatedAt)target.updatedAt=source.updatedAt;
    return target;
  };
  function canonicalizeDealerDuplicates8948(s){
    if(!s||!Array.isArray(s.dealers))return {changed:false,removed:0,relinked:0,aliases:{}};
    s.ops=Array.isArray(s.ops)?s.ops:[];
    s.deletedDealers=s.deletedDealers&&typeof s.deletedDealers==='object'?s.deletedDealers:{};
    s.dealerAliases=s.dealerAliases&&typeof s.dealerAliases==='object'?s.dealerAliases:{};

    // Apply previously learned aliases to history first. This keeps old sales and
    // payments attached even if an older PC sends an obsolete duplicate ID.
    let relinked=0;
    for(const op of s.ops){
      if(!op||op.dealerId==null)continue;
      const target=resolveAlias8948(s.dealerAliases,op.dealerId);
      if(target&&target!==String(op.dealerId)){op.dealerId=/^\d+$/.test(target)?Number(target):target;relinked++}
    }

    const usage=new Map();
    for(const op of s.ops||[]){
      if(op?.dealerId==null)continue;
      const k=String(op.dealerId);usage.set(k,(usage.get(k)||0)+1);
    }
    const buckets=new Map();
    for(const d of s.dealers){
      if(!d)continue;
      const key=dealerKey8948(d);
      if(!key)continue; // Never merge name-only cards: phone is required.
      if(!buckets.has(key))buckets.set(key,[]);
      buckets.get(key).push(d);
    }

    const remove=new Set(),now=Date.now();
    for(const list of buckets.values()){
      if(list.length<2)continue;
      const ranked=list.slice().sort((a,b)=>
        (usage.get(String(b.id))||0)-(usage.get(String(a.id))||0) ||
        dealerScore8948(b)-dealerScore8948(a) ||
        dealerStamp8948(b)-dealerStamp8948(a) ||
        String(a.id).localeCompare(String(b.id),undefined,{numeric:true})
      );
      const canonical=ranked[0];
      for(const duplicate of ranked.slice(1)){
        const dupId=String(duplicate.id),canonicalId=String(canonical.id);
        mergeDealerFields8948(canonical,duplicate);
        s.dealerAliases[dupId]=canonicalId;
        s.deletedDealers[dupId]=Math.max(Number(s.deletedDealers[dupId]||0),now);
        remove.add(dupId);
      }
    }

    // Collapse alias chains and relink every operation to the surviving card.
    for(const k of Object.keys(s.dealerAliases)){
      const target=resolveAlias8948(s.dealerAliases,k);
      if(!target||target===k)delete s.dealerAliases[k];
      else s.dealerAliases[k]=target;
    }
    for(const op of s.ops){
      if(!op||op.dealerId==null)continue;
      const target=resolveAlias8948(s.dealerAliases,op.dealerId);
      if(target&&target!==String(op.dealerId)){op.dealerId=/^\d+$/.test(target)?Number(target):target;relinked++}
    }
    if(remove.size)s.dealers=s.dealers.filter(d=>d&&!remove.has(String(d.id)));
    return {changed:remove.size>0||relinked>0,removed:remove.size,relinked,aliases:{...s.dealerAliases}};
  }

  const previousMergeDealerDedupe8948=typeof mergeSyncState==='function'?mergeSyncState:null;
  if(previousMergeDealerDedupe8948&&!previousMergeDealerDedupe8948.__dealerDedupe8948){
    const mergedWithDealerDedupe8948=function(remote,local){
      remote=typeof norm==='function'?norm(remote||{}):(remote||{});
      local=typeof norm==='function'?norm(local||{}):(local||{});
      const aliases=mergeAliases8948(remote.dealerAliases,local.dealerAliases);
      remote.dealerAliases=aliases;local.dealerAliases=aliases;
      for(const s of [remote,local]){
        s.ops=Array.isArray(s.ops)?s.ops:[];
        for(const op of s.ops){
          if(!op||op.dealerId==null)continue;
          const target=resolveAlias8948(aliases,op.dealerId);
          if(target&&target!==String(op.dealerId))op.dealerId=/^\d+$/.test(target)?Number(target):target;
        }
      }
      let merged=previousMergeDealerDedupe8948(remote,local);
      merged=typeof norm==='function'?norm(merged||{}):(merged||{});
      merged.dealerAliases=mergeAliases8948(aliases,merged.dealerAliases);
      canonicalizeDealerDuplicates8948(merged);
      return merged;
    };
    mergedWithDealerDedupe8948.__dealerDedupe8948=true;
    mergedWithDealerDedupe8948.__baseMergeDealerDedupe8948=previousMergeDealerDedupe8948;
    window.mergeSyncState=mergedWithDealerDedupe8948;
    try{mergeSyncState=mergedWithDealerDedupe8948}catch(_){}
  }

  // Manual creation also refuses an exact name+phone duplicate.
  const previousAddDealer8948=typeof addDealer==='function'?addDealer:null;
  if(previousAddDealer8948&&!previousAddDealer8948.__dealerDedupe8948){
    const addDealer8948=function(){
      const name=String(document.getElementById('dname')?.value||'').trim();
      const phone=String(document.getElementById('dphone')?.value||'').trim();
      const key=dealerKey8948({name,phone});
      const existing=key?(state.dealers||[]).find(d=>dealerKey8948(d)===key):null;
      if(existing){
        const city=String(document.getElementById('dcity')?.value||'').trim();
        const note=String(document.getElementById('dnote')?.value||'').trim();
        if(!existing.city&&city)existing.city=city;
        if(!existing.note&&note)existing.note=note;
        existing.updatedAt=Date.now();
        for(const id of ['dname','dphone','dcity','dnote']){const el=document.getElementById(id);if(el)el.value=''}
        try{if(typeof toggleNewDealerForm==='function')toggleNewDealerForm(false)}catch(_){}
        try{save()}catch(_){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(__){}}
        try{alert('Такой дилер с этим именем и телефоном уже есть. Повторная карточка не создана.')}catch(_){}
        return existing;
      }
      const out=previousAddDealer8948.apply(this,arguments);
      const r=canonicalizeDealerDuplicates8948(state);
      if(r.changed)try{save()}catch(_){}
      return out;
    };
    addDealer8948.__dealerDedupe8948=true;
    window.addDealer=addDealer8948;
    try{addDealer=addDealer8948}catch(_){}
  }

  const previousSaveDealerEdit8948=typeof saveDealerEdit==='function'?saveDealerEdit:null;
  if(previousSaveDealerEdit8948&&!previousSaveDealerEdit8948.__dealerDedupe8948){
    const saveDealerEdit8948=function(id){
      const out=previousSaveDealerEdit8948.apply(this,arguments);
      const r=canonicalizeDealerDuplicates8948(state);
      if(r.changed){
        try{localStorage.setItem(KEY,JSON.stringify(state));render()}catch(_){}
        try{if(state.sync?.enabled&&typeof syncPush==='function')setTimeout(()=>syncPush(false),80)}catch(_){}
      }
      return out;
    };
    saveDealerEdit8948.__dealerDedupe8948=true;
    window.saveDealerEdit=saveDealerEdit8948;
    try{saveDealerEdit=saveDealerEdit8948}catch(_){}
  }

  // Clean existing triplicates on the first launch of 8.9.48 and push the
  // canonical list back to the common server.
  setTimeout(()=>{
    try{
      const r=canonicalizeDealerDuplicates8948(state);
      if(r.changed){
        localStorage.setItem(KEY,JSON.stringify(state));
        if(typeof render==='function')render();
        if(state.sync?.enabled&&state.sync?.url&&typeof syncPush==='function')setTimeout(()=>syncPush(true),120);
      }
    }catch(e){console.error('8.9.48 dealer dedupe error',e)}
  },250);

  window.__next8948={compactMaterialName:compactMaterialName8948,enhanceProductRows:enhanceProductRows8948,canonicalizeDealerDuplicates:canonicalizeDealerDuplicates8948,dealerKey:dealerKey8948};
  document.documentElement.dataset.nextRelease='8.9.48';
})();

