(()=>{
  'use strict';
  if(window.__release8962Installed)return;
  window.__release8962Installed=true;

  const h=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rubText=v=>(Number(v)||0).toLocaleString('ru-RU',{maximumFractionDigits:2})+' ₽';
  const rubHtml=v=>h((Number(v)||0).toLocaleString('ru-RU',{maximumFractionDigits:2}))+'&nbsp;₽';

  /* 1. WhatsApp JPEG: amount and ruble sign always stay on one line. */
  function cleanItemName8962(value){
    return String(value??'').replace(/^\s*Потолок\s*\d+\s*(?:[·•|:;—–-]\s*)?/iu,'').trim();
  }

  function receiptImage8962(op,d){
    const rows=(op.items||[]).map((i,n)=>'<tr><td>'+(n+1)+'</td><td><b>'+h(cleanItemName8962(i.name||'Товар'))+'</b></td><td>'+h(i.qty)+' '+h(i.unit||'шт')+'</td><td class="money8962">'+rubHtml(i.price)+'</td><td class="money8962">'+rubHtml(i.total)+'</td></tr>').join('');
    return '<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0;background:#fff}body{font-family:Arial,sans-serif;color:#111;width:820px;padding:18px 20px;font-size:14px}h1{text-align:center;font-size:18px;line-height:1.15;margin:0 0 9px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:4px 14px;margin-bottom:8px}table{width:100%;border-collapse:collapse;margin-top:6px;table-layout:fixed}th,td{border:1px solid #222;padding:5px 6px;text-align:left;vertical-align:top}th{background:#f3f3f3;font-size:12px}th:nth-child(1){width:40px}th:nth-child(2){width:auto}th:nth-child(3){width:92px}th:nth-child(4){width:105px}th:nth-child(5){width:120px}.money8962{white-space:nowrap!important;word-break:keep-all!important}.total,.debt{white-space:nowrap}.total{text-align:right;font-size:17px;font-weight:700;margin-top:8px}.debt{text-align:right;margin-top:4px}.sign{display:flex;justify-content:space-between;margin-top:14px;padding-bottom:2px;font-size:12px}</style></head><body><h1>ТОВАРНАЯ НАКЛАДНАЯ № '+h(op.receiptNo)+' от '+h(op.date)+'</h1><div class="meta"><div><b>Поставщик:</b> ____________________</div><div><b>Покупатель:</b> '+h(d?.name||op.dealer||'')+'</div></div><table><thead><tr><th>№</th><th>Наименование</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead><tbody>'+rows+'</tbody></table><div class="total">Итого: '+rubHtml(op.total)+'</div><div class="debt"><b>Остаток долга:</b> '+rubHtml(typeof debtOf==='function'?debtOf(op.dealerId):0)+'</div><div class="sign"><span>Отпустил: ____________________</span><span>Получил: ____________________</span></div></body></html>';
  }

  window.sendWhatsApp=async id=>{
    const op=(state.ops||[]).find(x=>String(x.id)===String(id)&&x.type==='sale');
    const d=op&&(state.dealers||[]).find(x=>String(x.id)===String(op.dealerId));
    if(!op)return;
    if(!window.receiptAPI?.sendJpeg)return alert('Отправка JPEG доступна только в установленном приложении.');
    const r=await window.receiptAPI.sendJpeg({phone:d?.phone||'',fileName:'Товарная_накладная_'+op.receiptNo+'.jpg',html:receiptImage8962(op,d)});
    if(!r?.ok)return alert(r?.message||'Не удалось подготовить JPEG для WhatsApp');
    if(r.message)alert(r.message);
  };
  try{sendWhatsApp=window.sendWhatsApp}catch(_){}

  /* 2. NewMatRos: remove "Потолок 1 / 2 / 3 ..." from item descriptions. */
  function cleanStateObject8962(s){
    if(!s||typeof s!=='object'||!Array.isArray(s.ops))return false;
    let changed=false;
    for(const op of s.ops){
      if(!op||op.type!=='sale'||!Array.isArray(op.items))continue;
      const newMatOp=String(op.source||'').toLocaleLowerCase('ru-RU')==='newmatros';
      for(const item of op.items){
        if(!item)continue;
        const newMatItem=String(item.source||'').toLocaleLowerCase('ru-RU')==='newmatros';
        if(!newMatOp&&!newMatItem)continue;
        const next=cleanItemName8962(item.name);
        if(next&&next!==String(item.name||'')){item.name=next;changed=true;}
      }
    }
    return changed;
  }

  try{
    if(cleanStateObject8962(state)){
      localStorage.setItem(KEY,JSON.stringify(state));
      if(state.sync?.enabled&&typeof syncPush==='function')setTimeout(()=>syncPush(false),900);
    }
  }catch(e){console.error('8.9.62 NewMatRos description cleanup',e)}

  const baseNmBuildItems8962=typeof nmBuildItems==='function'?nmBuildItems:window.nmBuildItems;
  if(typeof baseNmBuildItems8962==='function'&&!baseNmBuildItems8962.__clean8962){
    const wrappedNmBuildItems8962=function(data){
      const items=baseNmBuildItems8962.apply(this,arguments)||[];
      for(const item of items){if(item&&String(item.source||'').toLocaleLowerCase('ru-RU')==='newmatros')item.name=cleanItemName8962(item.name);}
      return items;
    };
    wrappedNmBuildItems8962.__clean8962=true;
    window.nmBuildItems=wrappedNmBuildItems8962;
    try{nmBuildItems=wrappedNmBuildItems8962}catch(_){}
  }

  const baseMergeSync8962=typeof mergeSyncState==='function'?mergeSyncState:window.mergeSyncState;
  if(typeof baseMergeSync8962==='function'&&!baseMergeSync8962.__clean8962){
    const wrappedMerge8962=function(remote,local){const merged=baseMergeSync8962.apply(this,arguments);cleanStateObject8962(merged);return merged;};
    Object.assign(wrappedMerge8962,baseMergeSync8962);
    wrappedMerge8962.__clean8962=true;
    window.mergeSyncState=wrappedMerge8962;
    try{mergeSyncState=wrappedMerge8962}catch(_){}
  }

  /* 3. Debts table: keep one "Внести оплату" action and remove duplicate "Оплата" column. */
  function fixDebtPaymentDuplicate8962(){
    const table=document.querySelector('#debts table');if(!table)return;
    const heads=[...table.querySelectorAll('thead th')];
    const actionIndex=heads.findIndex(th=>th.textContent.trim().toLocaleLowerCase('ru-RU')==='действие');
    if(actionIndex<0)return;
    const duplicateIndexes=heads.map((th,i)=>({i,text:th.textContent.trim().toLocaleLowerCase('ru-RU')})).filter(x=>x.i!==actionIndex&&x.text==='оплата').map(x=>x.i).sort((a,b)=>b-a);
    for(const idx of duplicateIndexes){
      table.querySelectorAll('tr').forEach(row=>{const cell=row.children[idx];if(cell)cell.remove();});
    }
  }

  const baseRenderDebts8962=typeof renderDebts==='function'?renderDebts:window.renderDebts;
  if(typeof baseRenderDebts8962==='function'&&!baseRenderDebts8962.__paymentCleanup8962){
    const wrappedRenderDebts8962=function(){const out=baseRenderDebts8962.apply(this,arguments);fixDebtPaymentDuplicate8962();return out;};
    wrappedRenderDebts8962.__paymentCleanup8962=true;
    window.renderDebts=wrappedRenderDebts8962;
    try{renderDebts=wrappedRenderDebts8962}catch(_){}
  }
  const debtsRoot8962=document.getElementById('debts');
  if(debtsRoot8962)new MutationObserver(fixDebtPaymentDuplicate8962).observe(debtsRoot8962,{childList:true,subtree:true});
  fixDebtPaymentDuplicate8962();

  /* 4. Dedicated price-list section with search, group filter and both sale prices. */
  function ensurePriceList8962(){
    if(document.getElementById('pricelist8962'))return;
    const productsButton=document.querySelector('nav button[data-section="products"]');
    if(productsButton&&!document.querySelector('nav button[data-section="pricelist"]')){
      const button=document.createElement('button');
      button.dataset.section='pricelist';
      button.setAttribute('onclick',"show('pricelist8962',this)");
      button.innerHTML='<span class="navIcon"><svg viewBox="0 0 24 24"><path d="M5 5h14v14H5z"/><path d="M8 9h8M8 13h8M8 17h5"/></svg></span>Прайс';
      productsButton.insertAdjacentElement('afterend',button);
    }
    const main=document.querySelector('main');if(!main)return;
    const section=document.createElement('section');section.id='pricelist8962';section.className='hidden';
    section.innerHTML='<h2>Прайс</h2><p class="sectionHint">Актуальные розничные и оптовые цены из карточек товаров.</p><div class="card priceToolbar8962 noPrint8962"><input id="priceSearch8962" class="search" placeholder="Поиск товара или группы"><select id="priceGroup8962"><option value="">Все группы</option></select><button class="secondary" type="button" onclick="copyPriceList8962()">Скопировать прайс</button><button class="primary" type="button" onclick="printPriceList8962()">Печать прайса</button></div><div class="priceMeta8962"><b id="priceCount8962">0 товаров</b><span class="muted">Цены берутся из раздела «Товары»</span></div><div class="tableWrap"><table class="priceTable8962"><thead><tr><th>Группа</th><th>Товар</th><th>Ед.</th><th>Розничная цена</th><th>Оптовая цена</th></tr></thead><tbody id="priceRows8962"></tbody></table></div>';
    const groups=document.getElementById('groups');
    if(groups)main.insertBefore(section,groups);else main.appendChild(section);
    section.querySelector('#priceSearch8962')?.addEventListener('input',renderPriceList8962);
    section.querySelector('#priceGroup8962')?.addEventListener('change',renderPriceList8962);
  }

  function priceRows8962(){
    const query=(document.getElementById('priceSearch8962')?.value||'').trim().toLocaleLowerCase('ru-RU');
    const groupId=document.getElementById('priceGroup8962')?.value||'';
    return (state.products||[]).filter(p=>p&&!p.archived).filter(p=>{
      const g=(state.groups||[]).find(x=>String(x.id)===String(p.groupId));
      if(groupId&&String(p.groupId)!==String(groupId))return false;
      return !query||(String(p.name||'')+' '+String(p.article||'')+' '+String(g?.name||'')).toLocaleLowerCase('ru-RU').includes(query);
    }).sort((a,b)=>{
      const ga=(state.groups||[]).find(x=>String(x.id)===String(a.groupId))?.name||'';
      const gb=(state.groups||[]).find(x=>String(x.id)===String(b.groupId))?.name||'';
      return ga.localeCompare(gb,'ru',{numeric:true,sensitivity:'base'})||String(a.name||'').localeCompare(String(b.name||''),'ru',{numeric:true,sensitivity:'base'});
    });
  }

  function renderPriceList8962(){
    ensurePriceList8962();
    const select=document.getElementById('priceGroup8962');
    if(select){
      const current=select.value;
      select.innerHTML='<option value="">Все группы</option>'+(state.groups||[]).slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'ru')).map(g=>'<option value="'+h(g.id)+'">'+h(g.name||'Без группы')+'</option>').join('');
      if([...select.options].some(o=>o.value===current))select.value=current;
    }
    const list=priceRows8962();
    const body=document.getElementById('priceRows8962');
    if(body)body.innerHTML=list.map(p=>{const g=(state.groups||[]).find(x=>String(x.id)===String(p.groupId));return '<tr><td>'+h(g?.name||'Без группы')+'</td><td><b>'+h(p.name||'')+'</b>'+(p.article?'<br><span class="muted">'+h(p.article)+'</span>':'')+'</td><td>'+h(p.unit||'шт')+'</td><td class="priceMoney8962">'+rubHtml(p.retailPrice)+'</td><td class="priceMoney8962">'+rubHtml(p.wholesalePrice)+'</td></tr>';}).join('')||'<tr><td colspan="5" class="muted">Товары не найдены.</td></tr>';
    const count=document.getElementById('priceCount8962');if(count)count.textContent=list.length+' '+(list.length===1?'товар':list.length>=2&&list.length<=4?'товара':'товаров');
  }

  window.copyPriceList8962=async()=>{
    const lines=['ПРАЙС','Группа | Товар | Ед. | Розница | Опт'];
    for(const p of priceRows8962()){
      const g=(state.groups||[]).find(x=>String(x.id)===String(p.groupId));
      lines.push([g?.name||'Без группы',p.name||'',p.unit||'шт',rubText(p.retailPrice),rubText(p.wholesalePrice)].join(' | '));
    }
    const text=lines.join('\n');
    try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);alert('Прайс скопирован.');return;}}catch(_){}
    const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();const ok=document.execCommand('copy');ta.remove();alert(ok?'Прайс скопирован.':'Не удалось скопировать прайс.');
  };

  window.printPriceList8962=()=>{
    document.body.classList.add('pricePrint8962');
    const done=()=>document.body.classList.remove('pricePrint8962');
    window.addEventListener('afterprint',done,{once:true});
    window.print();setTimeout(done,1500);
  };

  ensurePriceList8962();
  renderPriceList8962();

  const baseShow8962=typeof show==='function'?show:window.show;
  if(typeof baseShow8962==='function'&&!baseShow8962.__price8962){
    const wrappedShow8962=function(id,b){const out=baseShow8962.apply(this,arguments);if(id==='pricelist8962')renderPriceList8962();return out;};
    wrappedShow8962.__price8962=true;window.show=wrappedShow8962;try{show=wrappedShow8962}catch(_){}
  }

  const style=document.createElement('style');style.id='release8962Style';style.textContent=`
    @media screen {
      html nav button[data-section="pricelist"].active{background:#315f9f!important;color:#fff!important;border-color:#254d85!important}
      html .priceToolbar8962{display:grid;grid-template-columns:minmax(260px,1fr) minmax(180px,260px) auto auto;gap:9px;align-items:center;margin-bottom:10px;padding:12px!important}
      html .priceToolbar8962 .search{margin:0!important;max-width:none!important}
      html .priceMeta8962{display:flex;justify-content:space-between;gap:12px;align-items:center;margin:8px 2px 10px}
      html .priceTable8962 th,html .priceTable8962 td{padding:7px 9px!important;line-height:1.25!important}
      html .priceTable8962 th:nth-child(1){width:20%}html .priceTable8962 th:nth-child(2){width:auto}html .priceTable8962 th:nth-child(3){width:80px}html .priceTable8962 th:nth-child(4),html .priceTable8962 th:nth-child(5){width:130px}
      html .priceMoney8962{white-space:nowrap!important;text-align:right!important;font-weight:700}
      @media(max-width:1100px){html .priceToolbar8962{grid-template-columns:1fr 1fr}html .priceToolbar8962 button{width:100%}}
    }
    @media print {
      body.pricePrint8962 *{visibility:hidden!important}
      body.pricePrint8962 #pricelist8962,body.pricePrint8962 #pricelist8962 *{visibility:visible!important}
      body.pricePrint8962 #pricelist8962{display:block!important;position:absolute!important;left:0!important;top:0!important;width:100%!important;margin:0!important;padding:0!important}
      body.pricePrint8962 #pricelist8962 .noPrint8962{display:none!important}
      body.pricePrint8962 #pricelist8962 .tableWrap{overflow:visible!important}
      body.pricePrint8962 #pricelist8962 table{font-size:11px!important}
    }
  `;(document.head||document.documentElement).appendChild(style);

  document.documentElement.dataset.interfaceVersion='8.9.62';
  document.documentElement.dataset.uchetRuntime='8.9.62';
})();
