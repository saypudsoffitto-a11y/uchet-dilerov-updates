(()=>{
  'use strict';
  if(window.__stableFix8938Installed)return;
  window.__stableFix8938Installed=true;

  const style=document.createElement('style');
  style.id='stableFix8938Style';
  style.textContent=`
    #products{overflow:visible!important;max-width:100%!important}
    #products .productTableScroll8938{overflow:auto!important;max-width:100%!important;max-height:calc(100vh - 300px)!important;scrollbar-gutter:stable both-edges;border:1px solid #d8dee7;background:#fff}
    #products .productTable{table-layout:auto!important;width:max-content!important;min-width:1040px!important;margin:0!important;border:0!important;font-size:12px!important}
    #products .productTable th,#products .productTable td{overflow:visible!important;text-overflow:clip!important;white-space:nowrap!important;min-width:72px!important;max-width:none!important;padding:5px 7px!important;line-height:1.15!important}
    #products .productTable th:nth-child(1),#products .productTable td:nth-child(1){min-width:118px!important}
    #products .productTable th:nth-child(2),#products .productTable td:nth-child(2){min-width:92px!important}
    #products .productTable th:nth-child(3),#products .productTable td:nth-child(3){min-width:240px!important;white-space:normal!important}
    #products .productTable th:nth-child(4),#products .productTable td:nth-child(4){min-width:82px!important}
    #products .productTable th:nth-child(5),#products .productTable td:nth-child(5){min-width:62px!important}
    #products .productTable th:nth-child(6),#products .productTable td:nth-child(6),#products .productTable th:nth-child(7),#products .productTable td:nth-child(7),#products .productTable th:nth-child(8),#products .productTable td:nth-child(8){min-width:94px!important}
    #products .productTable th:nth-child(9),#products .productTable td:nth-child(9){min-width:138px!important}
    #products .productTable .actions{gap:4px!important}
    #products .productTable .actions button{padding:5px 7px!important;font-size:11px!important}
    #products .productTable thead th{position:sticky;top:0;z-index:2;background:#f4f6f8!important}
    #products .productTableScroll8938::-webkit-scrollbar{height:14px;width:14px}
    #products .productTableScroll8938::-webkit-scrollbar-thumb{background:#9aa7b3;border-radius:8px;border:3px solid #eef1f4}
    #products .productTableScroll8938::-webkit-scrollbar-track{background:#eef1f4}

    .dealerHistoryDetail{font-size:11px!important}
    .dealerHistoryDetail th,.dealerHistoryDetail td{padding:4px 6px!important;line-height:1.15!important}
    .dealerHistoryDetail td:nth-child(3){min-width:150px!important}
    .tableWrap{max-width:100%!important;overflow:auto!important}
    .receipt{max-width:860px!important;padding:18px!important}
    .receipt table{font-size:12px!important}
    .receipt th,.receipt td{padding:5px 6px!important;line-height:1.15!important}
    .receipt .total{font-size:16px!important;margin-top:9px!important}
    .receipt .sign{margin-top:20px!important}
  `;
  document.head.appendChild(style);

  function ensureProductScroller(){
    const table=document.querySelector('#products .productTable');
    if(!table)return false;
    if(table.parentElement?.classList.contains('productTableScroll8938'))return true;
    const wrap=document.createElement('div');
    wrap.className='productTableScroll8938';
    table.parentNode.insertBefore(wrap,table);
    wrap.appendChild(table);
    return true;
  }
  ensureProductScroller();
  const scrollerObserver=new MutationObserver(()=>ensureProductScroller());
  const products=document.getElementById('products');
  if(products)scrollerObserver.observe(products,{childList:true,subtree:true});

  const idKey=id=>String(id);
  const hasOwn=(obj,key)=>Object.prototype.hasOwnProperty.call(obj||{},key);
  const persist=()=>{
    try{if(typeof KEY!=='undefined')localStorage.setItem(KEY,JSON.stringify(state))}catch(_){}
    try{if(typeof save==='function')save()}catch(_){}
  };
  const snapshotDealer=(op,d)=>{
    if(!op||!d)return;
    if(!op.dealer)op.dealer=d.name||'';
    if(!op.dealerPhone)op.dealerPhone=d.phone||'';
    if(!op.dealerCity)op.dealerCity=d.city||'';
    if(!op.dealerCompany)op.dealerCompany=d.company||'';
  };
  const refreshDealerViews=()=>{
    try{if(typeof renderDealers==='function')renderDealers()}catch(_){}
    try{if(typeof renderDebts==='function')renderDebts()}catch(_){}
    try{if(typeof renderPaymentDealers==='function')renderPaymentDealers()}catch(_){}
  };
  const queueSync=()=>{
    try{
      if(!state?.sync?.url||typeof syncPush!=='function')return;
      let n=0;
      const run=()=>{
        n++;
        try{
          if(typeof syncBusy!=='undefined'&&syncBusy){if(n<10)setTimeout(run,400);return}
          const p=syncPush(true);
          if(p&&typeof p.catch==='function')p.catch(()=>{if(n<10)setTimeout(run,700)});
        }catch(_){if(n<10)setTimeout(run,700)}
      };
      setTimeout(run,150);
    }catch(_){}
  };

  function deleteDealer8938(id){
    if(typeof state==='undefined'||!Array.isArray(state.dealers))return false;
    const d=state.dealers.find(x=>x.id==id);
    if(!d)return false;
    const related=(state.ops||[]).filter(o=>o.dealerId==id);
    if(!confirm('Удалить карточку дилера «'+(d.name||'')+'»?'))return false;
    const detail=related.length
      ?'Карточка будет удалена из списка. '+related.length+' продаж, чеков и оплат останутся в истории. Подтвердить удаление?'
      :'Карточка будет удалена из списка. Подтвердить удаление?';
    if(!confirm(detail))return false;

    related.forEach(o=>snapshotDealer(o,d));
    state.deletedDealers=state.deletedDealers&&typeof state.deletedDealers==='object'?state.deletedDealers:{};
    state.deletedDealerKeys={};
    state.deletedDealers[idKey(id)]=Date.now();
    state.dealers=state.dealers.filter(x=>x.id!=id);
    persist();

    let persisted={};
    try{if(typeof KEY!=='undefined')persisted=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(_){}
    if((state.dealers||[]).some(x=>x.id==id)){
      state.dealers=state.dealers.filter(x=>x.id!=id);
      persist();
    }
    if(persisted.dealers&&persisted.dealers.some(x=>x.id==id)){
      persisted.dealers=persisted.dealers.filter(x=>x.id!=id);
      persisted.deletedDealers=persisted.deletedDealers&&typeof persisted.deletedDealers==='object'?persisted.deletedDealers:{};
      persisted.deletedDealers[idKey(id)]=state.deletedDealers[idKey(id)];
      try{localStorage.setItem(KEY,JSON.stringify(persisted))}catch(_){}
    }

    try{document.getElementById('dealerContextMenu')?.remove()}catch(_){}
    try{document.getElementById('dealerContextMenu8938')?.remove()}catch(_){}
    try{if(typeof closeDealerModal==='function')closeDealerModal()}catch(_){}
    refreshDealerViews();
    setTimeout(refreshDealerViews,50);
    queueSync();
    return !(state.dealers||[]).some(x=>x.id==id) && hasOwn(state.deletedDealers,idKey(id));
  }

  function openMenu(e,id){
    e.preventDefault();
    e.stopPropagation();
    try{e.stopImmediatePropagation()}catch(_){}
    document.getElementById('dealerContextMenu')?.remove();
    document.getElementById('dealerContextMenu8938')?.remove();
    const m=document.createElement('div');
    m.id='dealerContextMenu8938';
    m.className='dealerContextMenu';
    m.style.left=Math.min(e.clientX,window.innerWidth-270)+'px';
    m.style.top=Math.min(e.clientY,window.innerHeight-130)+'px';
    const edit=document.createElement('button');
    edit.type='button';
    edit.textContent='Изменить карточку дилера';
    edit.onclick=()=>{m.remove();if(typeof openDealerForEdit==='function')openDealerForEdit(id);else if(typeof openDealer==='function')openDealer(id)};
    const del=document.createElement('button');
    del.type='button';
    del.className='dangerMenuItem';
    del.textContent='Удалить дилера';
    del.onclick=()=>{m.remove();deleteDealer8938(id)};
    m.append(edit,del);
    document.body.appendChild(m);
  }

  window.deleteDealerFromList=deleteDealer8938;
  window.deleteDealerPermanent8938=deleteDealer8938;
  window.showDealerContextMenu=openMenu;
  try{deleteDealerFromList=deleteDealer8938}catch(_){}
  try{showDealerContextMenu=openMenu}catch(_){}

  document.addEventListener('contextmenu',e=>{
    const row=e.target?.closest?.('#dealerRows tr[oncontextmenu]');
    if(!row)return;
    const attr=row.getAttribute('oncontextmenu')||'';
    const m=attr.match(/showDealerContextMenu\(event,\s*([^\)]+)\)/);
    if(!m)return;
    let id=m[1].trim();
    if(/^['"].*['"]$/.test(id))id=id.slice(1,-1);
    else if(/^\d+(?:\.\d+)?$/.test(id))id=Number(id);
    openMenu(e,id);
  },true);

  document.addEventListener('click',()=>document.getElementById('dealerContextMenu8938')?.remove(),true);

  const htmlEsc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const fmtMoney=v=>{
    try{return typeof money==='function'?money(+v||0):(+v||0).toLocaleString('ru-RU')+' ₽'}catch(_){return String(+v||0)+' ₽'}
  };
  const dealerById=id=>(state.dealers||[]).find(x=>x.id==id);
  const opTimestamp=o=>{
    try{return typeof opTime==='function'?opTime(o):(+o.ts||Date.parse(o.date)||0)}catch(_){return +o.ts||0}
  };

  function receiptPdfHtml8938(op,d){
    const rows=(op.items||[]).map((i,n)=>`<tr><td>${n+1}</td><td>${htmlEsc(i.article||'')}</td><td>${htmlEsc(i.name||'')}</td><td class="num">${htmlEsc(+i.qty||0)} ${htmlEsc(i.unit||'шт')}</td><td class="num">${fmtMoney(i.price)}</td><td class="num">${fmtMoney(i.total)}</td></tr>`).join('');
    return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
      @page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;font-size:10.5pt;margin:0}h1{text-align:center;font-size:15pt;margin:0 0 11px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:5px 18px;margin-bottom:9px}.hint{font-size:8.5pt;color:#555;margin-bottom:6px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #444;padding:4px 5px;vertical-align:top;word-wrap:break-word}th{background:#f2f2f2;text-align:center;font-size:9pt}.num{text-align:right;white-space:nowrap}.total{text-align:right;font-size:13pt;font-weight:700;margin-top:9px}.debt{margin-top:6px}.sign{display:flex;justify-content:space-between;margin-top:26px;font-size:9pt}
      th:nth-child(1){width:5%}th:nth-child(2){width:11%}th:nth-child(3){width:42%}th:nth-child(4){width:13%}th:nth-child(5){width:13%}th:nth-child(6){width:16%}
    </style></head><body><h1>ТОВАРНАЯ НАКЛАДНАЯ № ${htmlEsc(op.receiptNo)} от ${htmlEsc(op.date)}</h1><div class="meta"><div><b>Поставщик:</b> ____________________</div><div><b>Покупатель:</b> ${htmlEsc(d?.name||op.dealer||'')}</div></div><table><thead><tr><th>№</th><th>Артикул</th><th>Наименование</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead><tbody>${rows}</tbody></table><div class="total">Итого: ${fmtMoney(op.total)}</div><div class="debt"><b>Остаток долга:</b> ${fmtMoney(typeof debtOf==='function'?debtOf(op.dealerId):0)}</div><div class="sign"><span>Отпустил: ____________________</span><span>Получил: ____________________</span></div></body></html>`;
  }

  function buildDebtRows8938(dealerId){
    const ops=(state.ops||[]).filter(o=>o.dealerId==dealerId).slice().sort((a,b)=>opTimestamp(a)-opTimestamp(b));
    let balance=0;
    return ops.map(o=>{
      let debit=0,credit=0,description='';
      if(o.type==='sale'){
        debit=+o.total||0;
        const names=(o.items||[]).map(i=>(i.name||'Товар')+' × '+(+i.qty||0)+' '+(i.unit||'шт')).join(', ');
        description='Накладная № '+(o.receiptNo||'')+(names?' — '+names:'');
      }else if(o.type==='initial_debt'){
        debit=+o.total||0;description=o.note||'Начальный долг';
      }else if(o.type==='payment'){
        credit=+o.total||0;description='Оплата'+(o.method?' — '+o.method:'')+(o.note?' — '+o.note:'');
      }else{
        debit=+o.total||0;description=o.note||o.type||'Операция';
      }
      balance+=debit-credit;
      return {date:o.date||'',description,debit,credit,balance};
    });
  }

  function debtReportPdfHtml8938(dealerId,paymentId){
    const d=dealerById(dealerId)||{};
    const p=paymentId?(state.ops||[]).find(x=>x.id==paymentId&&x.type==='payment'):null;
    let before=0,paid=0,after=0;
    try{
      before=p&&typeof debtBeforePayment==='function'?debtBeforePayment(p):(typeof debtOf==='function'?debtOf(dealerId):0);
      paid=p?(+p.total||0):0;
      after=p?(Number.isFinite(+p.afterDebt)?+p.afterDebt:before-paid):(typeof debtOf==='function'?debtOf(dealerId):0);
    }catch(_){}
    const current=typeof debtOf==='function'?debtOf(dealerId):after;
    const rows=buildDebtRows8938(dealerId).map(r=>`<tr><td>${htmlEsc(r.date)}</td><td>${htmlEsc(r.description)}</td><td class="num">${r.debit?fmtMoney(r.debit):'—'}</td><td class="num">${r.credit?fmtMoney(r.credit):'—'}</td><td class="num"><b>${fmtMoney(r.balance)}</b></td></tr>`).join('');
    const date=p?.date||new Date().toLocaleString('ru-RU');
    return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
      @page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;font-size:10pt;margin:0}h1{text-align:center;font-size:15pt;margin:0 0 10px}.meta{display:flex;justify-content:space-between;gap:20px;margin-bottom:9px}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:8px 0 10px}.box{border:1px solid #777;padding:6px;text-align:center}.box span{display:block;font-size:8pt;color:#555;margin-bottom:3px}.box b{font-size:11pt}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #555;padding:4px 5px;vertical-align:top;word-wrap:break-word}th{background:#f2f2f2;font-size:8.5pt}.num{text-align:right;white-space:nowrap}th:nth-child(1){width:18%}th:nth-child(2){width:40%}th:nth-child(3),th:nth-child(4),th:nth-child(5){width:14%}.footer{margin-top:8px;text-align:right;font-size:12pt;font-weight:700}
    </style></head><body><h1>ОТЧЁТ ПО ДОЛГУ</h1><div class="meta"><div><b>Дилер:</b> ${htmlEsc(d.name||'')}</div><div><b>Дата:</b> ${htmlEsc(date)}</div></div><div class="summary"><div class="box"><span>Долг до оплаты</span><b>${fmtMoney(before)}</b></div><div class="box"><span>Оплачено</span><b>${fmtMoney(paid)}</b></div><div class="box"><span>Остаток</span><b>${fmtMoney(after)}</b></div><div class="box"><span>Текущий долг</span><b>${fmtMoney(current)}</b></div></div><table><thead><tr><th>Дата</th><th>Операция / документ</th><th>Начислено</th><th>Оплачено</th><th>Остаток</th></tr></thead><tbody>${rows||'<tr><td colspan="5">Операций пока нет</td></tr>'}</tbody></table><div class="footer">Текущий долг: ${fmtMoney(current)}</div></body></html>`;
  }

  if(window.receiptAPI?.sendPdf){
    window.sendWhatsApp=async function(id){
      const op=(state.ops||[]).find(x=>x.id==id),d=op&&dealerById(op.dealerId);if(!op)return;
      const r=await window.receiptAPI.sendPdf({phone:d?.phone||'',fileName:`Товарная_накладная_${op.receiptNo}.pdf`,html:receiptPdfHtml8938(op,d)});
      if(!r?.ok)return alert(r?.message||'Не удалось подготовить PDF для WhatsApp');
      alert(r.message||'PDF накладной подготовлен для WhatsApp.');
    };
    window.downloadReceipt=async function(id){
      const op=(state.ops||[]).find(x=>x.id==id),d=op&&dealerById(op.dealerId);if(!op)return;
      const r=await window.receiptAPI.savePdf({fileName:`Товарная_накладная_${op.receiptNo}.pdf`,html:receiptPdfHtml8938(op,d)});
      if(!r?.ok&&r?.message)alert(r.message);
    };
    window.sendDebtReportWhatsApp=async function(dealerId,paymentId){
      const d=dealerById(dealerId);if(!d)return;
      if(!d.phone)return alert('У дилера не указан телефон WhatsApp');
      const r=await window.receiptAPI.sendPdf({phone:d.phone,fileName:`Отчёт_по_долгу_${String(d.name||dealerId).replace(/[<>:"/\\|?*]/g,'_')}.pdf`,html:debtReportPdfHtml8938(dealerId,paymentId)});
      if(!r?.ok)return alert(r?.message||'Не удалось подготовить PDF-отчёт по долгу для WhatsApp');
      alert(r.message||'PDF-отчёт по долгу подготовлен для WhatsApp.');
    };
    window.downloadDebtReport=async function(dealerId,paymentId){
      const d=dealerById(dealerId);if(!d)return;
      const r=await window.receiptAPI.savePdf({fileName:`Отчёт_по_долгу_${String(d.name||dealerId).replace(/[<>:"/\\|?*]/g,'_')}.pdf`,html:debtReportPdfHtml8938(dealerId,paymentId)});
      if(!r?.ok&&r?.message)alert(r.message);
    };
  }

  window.receiptPdfHtml8938=receiptPdfHtml8938;
  window.debtReportPdfHtml8938=debtReportPdfHtml8938;
  document.documentElement.dataset.stableFix='8.9.38';
})();
