(()=>{
  'use strict';
  if(window.__release8967Installed)return;
  window.__release8967Installed=true;

  const h=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rub=v=>typeof money==='function'?money(v):(Number(v||0).toLocaleString('ru-RU',{maximumFractionDigits:2})+' ₽');
  const byId=id=>(state.ops||[]).find(x=>String(x.id)===String(id));
  const dealerById=id=>(state.dealers||[]).find(x=>String(x.id)===String(id));
  const opTime8967=o=>{try{return typeof opTime==='function'?opTime(o):(Number(o?.ts)||Number(o?.id)||0)}catch(_){return Number(o?.ts)||Number(o?.id)||0}};

  /* История: сначала дилеры, затем только накладные выбранного дилера. */
  let historyDealer8967=null;
  function historySales8967(dealerId){
    return (state.ops||[]).filter(o=>o&&o.type==='sale'&&(dealerId==null||String(o.dealerId)===String(dealerId))).slice().sort((a,b)=>opTime8967(b)-opTime8967(a));
  }
  function historySetup8967(){
    const root=document.getElementById('history');if(!root)return null;
    const table=root.querySelector('table.historyGrid');if(!table)return null;
    let bar=document.getElementById('historyTrail8967');
    if(!bar){
      bar=document.createElement('div');bar.id='historyTrail8967';bar.className='historyTrail8967';
      table.parentNode.insertBefore(bar,table);
    }
    const hint=root.querySelector('.sectionHint');if(hint)hint.textContent='Сначала выбери дилера. Двойной клик откроет только его накладные.';
    return {root,table,bar};
  }
  function renderHistoryDealers8967(){
    historyDealer8967=null;
    const ui=historySetup8967();if(!ui)return;
    ui.bar.innerHTML='<b>Дилеры с накладными</b><span class="muted">Двойной клик — открыть документы дилера</span>';
    const head=ui.table.querySelector('thead tr');if(head)head.innerHTML='<th>Дилер</th><th>Телефон</th><th>Накладных</th><th>Последняя накладная</th><th>Текущий долг</th>';
    const sales=historySales8967(),counts=new Map(),last=new Map();
    for(const op of sales){
      const k=String(op.dealerId);counts.set(k,(counts.get(k)||0)+1);
      if(!last.has(k))last.set(k,op);
    }
    const dealers=(state.dealers||[]).filter(d=>counts.has(String(d.id))).slice().sort((a,b)=>{
      const ta=opTime8967(last.get(String(a.id))),tb=opTime8967(last.get(String(b.id)));
      return tb-ta||String(a.name||'').localeCompare(String(b.name||''),'ru');
    });
    const body=document.getElementById('historyRows');
    if(body)body.innerHTML=dealers.map(d=>{
      const l=last.get(String(d.id));
      return '<tr class="clickable historyDealerRow8967" tabindex="0" ondblclick="openHistoryDealer8967('+Number(d.id)+')" onkeydown="if(event.key===&quot;Enter&quot;)openHistoryDealer8967('+Number(d.id)+')"><td>'+h(d.name||'')+'</td><td>'+h(d.phone||'')+'</td><td>'+counts.get(String(d.id))+'</td><td>'+h(l?.date||'—')+'</td><td class="'+((+debtOf(d.id)||0)>0?'danger':'ok')+'">'+rub(debtOf(d.id))+'</td></tr>';
    }).join('');
  }
  function renderHistoryDealerReceipts8967(dealerId){
    const d=dealerById(dealerId),ui=historySetup8967();if(!d||!ui)return renderHistoryDealers8967();
    historyDealer8967=d.id;
    ui.bar.innerHTML='<div><button class="secondary miniBtn" type="button" onclick="backHistoryDealers8967()">← К списку дилеров</button><b>'+h(d.name||'')+'</b></div><span class="muted">Двойной клик по накладной — открыть готовый чек</span>';
    const head=ui.table.querySelector('thead tr');if(head)head.innerHTML='<th>Дата</th><th>Накладная</th><th>Позиций</th><th>Сумма</th><th>Действие</th>';
    const body=document.getElementById('historyRows'),sales=historySales8967(d.id);
    if(body)body.innerHTML=sales.map(o=>'<tr class="clickable historyReceiptRow8967" tabindex="0" ondblclick="showReceiptFromHistory('+Number(o.id)+')" onkeydown="if(event.key===&quot;Enter&quot;)showReceiptFromHistory('+Number(o.id)+')"><td>'+h(o.date||'')+'</td><td>Накладная № '+h(o.receiptNo||'')+'</td><td>'+((o.items||[]).length)+'</td><td>'+rub(o.total)+'</td><td><button class="secondary miniBtn" type="button" onclick="event.stopPropagation();showReceiptFromHistory('+Number(o.id)+')">Открыть чек</button></td></tr>').join('');
  }
  window.openHistoryDealer8967=id=>renderHistoryDealerReceipts8967(id);
  window.backHistoryDealers8967=()=>renderHistoryDealers8967();
  window.renderHistory=()=>historyDealer8967==null?renderHistoryDealers8967():renderHistoryDealerReceipts8967(historyDealer8967);
  try{renderHistory=window.renderHistory}catch(_){}
  const historySort=document.getElementById('historySort');if(historySort)historySort.onchange=()=>window.renderHistory();

  /* Компактная таблица долгов с одной строкой на дилера. */
  const priorRenderDebts8967=typeof renderDebts==='function'?renderDebts:window.renderDebts;
  window.renderDebts=function(){
    const q=(document.getElementById('debtSearch')?.value||'').toLocaleLowerCase('ru');
    let arr=(state.dealers||[]).filter(d=>(String(d.name||'')+' '+String(d.phone||'')).toLocaleLowerCase('ru').includes(q));
    arr=typeof sortDealers==='function'?sortDealers(arr,document.getElementById('debtSort')?.value||'recent'):arr;
    const body=document.getElementById('debtRows');
    if(body)body.innerHTML=arr.map(d=>{
      const pays=(state.ops||[]).filter(o=>String(o.dealerId)===String(d.id)&&o.type==='payment').sort((a,b)=>opTime8967(b)-opTime8967(a));
      const debt=+debtOf(d.id)||0;
      return '<tr class="clickable debtRow8967" tabindex="0" onclick="openDealer('+Number(d.id)+')"><td><span class="debtDealerName8967">'+h(d.name||'')+'</span><span class="debtDealerPhone8967">'+h(d.phone||'')+'</span></td><td>'+rub(salesOf(d.id))+'</td><td class="ok">'+rub(paidOf(d.id))+'</td><td class="'+(debt>0?'danger':'ok')+'">'+rub(debt)+'</td><td>'+(pays[0]?h(pays[0].date||''):'—')+'</td><td><button class="primary miniBtn debtPayBtn8951" type="button" onclick="event.stopPropagation();openDebtPayment8967('+Number(d.id)+')">Внести оплату</button></td></tr>';
    }).join('');
    if(typeof priorRenderDebts8967==='function'&&document.getElementById('debtAll8951')){
      const all=(state.dealers||[]).length,withDebt=(state.dealers||[]).filter(d=>debtOf(d.id)>0),total=withDebt.reduce((s,d)=>s+debtOf(d.id),0),paid=(state.dealers||[]).reduce((s,d)=>s+paidOf(d.id),0);
      const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
      set('debtAll8951',all);set('debtTotal8951',rub(total));set('debtCount8951',withDebt.length);set('debtPaid8951',rub(paid));set('debtUpdatedAt8951',new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}));
    }
  };
  try{renderDebts=window.renderDebts}catch(_){}
  window.openDebtPayment8967=id=>{
    try{if(typeof closeDealerModal==='function')closeDealerModal()}catch(_){}
    if(typeof go==='function')go('payments');
    setTimeout(()=>{try{if(typeof selectPayDealer==='function')selectPayDealer(id)}catch(_){}},0);
  };

  /* Правый клик по каждой операции в карточке дилера. */
  function dealerHistoryRows8967(ops,d){
    return (ops||[]).map(o=>{
      const common=' data-document-row="true" data-op-id="'+h(o.id)+'" data-op-type="'+h(o.type||'')+'" oncontextmenu="showDealerOpMenu8967(event,'+Number(o.id)+','+Number(d.id)+')"';
      if(o.type==='sale')return '<tr class="clickable"'+common+' ondblclick="showReceiptFromHistory('+Number(o.id)+')"><td>'+h(o.date||'')+'</td><td>Накладная № '+h(o.receiptNo||'')+'</td><td>'+((o.items||[]).length)+' поз.</td><td>'+rub(o.total)+'</td><td><button class="secondary miniBtn" type="button" onclick="showReceiptFromHistory('+Number(o.id)+')">Открыть чек</button></td></tr>';
      if(o.type==='payment')return '<tr'+common+'><td>'+h(o.date||'')+'</td><td>Оплата</td><td>'+h(o.method||'Оплата')+(o.note?' · '+h(o.note):'')+'</td><td>'+rub(o.total)+'</td><td><button class="secondary miniBtn" type="button" onclick="showDebtReport('+Number(d.id)+','+Number(o.id)+')">Отчёт по долгу</button></td></tr>';
      if(o.type==='initial_debt')return '<tr'+common+'><td>'+h(o.date||'')+'</td><td>Начальный долг</td><td>'+h(o.note||'Перенесено из прежнего учёта')+'</td><td>'+rub(o.total)+'</td><td></td></tr>';
      return '<tr'+common+'><td>'+h(o.date||'')+'</td><td>'+h(o.type||'Операция')+'</td><td>'+h(o.note||'')+'</td><td>'+rub(o.total)+'</td><td></td></tr>';
    }).join('');
  }
  window.dealerHistoryRows=dealerHistoryRows8967;
  try{dealerHistoryRows=dealerHistoryRows8967}catch(_){}

  const closeOpMenu8967=()=>document.getElementById('dealerOpMenu8967')?.remove();
  async function copyOp8967(op){
    const d=dealerById(op?.dealerId);
    const text=[d?.name||op?.dealer||'',op?.date||'',op?.type==='sale'?'Накладная № '+(op.receiptNo||''):op?.type==='payment'?'Оплата':'Начальный долг',rub(op?.total||0)].filter(Boolean).join(' | ');
    try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return true}}catch(_){}
    return false;
  }
  function editReceipt8967(id){
    if(typeof showReceiptFromHistory==='function')showReceiptFromHistory(id);
    setTimeout(()=>document.querySelector('#receiptViewBody .receiptEditInput')?.focus(),0);
  }
  function ensureOpEditModal8967(){
    let modal=document.getElementById('opEditModal8967');if(modal)return modal;
    modal=document.createElement('div');modal.id='opEditModal8967';modal.className='modal hidden';
    modal.innerHTML='<div class="modalBox opEditBox8967"><div class="actions" style="justify-content:space-between"><h2 id="opEditTitle8967">Изменить операцию</h2><button class="secondary" type="button" onclick="closeOpEdit8967()">Закрыть</button></div><input type="hidden" id="opEditId8967"><label>Сумма, ₽<input id="opEditAmount8967" type="number" min="0.01" step="0.01"></label><label id="opEditMethodWrap8967">Способ оплаты<select id="opEditMethod8967"><option value="Наличные">Наличные</option><option value="Перевод">Перевод</option></select></label><label>Примечание<input id="opEditNote8967"></label><div class="actions" style="justify-content:flex-end;margin-top:16px"><button class="secondary" type="button" onclick="closeOpEdit8967()">Отмена</button><button class="primary" type="button" onclick="saveOpEdit8967()">Сохранить изменения</button></div></div>';
    document.body.appendChild(modal);return modal;
  }
  function recalcPaymentSnapshots8967(dealerId){
    let balance=0;
    (state.ops||[]).filter(o=>String(o.dealerId)===String(dealerId)).slice().sort((a,b)=>opTime8967(a)-opTime8967(b)).forEach(o=>{
      if(o.type==='sale'||o.type==='initial_debt')balance+=+o.total||0;
      else if(o.type==='payment'){o.beforeDebt=balance;balance-=+o.total||0;o.afterDebt=balance;}
    });
  }
  window.editOp8967=id=>{
    const op=byId(id);if(!op||!['payment','initial_debt'].includes(op.type))return;
    const modal=ensureOpEditModal8967();
    document.getElementById('opEditId8967').value=String(op.id);
    document.getElementById('opEditTitle8967').textContent=op.type==='payment'?'Изменить оплату':'Изменить начальный долг';
    document.getElementById('opEditAmount8967').value=+op.total||0;
    document.getElementById('opEditNote8967').value=op.note||'';
    document.getElementById('opEditMethodWrap8967').classList.toggle('hidden',op.type!=='payment');
    if(op.type==='payment')document.getElementById('opEditMethod8967').value=op.method||'Наличные';
    modal.classList.remove('hidden');
    setTimeout(()=>document.getElementById('opEditAmount8967')?.focus(),0);
  };
  window.closeOpEdit8967=()=>document.getElementById('opEditModal8967')?.classList.add('hidden');
  window.saveOpEdit8967=()=>{
    const op=byId(document.getElementById('opEditId8967')?.value);if(!op)return;
    const amount=Number(String(document.getElementById('opEditAmount8967')?.value||'').replace(',','.'));
    if(!Number.isFinite(amount)||amount<=0)return alert('Укажи сумму больше 0');
    op.total=amount;op.note=document.getElementById('opEditNote8967')?.value.trim()||'';
    if(op.type==='payment')op.method=document.getElementById('opEditMethod8967')?.value||'Наличные';
    recalcPaymentSnapshots8967(op.dealerId);
    if(typeof save==='function')save();
    window.closeOpEdit8967();
    if(typeof openDealer==='function')openDealer(op.dealerId);
  };
  window.deletePayment8967=id=>{
    const op=byId(id);if(!op||op.type!=='payment')return;
    if(!confirm('Удалить эту оплату? Долг дилера будет пересчитан.'))return;
    const dealerId=op.dealerId;
    state.ops=(state.ops||[]).filter(x=>String(x.id)!==String(id));
    recalcPaymentSnapshots8967(dealerId);
    if(typeof save==='function')save();
    if(typeof openDealer==='function')openDealer(dealerId);
  };
  window.showDealerOpMenu8967=(e,opId,dealerId)=>{
    e.preventDefault();e.stopPropagation();closeOpMenu8967();
    const op=byId(opId);if(!op)return;
    const menu=document.createElement('div');menu.id='dealerOpMenu8967';menu.className='dealerOpMenu8967';
    menu.style.left=Math.min(e.clientX,window.innerWidth-260)+'px';menu.style.top=Math.min(e.clientY,window.innerHeight-260)+'px';
    const add=(label,fn,cls)=>{const b=document.createElement('button');b.type='button';b.textContent=label;if(cls)b.className=cls;b.onclick=()=>{closeOpMenu8967();fn()};menu.appendChild(b)};
    if(op.type==='sale'){
      add('Открыть чек',()=>showReceiptFromHistory(op.id));
      add('Изменить чек',()=>editReceipt8967(op.id));
      add('Добавить товар',()=>typeof openReceiptAdd==='function'&&openReceiptAdd(op.id));
      add('Скопировать',async()=>{if(!await copyOp8967(op))alert('Не удалось скопировать.')});
      add('Удалить чек',()=>typeof archiveReceipt==='function'&&archiveReceipt(op.id),'dangerMenuItem');
    }else if(op.type==='payment'){
      add('Изменить оплату',()=>window.editOp8967(op.id));
      add('Удалить оплату',()=>window.deletePayment8967(op.id),'dangerMenuItem');
    }else if(op.type==='initial_debt'){
      add('Изменить начальный долг',()=>window.editOp8967(op.id));
    }
    if(menu.children.length)document.body.appendChild(menu);
  };
  document.addEventListener('click',closeOpMenu8967);window.addEventListener('blur',closeOpMenu8967);

  /* В карточке дилера рядом с начальным долгом добавляем быструю оплату. */
  const priorOpenDealer8967=typeof openDealer==='function'?openDealer:window.openDealer;
  if(typeof priorOpenDealer8967==='function'){
    window.openDealer=function(id){
      const out=priorOpenDealer8967.apply(this,arguments);
      const initial=document.querySelector('#dealerModalBody .initialDebt'),actions=initial?.closest('.actions');
      if(actions&&!actions.querySelector('.dealerPay8967')){
        const b=document.createElement('button');b.type='button';b.className='primary dealerPay8967';b.textContent='＋ Внести оплату';b.onclick=()=>window.openDebtPayment8967(id);actions.appendChild(b);
      }
      return out;
    };
    try{openDealer=window.openDealer}catch(_){}
  }

  /* После продажи обязательно показываем готовую накладную, даже если старый слой очистил форму. */
  const priorSaveSale8967=typeof saveSale==='function'?saveSale:window.saveSale;
  if(typeof priorSaveSale8967==='function'){
    window.saveSale=function(){
      const before=new Set((state.ops||[]).filter(o=>o.type==='sale').map(o=>String(o.id)));
      const out=priorSaveSale8967.apply(this,arguments);
      const created=(state.ops||[]).filter(o=>o.type==='sale'&&!before.has(String(o.id))).sort((a,b)=>opTime8967(b)-opTime8967(a))[0];
      if(created)setTimeout(()=>{
        if(typeof showReceiptFromHistory==='function')showReceiptFromHistory(created.id);
        const title=document.querySelector('#receiptViewModal .modalBox>.actions:first-child h2');if(title)title.textContent='Готовая накладная';
        decorateReceiptActions8967(document.getElementById('receiptViewBody'));
      },0);
      return out;
    };
    try{saveSale=window.saveSale}catch(_){}
  }

  /* WhatsApp: JPEG без строки "Остаток долга". */
  const rubHtml8967=v=>h((Number(v)||0).toLocaleString('ru-RU',{maximumFractionDigits:2}))+'&nbsp;₽';
  function whatsappReceipt8967(op,d){
    const rows=(op.items||[]).map((i,n)=>'<tr><td>'+(n+1)+'</td><td>'+h(i.name||'Товар')+'</td><td>'+h(i.qty)+' '+h(i.unit||'шт')+'</td><td class="m">'+rubHtml8967(i.price)+'</td><td class="m">'+rubHtml8967(i.total)+'</td></tr>').join('');
    return '<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0;background:#fff}body{font-family:Arial,sans-serif;color:#111;width:820px;padding:18px 20px;font-size:14px}h1{text-align:center;font-size:18px;margin:0 0 9px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:4px 14px;margin-bottom:10px;font-size:13px}table{width:100%;border-collapse:collapse;table-layout:fixed;border:2px solid #111}th,td{border:1px solid #444;padding:6px 7px}th{background:#e9edf2;font-size:12px}th:nth-child(1){width:40px}th:nth-child(3){width:92px}th:nth-child(4){width:105px}th:nth-child(5){width:120px}.m{white-space:nowrap;text-align:right}.total{text-align:right;font-size:17px;font-weight:700;margin-top:10px;padding-top:8px;border-top:2px solid #111}.sign{display:flex;justify-content:space-between;margin-top:16px;padding-top:10px;border-top:1px solid #888;font-size:12px}</style></head><body><h1>ТОВАРНАЯ НАКЛАДНАЯ № '+h(op.receiptNo)+' от '+h(op.date)+'</h1><div class="meta"><div><b>Поставщик:</b> ____________________</div><div><b>Покупатель:</b> '+h(d?.name||op.dealer||'')+'</div></div><table><thead><tr><th>№</th><th>Наименование</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead><tbody>'+rows+'</tbody></table><div class="total">Итого: '+rubHtml8967(op.total)+'</div><div class="sign"><span>Отпустил: ____________________</span><span>Получил: ____________________</span></div></body></html>';
  }
  window.buildReceiptImage8967=whatsappReceipt8967;
  window.sendWhatsApp=async id=>{
    const op=byId(id),d=op&&dealerById(op.dealerId);if(!op||op.type!=='sale')return;
    if(!window.receiptAPI?.sendJpeg)return alert('Отправка JPEG доступна только в установленном приложении.');
    const r=await window.receiptAPI.sendJpeg({phone:d?.phone||'',fileName:'Товарная_накладная_'+op.receiptNo+'.jpg',html:whatsappReceipt8967(op,d)});
    if(!r?.ok)return alert(r?.message||'Не удалось подготовить JPEG для WhatsApp');
    if(r.message)alert(r.message);
  };
  try{sendWhatsApp=window.sendWhatsApp}catch(_){}

  /* Согласованная кнопка: вместо скачивания накладной отправляем текущий долг. */
  window.sendCurrentDebt8967=dealerId=>{
    if(typeof sendDebtReportWhatsApp==='function')return sendDebtReportWhatsApp(dealerId,null);
    alert('Отправка текущего долга недоступна.');
  };
  function decorateReceiptActions8967(root){
    if(!root)return;
    root.querySelectorAll('.receipt[data-receipt-op-id]').forEach(receipt=>{
      const op=byId(receipt.dataset.receiptOpId);if(!op)return;
      [...receipt.querySelectorAll('button')].forEach(b=>{
        if(b.textContent.trim()==='Скачать накладную'){
          b.textContent='Отправить текущий долг';
          b.setAttribute('onclick','sendCurrentDebt8967('+Number(op.dealerId)+')');
        }
      });
    });
  }
  for(const id of ['receiptArea','receiptViewBody']){
    const el=document.getElementById(id);if(el){new MutationObserver(()=>decorateReceiptActions8967(el)).observe(el,{childList:true,subtree:true});decorateReceiptActions8967(el);}
  }

  ensureOpEditModal8967();
  renderHistoryDealers8967();
  try{window.renderDebts()}catch(_){}
  document.documentElement.dataset.interfaceVersion='8.9.67';
  document.documentElement.dataset.uchetRuntime='8.9.67';
})();