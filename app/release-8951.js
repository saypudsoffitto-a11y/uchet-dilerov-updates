(()=>{
  'use strict';
  if(window.__release8951Installed)return;
  window.__release8951Installed=true;
  const h=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rub=v=>typeof money==='function'?money(v):(Number(v||0).toLocaleString('ru-RU')+' ₽');

  function compactReceiptHtml8951(op,d){
    const rows=(op.items||[]).map((i,n)=>'<tr><td>'+(n+1)+'</td><td><b>'+h(i.name||'Товар')+'</b></td><td><input class="receiptEditInput" type="number" min="0.01" step="0.01" value="'+(+i.qty||0)+'" onchange="editReceiptItem('+op.id+','+n+',&quot;qty&quot;,this.value)"> '+h(i.unit||'шт')+'</td><td><input class="receiptEditInput" type="number" min="0" step="0.01" value="'+(+i.price||0)+'" onchange="editReceiptItem('+op.id+','+n+',&quot;price&quot;,this.value)"></td><td>'+rub(i.total)+'</td></tr>').join('');
    return '<div class="receipt receipt8951" id="receiptPrint" data-receipt-op-id="'+op.id+'"><h2>ТОВАРНАЯ НАКЛАДНАЯ № '+h(op.receiptNo)+' от '+h(op.date)+'</h2><div class="meta"><div><b>Поставщик:</b> ____________________</div><div><b>Покупатель:</b> '+h(d?.name||op.dealer||'')+'</div></div><p class="receiptEditHelp">Количество и цену можно изменить прямо в накладной — сумма и долг пересчитаются автоматически.</p><table><thead><tr><th>№</th><th>Наименование</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead><tbody>'+rows+'</tbody></table><div class="total">Итого: '+rub(op.total)+'</div><p><b>Остаток долга:</b> '+rub(debtOf(op.dealerId))+'</p><div class="sign"><span>Отпустил: ____________</span><span>Получил: ____________</span></div><div class="actions"><button class="primary" onclick="printReceipt()">Распечатать</button><button class="primary" onclick="downloadReceipt('+op.id+')">Скачать накладную</button><button class="primary" onclick="sendWhatsApp('+op.id+')">Отправить в WhatsApp</button><button class="primary" type="button" onclick="openReceiptAdd('+op.id+')">Добавить товар</button><button class="dangerBtn" type="button" onclick="archiveReceipt('+op.id+')">Удалить этот чек</button></div></div>';
  }

  function compactReceiptImage8951(op,d){
    const rows=(op.items||[]).map((i,n)=>'<tr><td>'+(n+1)+'</td><td><b>'+h(i.name||'Товар')+'</b></td><td>'+h(i.qty)+' '+h(i.unit||'шт')+'</td><td>'+rub(i.price)+'</td><td>'+rub(i.total)+'</td></tr>').join('');
    return '<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0;background:#fff}body{font-family:Arial,sans-serif;color:#111;width:820px;padding:22px;font-size:14px}h1{text-align:center;font-size:19px;margin:0 0 10px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:5px 14px;margin-bottom:9px}table{width:100%;border-collapse:collapse;margin-top:7px;table-layout:fixed}th,td{border:1px solid #222;padding:5px 6px;text-align:left;vertical-align:top}th{background:#f3f3f3;font-size:12px}th:nth-child(1){width:42px}th:nth-child(2){width:auto}th:nth-child(3){width:105px}th:nth-child(4),th:nth-child(5){width:110px}.total{text-align:right;font-size:17px;font-weight:700;margin-top:9px}.debt{text-align:right;margin-top:5px}.sign{display:flex;justify-content:space-between;margin-top:17px;padding-bottom:2px;font-size:12px}</style></head><body><h1>ТОВАРНАЯ НАКЛАДНАЯ № '+h(op.receiptNo)+' от '+h(op.date)+'</h1><div class="meta"><div><b>Поставщик:</b> ____________________</div><div><b>Покупатель:</b> '+h(d?.name||op.dealer||'')+'</div></div><table><thead><tr><th>№</th><th>Наименование</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead><tbody>'+rows+'</tbody></table><div class="total">Итого: '+rub(op.total)+'</div><div class="debt"><b>Остаток долга:</b> '+rub(debtOf(op.dealerId))+'</div><div class="sign"><span>Отпустил: ____________________</span><span>Получил: ____________________</span></div></body></html>';
  }

  window.renderReceiptHtml=compactReceiptHtml8951;
  try{renderReceiptHtml=compactReceiptHtml8951}catch(_){}
  window.renderReceipt=(op,d)=>{const el=document.getElementById('receiptArea');if(el)el.innerHTML=compactReceiptHtml8951(op,d)};
  try{renderReceipt=window.renderReceipt}catch(_){}
  window.refreshReceiptViews=opId=>{const op=(state.ops||[]).find(x=>String(x.id)===String(opId)),d=op&&(state.dealers||[]).find(x=>String(x.id)===String(op.dealerId));if(!op||!d)return;const html=compactReceiptHtml8951(op,d),area=document.getElementById('receiptArea'),view=document.getElementById('receiptViewBody');if(area?.querySelector('[data-receipt-op-id="'+opId+'"]'))area.innerHTML=html;if(view?.querySelector('[data-receipt-op-id="'+opId+'"]'))view.innerHTML=html};
  try{refreshReceiptViews=window.refreshReceiptViews}catch(_){}
  window.showReceiptFromHistory=id=>{const op=(state.ops||[]).find(x=>String(x.id)===String(id)&&x.type==='sale'),d=op&&(state.dealers||[]).find(x=>String(x.id)===String(op.dealerId));if(!op||!d)return;const body=document.getElementById('receiptViewBody'),modal=document.getElementById('receiptViewModal');if(body)body.innerHTML=compactReceiptHtml8951(op,d);modal?.classList.remove('hidden')};
  try{showReceiptFromHistory=window.showReceiptFromHistory}catch(_){}

  window.receiptText=op=>{const d=(state.dealers||[]).find(x=>String(x.id)===String(op.dealerId)),lines=['ТОВАРНАЯ НАКЛАДНАЯ № '+op.receiptNo+' от '+op.date,'Покупатель: '+(d?.name||op.dealer),''];(op.items||[]).forEach((i,n)=>lines.push((n+1)+'. '+(i.name||'Товар')+' — '+i.qty+' '+(i.unit||'шт')+' × '+rub(i.price)+' = '+rub(i.total)));lines.push('','ИТОГО: '+rub(op.total),'Остаток долга: '+rub(debtOf(op.dealerId)));return lines.join('\\n')};
  try{receiptText=window.receiptText}catch(_){}

  window.sendWhatsApp=async id=>{
    const op=(state.ops||[]).find(x=>String(x.id)===String(id)&&x.type==='sale'),d=op&&(state.dealers||[]).find(x=>String(x.id)===String(op.dealerId));if(!op)return;
    if(!window.receiptAPI?.sendJpeg)return alert('Отправка JPEG доступна только в установленном приложении Windows.');
    const r=await window.receiptAPI.sendJpeg({phone:d?.phone||'',fileName:'Товарная_накладная_'+op.receiptNo+'.jpg',html:compactReceiptImage8951(op,d)});
    if(!r?.ok)return alert(r?.message||'Не удалось подготовить JPEG для WhatsApp');
    if(r.message)alert(r.message);
  };
  try{sendWhatsApp=window.sendWhatsApp}catch(_){}

  function enhanceDebt8951(){
    const root=document.getElementById('debts');if(!root||root.dataset.ui8951)return;root.dataset.ui8951='1';
    const h2=root.querySelector(':scope > h2'),hint=root.querySelector(':scope > .sectionHint');
    if(hint)hint.textContent='Контроль задолженностей дилеров';
    const head=document.createElement('div');head.className='debtHead8951';
    const left=document.createElement('div');if(h2)left.appendChild(h2);if(hint)left.appendChild(hint);
    const refresh=document.createElement('div');refresh.className='debtRefresh8951';refresh.innerHTML='<span>Обновлено сегодня в <b id="debtUpdatedAt8951">—</b></span><button type="button" class="secondary miniBtn" title="Обновить">↻</button>';refresh.querySelector('button').onclick=()=>window.renderDebts();
    head.append(left,refresh);root.prepend(head);
    const stats=document.createElement('div');stats.className='debtStats8951';stats.innerHTML='<div class="card debtStat8951"><span class="debtStatIcon8951 blue">●</span><div><span class="muted">Всего дилеров</span><div class="big" id="debtAll8951">0</div></div></div><div class="card debtStat8951"><span class="debtStatIcon8951 red">₽</span><div><span class="muted">Общий долг</span><div class="big danger" id="debtTotal8951">0 ₽</div></div></div><div class="card debtStat8951"><span class="debtStatIcon8951 violet">◷</span><div><span class="muted">С долгом</span><div class="big danger" id="debtCount8951">0</div></div></div><div class="card debtStat8951"><span class="debtStatIcon8951 green">✓</span><div><span class="muted">Всего оплачено</span><div class="big ok" id="debtPaid8951">0 ₽</div></div></div>';head.after(stats);
    const search=document.getElementById('debtSearch'),sort=root.querySelector(':scope > .sortBar'),bar=document.createElement('div');bar.className='debtToolbar8951';const sw=document.createElement('div');if(search){search.placeholder='Поиск по названию или телефону...';sw.appendChild(search)}bar.appendChild(sw);if(sort)bar.appendChild(sort);stats.after(bar);
    const table=root.querySelector(':scope > table');if(table){table.classList.add('debtTable8951');const tr=table.querySelector('thead tr');if(tr)tr.innerHTML='<th>Дилер</th><th>Сумма продаж</th><th>Оплачено</th><th>Остаток</th><th>Последняя оплата</th><th>Действие</th>'}
  }
  window.openDebtPayment8951=id=>{go('payments');setTimeout(()=>{try{selectPayDealer(id)}catch(_){}},0)};
  window.renderDebts=()=>{
    enhanceDebt8951();const q=(document.getElementById('debtSearch')?.value||'').toLocaleLowerCase('ru');let arr=(state.dealers||[]).filter(d=>(String(d.name||'')+' '+String(d.phone||'')).toLocaleLowerCase('ru').includes(q));arr=sortDealers(arr,document.getElementById('debtSort')?.value||'recent');
    const body=document.getElementById('debtRows');if(body)body.innerHTML=arr.map(d=>{const pays=(state.ops||[]).filter(o=>o.dealerId==d.id&&o.type==='payment').sort((a,b)=>opTime(b)-opTime(a)),last=pays[0],debt=+debtOf(d.id)||0;return '<tr class="clickable" tabindex="0" onclick="openDealer('+d.id+')"><td><b>'+h(d.name)+'</b><br><span class="muted">'+h(d.phone||'')+'</span></td><td>'+rub(salesOf(d.id))+'</td><td class="ok">'+rub(paidOf(d.id))+'</td><td class="'+(debt>0?'danger':'ok')+'"><b>'+rub(debt)+'</b></td><td>'+(last?h(last.date||''):'—')+'</td><td><button class="primary miniBtn debtPayBtn8951" onclick="event.stopPropagation();openDebtPayment8951('+d.id+')">Внести оплату</button></td></tr>'}).join('');
    const all=(state.dealers||[]).length,withDebt=(state.dealers||[]).filter(d=>debtOf(d.id)>0),total=withDebt.reduce((s,d)=>s+debtOf(d.id),0),paid=(state.dealers||[]).reduce((s,d)=>s+paidOf(d.id),0);
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};set('debtAll8951',all);set('debtTotal8951',rub(total));set('debtCount8951',withDebt.length);set('debtPaid8951',rub(paid));set('debtUpdatedAt8951',new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}));
  };
  try{renderDebts=window.renderDebts}catch(_){}
  enhanceDebt8951();window.renderDebts();
  document.documentElement.dataset.interfaceVersion='8.9.51';
})();