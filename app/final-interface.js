(()=>{
  'use strict';
  if(window.finalInterfaceInstalled)return;window.finalInterfaceInstalled=true;
  const C=window.SyncCore8962,modeKey=KEY+':warehouse-enabled',el=id=>document.getElementById(id);
  const stored=localStorage.getItem(modeKey);
  let enabled=stored===null?(state.warehouseEnabled??(state.products||[]).some(p=>p.inventoryVersion===2)):stored==='true';
  window.warehouseModeEnabled=()=>enabled;
  state.warehouseEnabled=enabled;
  let knownSales=new Set((state.ops||[]).filter(o=>o.type==='sale').map(o=>String(o.id)));
  window.warehouseStampSales=()=>{
    state.warehouseEnabled=enabled;
    for(const op of state.ops||[])if(op.type==='sale'){
      if(!knownSales.has(String(op.id))&&op.inventoryTracked===undefined)op.inventoryTracked=enabled;
      knownSales.add(String(op.id));
    }
  };
  const settings=document.createElement('section');settings.id='settings';settings.className='hidden';
  settings.innerHTML='<h2>Настройки</h2><div class="card"><label class="warehouseToggle"><input id="warehouseEnabled" type="checkbox" role="switch"> Складской учёт</label><p id="warehouseModeDescription" role="status"></p></div>';
  document.querySelector('main').appendChild(settings);
  const nav=document.createElement('button');nav.dataset.section='settings';nav.textContent='Настройки';nav.onclick=()=>go('settings');document.querySelector('nav').appendChild(nav);
  function refreshMode(){
    el('warehouseEnabled').checked=enabled;
    el('warehouseModeDescription').textContent=enabled?'Включён: продажи учитываются в остатках. Доступны приход, расход, возврат и корректировка.':'Выключен: продажи сохраняются без изменения остатков и без ограничений по наличию.';
    const id=el('editProductId')?.value,p=state.products.find(p=>String(p.id)===id);
    const alreadyOpened=p&&state.ops.some(o=>o.type==='stock_opening'&&o.items?.some(i=>String(i.productId)===id));
    if(el('editPinitialStock')){el('editPinitialStock').readOnly=!enabled||!!alreadyOpened;el('editPinitialStock').title=alreadyOpened?'Начальный остаток уже введён. Для изменения используйте корректировку.':'';}
    if(el('pInitialStock'))el('pInitialStock').closest('label').hidden=!enabled;
    if(el('warehouseSave'))el('warehouseSave').hidden=!enabled;
  }
  el('warehouseEnabled').onchange=()=>{
    enabled=el('warehouseEnabled').checked;localStorage.setItem(modeKey,String(enabled));state.warehouseEnabled=enabled;
    if(enabled)C.enableInventory(state);save();refreshMode();
  };
  const previousRender=render;
  render=function(){const result=previousRender.apply(this,arguments);for(const o of state.ops||[])if(o.type==='sale')knownSales.add(String(o.id));refreshMode();return result};
  window.render=render;
  const previousEdit=editProduct;
  editProduct=function(){const result=previousEdit.apply(this,arguments);refreshMode();return result};window.editProduct=editProduct;
  document.body.classList.add('final-ui');
  const style=document.createElement('style');style.textContent=`
    body{background:#f3f5f9;color:#202b3d;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    main{padding:18px!important;gap:12px!important}section{margin:0!important;padding:0!important}h2{margin:0 0 14px!important;font-size:23px!important}h3{margin:0 0 12px!important}
    .card{padding:16px!important;margin-bottom:12px!important;border:1px solid #dce2ec!important;border-radius:12px!important;box-shadow:0 2px 8px #25375508!important}
    table th,table td{padding:8px 10px!important;vertical-align:middle!important}thead th{background:#eef2f8!important;font-size:12px!important}tbody tr:hover{background:#f1f6ff!important}
    button{min-height:34px;padding:7px 12px!important;border-radius:8px!important;font-size:13px!important}nav{gap:5px!important}nav button.active,nav button[aria-current="page"]{background:#2463d6!important;color:white!important;box-shadow:0 2px 8px #2463d633}
    input:not([type=checkbox]):not([type=radio]),select{min-height:34px;padding:7px 9px!important;border-radius:7px!important;box-sizing:border-box}input[type=checkbox]{width:18px;height:18px;accent-color:#2463d6}.form{gap:10px!important}.warehouseToggle{display:flex;align-items:center;gap:12px;font-size:17px;font-weight:600}
    .finalMenu{position:fixed;z-index:100000;min-width:220px;padding:6px;background:white;border:1px solid #dce2ec;border-radius:10px;box-shadow:0 8px 32px #172b4d25}.finalMenu button{display:block;text-align:left;background:transparent;color:#202b3d;border:0;width:100%}.finalMenu button:hover{background:#eef4ff}.finalMenu .dangerMenuItem{color:#ba2632}
    .negativeOverlay{position:fixed;inset:0;background:#172b4d66;display:grid;place-items:center;z-index:100001}.negativeDialog{background:white;padding:24px;border-radius:14px;width:min(460px,90vw);box-sizing:border-box}.negativeDialog .actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
    html body.final-ui nav button[data-section]:not(.active){background:#f4f7fc!important;color:#33465f!important;border:1px solid transparent!important;box-shadow:none!important}
    html body.final-ui nav button[data-section].active{background:#2463d6!important;color:#fff!important;border-color:#2463d6!important;box-shadow:0 3px 10px #2463d62b!important}
    html body.final-ui nav button[data-section].active .navIcon{color:#fff!important}
    html body.final-ui nav button[data-section]{min-height:34px!important;padding:7px 10px!important;margin-bottom:4px!important}
    html body.final-ui main .card{padding:14px!important;margin-bottom:12px!important}html body.final-ui main h2{font-size:23px!important;margin:0 0 12px!important}
    html body.final-ui .tableWrap{overflow:auto!important}html body.final-ui main table input{max-width:130px!important}
    html body.final-ui .sectionHint{margin:0 0 12px!important}html body.final-ui main .actions{align-items:center;gap:8px!important}
    html body.final-ui #products table.productTable{min-width:850px!important;width:100%!important}
    html body.final-ui #products table.productTable th:nth-child(1),html body.final-ui #products table.productTable td:nth-child(1){width:90px!important;min-width:70px!important}
    html body.final-ui #products table.productTable th:nth-child(2),html body.final-ui #products table.productTable td:nth-child(2){width:70px!important;min-width:60px!important}
    html body.final-ui #products table.productTable th:nth-child(3),html body.final-ui #products table.productTable td:nth-child(3){width:220px!important;min-width:180px!important}
  `;document.head.appendChild(style);
  function shortage(){
    const totals=new Map();for(const i of cart||[])totals.set(String(i.productId),(totals.get(String(i.productId))||0)+Number(i.qty));
    return [...totals].flatMap(([id,qty])=>{const p=state.products.find(p=>String(p.id)===id);return p&&qty>Number(p.stock)?[{name:p.name,available:Number(p.stock),requested:qty}]:[]});
  }
  let pending=false;const previousSale=saveSale;
  saveSale=function(){
    if(pending)return;
    const missing=enabled?shortage():[];if(!missing.length)return previousSale.apply(this,arguments);
    pending=true;const signature=JSON.stringify(cart),dealer=el('saleDealer').value;
    const overlay=document.createElement('div');overlay.className='negativeOverlay';
    const box=document.createElement('div');box.className='negativeDialog';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label','Недостаточно товара');
    const title=document.createElement('h3');title.textContent='Недостаточно товара';box.appendChild(title);
    for(const item of missing){const p=document.createElement('p');p.textContent=item.name+': в наличии '+item.available+', продажа '+item.requested+'. Остаток станет '+Number((item.available-item.requested).toFixed(6))+'.';box.appendChild(p);}
    const actions=document.createElement('div');actions.className='actions';
    const cancel=document.createElement('button');cancel.textContent='Отмена';const accept=document.createElement('button');accept.className='primary';accept.textContent='Продать в минус';
    function close(){overlay.remove();pending=false;document.removeEventListener('keydown',escape)}
    function escape(e){if(e.key==='Escape')close()}
    cancel.onclick=close;accept.onclick=()=>{close();if(!enabled||JSON.stringify(cart)!==signature||el('saleDealer').value!==dealer||JSON.stringify(shortage())!==JSON.stringify(missing))return saveSale();return previousSale()};
    actions.append(cancel,accept);box.appendChild(actions);overlay.appendChild(box);document.body.appendChild(overlay);document.addEventListener('keydown',escape);cancel.focus();
  };window.saveSale=saveSale;
  function closeMenu(){el('finalContextMenu')?.remove()}
  function menu(e,actions){e.preventDefault();e.stopImmediatePropagation();closeMenu();for(const id of ['dealerContextMenu','productContextMenu8948','dealerOpMenu8967','dealerReceiptContextMenu8946'])el(id)?.remove();const m=document.createElement('div');m.id='finalContextMenu';m.className='finalMenu';m.setAttribute('role','menu');for(const [name,action,danger,cls]of actions){const b=document.createElement('button');b.textContent=name;b.type='button';b.setAttribute('role','menuitem');if(danger)b.className='dangerMenuItem';if(cls)b.classList.add(cls);b.onclick=()=>{closeMenu();action()};m.appendChild(b)}document.body.appendChild(m);m.style.left=Math.max(4,Math.min(e.clientX,innerWidth-m.offsetWidth-4))+'px';m.style.top=Math.max(4,Math.min(e.clientY,innerHeight-m.offsetHeight-4))+'px'}
  function warehouseAction(id,type){if(!enabled){go('settings');return}go('warehouse');renderWarehouse();el('warehouseType').value=type;const row=[...el('warehouseDocumentRows').querySelectorAll('tr')].find(r=>r.dataset.productId===String(id));if(row){row.querySelector('[data-field=selected]').checked=true;row.querySelector('[data-field=qty]').focus()}}
  document.addEventListener('contextmenu',e=>{
    const row=e.target.closest('tr,[data-product-id],.choiceRow');if(!row)return;
    const product=row.dataset.productId||((row.getAttribute('onclick')||'').match(/(?:selectSaleProduct|editProduct)\((\d+)\)/)||[])[1];
    if(product)return menu(e,[['Открыть',()=>editProduct(product)],['Приход',()=>warehouseAction(product,'stock_receipt')],['Движение',()=>{go('warehouse');renderWarehouse();el('warehouseHistoryProduct').value=String(product);el('warehouseHistoryProduct').dispatchEvent(new Event('change'))}],['Корректировка',()=>warehouseAction(product,'stock_adjustment')],['Копировать',()=>navigator.clipboard.writeText(state.products.find(p=>String(p.id)===String(product))?.name||'')],['Создать копию карточки',()=>window.createProductCopy8948?.(product)],['Удалить товар',()=>delProduct(product),true]]);
    const dealer=((row.getAttribute('onclick')||'').match(/openDealer\((\d+)\)/)||[])[1];
    if(dealer){const d=state.dealers.find(d=>String(d.id)===dealer);return menu(e,[['Открыть',()=>openDealer(dealer)],['Изменить',()=>openDealerForEdit(dealer)],['Скопировать номер',()=>navigator.clipboard.writeText(d?.phone||'')],['Удалить',()=>deleteDealerFromList(dealer),true]])}
    const opAction=[row.getAttribute('onclick'),row.getAttribute('ondblclick'),...Array.from(row.querySelectorAll('button')).map(b=>b.getAttribute('onclick'))].filter(Boolean).join(' ');
    const opId=row.dataset.opId||(opAction.match(/showReceiptFromHistory\((\d+)\)/)||[])[1]||(opAction.match(/showDebtReport\(\d+,\s*(\d+)\)/)||[])[1],op=state.ops.find(o=>String(o.id)===String(opId));
    if(op?.type==='payment')return menu(e,[['Изменить',()=>window.editOp8967(op.id)],['Удалить',()=>window.deletePayment8967(op.id),true]]);
    if(op?.type==='sale')return menu(e,[['Открыть',()=>showReceiptFromHistory(op.id)],['Изменить',()=>{showReceiptFromHistory(op.id);setTimeout(()=>document.querySelector('#receiptViewBody .receiptEditInput')?.focus(),0)}],['Добавить товар',()=>window.openReceiptAdd?.(op.id)],['Внесено в журнал',()=>window.receiptJournal.set(op.id,'recorded'),false,'journalMenuRecorded'],['Не внесено в журнал',()=>window.receiptJournal.set(op.id,'unrecorded'),false,'journalMenuUnrecorded'],['Удалить',()=>archiveReceipt(op.id),true]]);
  },true);
  document.addEventListener('click',closeMenu);window.addEventListener('blur',closeMenu);document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});
  refreshMode();
})();
