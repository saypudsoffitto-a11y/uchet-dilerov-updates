(()=>{
  'use strict';
  if(window.__pdfCompact8938Installed)return;
  window.__pdfCompact8938Installed=true;

  const style=document.createElement('style');
  style.id='pdfCompact8938Style';
  style.textContent=`
    .receipt{max-width:860px!important;padding:14px!important;margin:12px auto!important}
    .receipt h2{font-size:18px!important;margin:0 0 9px!important}
    .receipt .meta{gap:4px 12px!important;margin-bottom:8px!important;font-size:13px!important}
    .receipt table{font-size:12px!important;table-layout:auto!important;width:100%!important}
    .receipt th,.receipt td{padding:4px 6px!important;line-height:1.18!important}
    .receipt th{white-space:nowrap!important}
    .receipt td:nth-child(3){white-space:normal!important;min-width:180px!important;max-width:320px!important}
    .receipt .total{font-size:15px!important;margin-top:8px!important}
    .receipt .sign{margin-top:18px!important;font-size:12px!important}
    .receipt .actions{gap:6px!important;margin-top:12px!important}
    .receipt .actions button{padding:7px 9px!important;font-size:12px!important}

    .dealerHistoryDetail{font-size:11.5px!important;width:100%!important;min-width:860px!important}
    .dealerHistoryDetail th,.dealerHistoryDetail td{padding:4px 6px!important;line-height:1.16!important}
    .dealerHistoryDetail td:nth-child(3){white-space:normal!important;min-width:180px!important;max-width:300px!important}
    .dealerHistoryDetail td:nth-child(8){white-space:nowrap!important}
    .tableWrap{overflow:auto!important;max-width:100%!important}

    #debtReportPrint{max-width:760px!important}
    #debtReportPrint .grid{gap:8px!important}
    #debtReportPrint .card{padding:10px!important}
    #debtReportPrint .big{font-size:18px!important;margin-top:5px!important}
  `;
  document.head.appendChild(style);

  const h=v=>String(v??'').replace(/[&<>"']/g,ch=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));
  const fmtMoney=v=>{
    try{return typeof money==='function'?money(+v||0):(+v||0).toLocaleString('ru-RU')+' ₽'}catch(_){return (+v||0).toLocaleString('ru-RU')+' ₽'}
  };
  const currentDebt=id=>{
    try{return typeof debtOf==='function'?debtOf(id):0}catch(_){return 0}
  };
  const qtyText=(v,unit)=>{
    const n=Number(v||0);
    const q=Number.isFinite(n)?n.toLocaleString('ru-RU',{maximumFractionDigits:3}):String(v||'');
    return q+' '+String(unit||'шт');
  };

  function receiptPdfHtml8938(op,d){
    const rows=(op.items||[]).map((i,n)=>`<tr>
      <td>${n+1}</td>
      <td>${h(i.article||'')}</td>
      <td class="name">${h(i.name||'')}</td>
      <td>${h(qtyText(i.qty,i.unit))}</td>
      <td>${h(fmtMoney(i.price))}</td>
      <td>${h(fmtMoney(Number.isFinite(+i.total)?+i.total:(+i.qty||0)*(+i.price||0)))}</td>
    </tr>`).join('');
    return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
      @page{size:A4;margin:10mm}
      *{box-sizing:border-box}body{font-family:"Segoe UI",Arial,sans-serif;color:#111;font-size:10pt;margin:0}
      .sheet{width:100%}h1{text-align:center;font-size:14pt;margin:0 0 10px}
      .meta{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;margin-bottom:8px}
      table{width:100%;border-collapse:collapse;table-layout:auto}
      th,td{border:1px solid #555;padding:4px 5px;vertical-align:top;line-height:1.15}
      th{text-align:center;background:#f3f3f3;font-size:9.5pt;white-space:nowrap}
      td:nth-child(1){width:5%;text-align:center}td:nth-child(2){width:11%;white-space:nowrap}
      td.name{width:43%;white-space:normal}td:nth-child(4){width:13%;white-space:nowrap}
      td:nth-child(5),td:nth-child(6){width:14%;white-space:nowrap;text-align:right}
      .total{text-align:right;font-size:12pt;font-weight:700;margin-top:8px}
      .debt{margin-top:8px}.sign{display:flex;justify-content:space-between;margin-top:24px;font-size:9.5pt}
    </style></head><body><div class="sheet">
      <h1>ТОВАРНАЯ НАКЛАДНАЯ № ${h(op.receiptNo)} от ${h(op.date)}</h1>
      <div class="meta"><div><b>Поставщик:</b> ____________________</div><div><b>Покупатель:</b> ${h(d?.name||op.dealer||'')}</div></div>
      <table><thead><tr><th>№</th><th>Артикул</th><th>Наименование</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="total">Итого: ${h(fmtMoney(op.total))}</div>
      <div class="debt"><b>Остаток долга:</b> ${h(fmtMoney(currentDebt(op.dealerId)))}</div>
      <div class="sign"><span>Отпустил: ____________________</span><span>Получил: ____________________</span></div>
    </div></body></html>`;
  }

  function resolveDebtReport(dealerId,paymentId){
    const d=(state.dealers||[]).find(x=>x.id==dealerId);
    const payments=(state.ops||[]).filter(x=>x.dealerId==dealerId&&x.type==='payment').slice().sort((a,b)=>{
      try{return typeof opTime==='function'?opTime(b)-opTime(a):(+b.ts||0)-(+a.ts||0)}catch(_){return (+b.ts||0)-(+a.ts||0)}
    });
    const p=paymentId?(state.ops||[]).find(x=>x.id==paymentId&&x.type==='payment'):payments[0];
    let before=currentDebt(dealerId),paid=0,after=currentDebt(dealerId);
    if(p){
      try{before=typeof debtBeforePayment==='function'?debtBeforePayment(p):(Number.isFinite(+p.beforeDebt)?+p.beforeDebt:before)}catch(_){}
      paid=+p.total||0;
      after=Number.isFinite(+p.afterDebt)?+p.afterDebt:before-paid;
    }
    return {d,p,before,paid,after,current:currentDebt(dealerId),date:p?.date||new Date().toLocaleString('ru-RU')};
  }

  function debtPdfHtml8938(dealerId,paymentId){
    const r=resolveDebtReport(dealerId,paymentId);
    return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
      @page{size:A4;margin:12mm}
      *{box-sizing:border-box}body{font-family:"Segoe UI",Arial,sans-serif;color:#111;font-size:10.5pt;margin:0}
      .sheet{max-width:760px;margin:0 auto}h1{text-align:center;font-size:15pt;margin:0 0 14px}
      .meta{margin:5px 0}.summary{width:100%;border-collapse:collapse;margin-top:14px}
      .summary th,.summary td{border:1px solid #555;padding:7px 8px;text-align:center}
      .summary th{background:#f3f3f3;font-size:9.5pt}.summary td{font-size:11pt;font-weight:700}
      .current{text-align:right;margin-top:12px;font-size:11pt;font-weight:700}.sign{margin-top:30px;display:flex;justify-content:space-between;font-size:9.5pt}
    </style></head><body><div class="sheet">
      <h1>ОТЧЁТ ПО ДОЛГУ</h1>
      <div class="meta"><b>Дилер:</b> ${h(r.d?.name||'')}</div>
      <div class="meta"><b>Дата:</b> ${h(r.date)}</div>
      <table class="summary"><thead><tr><th>Долг до оплаты</th><th>Оплачено</th><th>Остаток после оплаты</th><th>Текущий долг</th></tr></thead><tbody><tr>
        <td>${h(fmtMoney(r.before))}</td><td>${h(fmtMoney(r.paid))}</td><td>${h(fmtMoney(r.after))}</td><td>${h(fmtMoney(r.current))}</td>
      </tr></tbody></table>
      <div class="sign"><span>Передал: ____________________</span><span>Получил: ____________________</span></div>
    </div></body></html>`;
  }

  async function sendPdf(payload,failText){
    if(!window.receiptAPI?.sendPdf)return alert('Отправка PDF доступна только в установленном приложении Windows.');
    const r=await window.receiptAPI.sendPdf(payload);
    if(!r?.ok)return alert(r?.message||failText);
    if(r.message)alert(r.message);
  }

  window.sendWhatsApp=async function(id){
    const op=(state.ops||[]).find(x=>x.id==id&&x.type==='sale');
    if(!op)return;
    const d=(state.dealers||[]).find(x=>x.id==op.dealerId);
    await sendPdf({
      phone:d?.phone||'',
      fileName:`Товарная_накладная_${op.receiptNo}.pdf`,
      html:receiptPdfHtml8938(op,d)
    },'Не удалось подготовить накладную PDF для WhatsApp');
  };

  window.downloadReceipt=async function(id){
    const op=(state.ops||[]).find(x=>x.id==id&&x.type==='sale');
    if(!op)return;
    const d=(state.dealers||[]).find(x=>x.id==op.dealerId);
    if(!window.receiptAPI?.savePdf)return alert('Сохранение PDF доступно только в установленном приложении Windows.');
    const r=await window.receiptAPI.savePdf({fileName:`Товарная_накладная_${op.receiptNo}.pdf`,html:receiptPdfHtml8938(op,d)});
    if(!r?.ok&&!r?.canceled)alert(r?.message||'Не удалось сохранить PDF');
  };

  window.sendDebtReportWhatsApp=async function(dealerId,paymentId){
    const d=(state.dealers||[]).find(x=>x.id==dealerId);
    if(!d)return;
    await sendPdf({
      phone:d.phone||'',
      fileName:`Отчёт_по_долгу_${String(d.name||dealerId).replace(/[<>:"/\\|?*]/g,'_')}.pdf`,
      html:debtPdfHtml8938(dealerId,paymentId)
    },'Не удалось подготовить отчёт по долгу PDF для WhatsApp');
  };

  window.downloadDebtReport=async function(dealerId,paymentId){
    const d=(state.dealers||[]).find(x=>x.id==dealerId);
    if(!d)return;
    if(!window.receiptAPI?.savePdf)return alert('Сохранение PDF доступно только в установленном приложении Windows.');
    const r=await window.receiptAPI.savePdf({
      fileName:`Отчёт_по_долгу_${String(d.name||dealerId).replace(/[<>:"/\\|?*]/g,'_')}.pdf`,
      html:debtPdfHtml8938(dealerId,paymentId)
    });
    if(!r?.ok&&!r?.canceled)alert(r?.message||'Не удалось сохранить PDF');
  };

  document.documentElement.dataset.pdfCompact='8.9.38';
})();
