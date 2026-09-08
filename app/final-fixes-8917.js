(()=>{
  if(window.__uchetFinalFixes8917)return;
  window.__uchetFinalFixes8917=true;

  const style=document.createElement('style');
  style.textContent=`
    #receiptPrint.receipt{max-width:820px;padding:14px 16px;margin:10px auto;font-size:12px}
    #receiptPrint.receipt h2{font-size:17px;margin:0 0 8px}
    #receiptPrint.receipt .meta{gap:3px 14px;margin-bottom:7px}
    #receiptPrint.receipt th,#receiptPrint.receipt td{padding:4px 6px;font-size:11px;line-height:1.15}
    #receiptPrint.receipt .total{font-size:15px;margin-top:7px}
    #receiptPrint.receipt .sign{margin-top:16px}
    #receiptPrint.receipt .actions{margin-top:10px!important}
    #receiptPrint .receiptEditHelp{margin:0 0 5px}
    @media print{
      #receiptPrint.receipt{padding:0!important;font-size:10.5pt!important}
      #receiptPrint.receipt h2{font-size:14pt!important;margin-bottom:6px!important}
      #receiptPrint.receipt th,#receiptPrint.receipt td{padding:3px 4px!important;font-size:9.5pt!important}
      #receiptPrint.receipt .sign{margin-top:12px!important}
    }
  `;
  document.head.appendChild(style);

  function normText(v){
    return String(v||'').toUpperCase().replace(/Ё/g,'Е').replace(/[–—]/g,'-').replace(/\s+/g,' ').trim();
  }
  function widthFromData(data){
    try{if(typeof nmFindRollWidth==='function')return +nmFindRollWidth(data)||0}catch(_){ }
    const z=data?.['Заказ']||{};
    const keys=['ШиринаРулона','ШиринаМатериала','МатериалШирина','Ширина','ШиринаПолотна','ШиринаПленки','ШиринаПлёнки'];
    for(const k of keys){
      const m=String(z[k]??'').replace(',','.').match(/(\d+(?:\.\d+)?)/);if(!m)continue;
      let n=+m[1];if(n>1000)n/=1000;else if(n>10)n/=100;if(n>=1&&n<=10)return n;
    }
    return 0;
  }
  function filmDescriptor(data){
    const z=data?.['Заказ']||{};
    return normText([z['МатериалКаталог'],z['МатериалМатериал'],z['МатериалЦвет']].filter(Boolean).join(' '));
  }
  function productGroupName(p){
    try{return normText((state.groups||[]).find(g=>g.id==p.groupId)?.name||'')}catch(_){return ''}
  }
  function isFilmProduct(p){
    const g=productGroupName(p),n=normText(p?.name);
    return /ПОЛОТН/.test(g)||/МАТ|ЛАК|САТИН|ПЛЕН|ПЛЁН|ПОЛОТН/.test(n);
  }
  function scoreFilmProduct(p,desc,width){
    const n=normText(p?.name);let s=0;
    if(!isFilmProduct(p))return -9999;
    if(/МАТ/.test(desc)&&/МАТ/.test(n))s+=35;
    if(/ЛАК/.test(desc)&&/ЛАК/.test(n))s+=35;
    if(/САТИН/.test(desc)&&/САТИН/.test(n))s+=35;
    if(/303/.test(desc)&&/303/.test(n))s+=30;
    if(/ЦВЕТ/.test(desc)&&/ЦВЕТ/.test(n))s+=20;
    if(/PREMIUM|ПРЕМИУМ/.test(desc)&&/PREMIUM|ПРЕМИУМ/.test(n))s+=8;

    if(width>0&&width<=3.60){
      if(/ДО\s*-?\s*360|ДО\s*3[,.]?60|360/.test(n))s+=70;
      if(/380|400|500|580/.test(n))s-=35;
    }else if(width>=3.80&&width<=5.05){
      if(/380\s*-?\s*500|400\s*-?\s*500|ОТ\s*380|ОТ\s*400/.test(n))s+=75;
      if(/ДО\s*-?\s*360|580/.test(n))s-=40;
    }else if(width>=5.70&&width<=5.90){
      if(/580|5[,.]?80/.test(n))s+=95;
      if(/ДО\s*-?\s*360|380\s*-?\s*500|400\s*-?\s*500/.test(n))s-=45;
    }
    return s;
  }
  function priceFromProductCard(data){
    const width=widthFromData(data),desc=filmDescriptor(data);
    const candidates=(state.products||[]).filter(p=>!p.archived&&isFilmProduct(p)).map(p=>({p,s:scoreFilmProduct(p,desc,width)})).sort((a,b)=>b.s-a.s);
    const best=candidates[0];
    if(!best||best.s<45)return null;
    const price=(+best.p.retailPrice||+best.p.wholesalePrice||0);
    if(price<=0)return null;
    return {price,product:best.p,width,score:best.s};
  }

  const originalNmBuildItems=window.nmBuildItems;
  if(typeof originalNmBuildItems==='function'){
    window.nmBuildItems=function(data){
      const items=originalNmBuildItems(data)||[];
      const found=priceFromProductCard(data);
      if(found){
        const mat=items.find(i=>i.article==='NM-MAT');
        if(mat){
          mat.price=found.price;
          mat.total=(+mat.qty||0)*found.price;
          mat.productId=found.product.id;
          mat.priceSource='Карточка товара';
          const label=' · цена из карточки «'+found.product.name+'»';
          if(!String(mat.name||'').includes('цена из карточки'))mat.name=String(mat.name||'')+label;
        }
      }
      return items;
    };
  }

  function compactPdfHtml(op,d){
    const rows=(op.items||[]).map((i,n)=>`<tr><td>${n+1}</td><td>${esc(i.article||'')}</td><td>${esc(i.name||'')}</td><td>${+i.qty||0} ${esc(i.unit||'шт')}</td><td>${money(i.price)}</td><td>${money(i.total)}</td></tr>`).join('');
    return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
      @page{size:A4;margin:8mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;font-size:9.5pt;margin:0}h1{text-align:center;font-size:13pt;margin:0 0 6px}.meta{display:flex;justify-content:space-between;gap:12px;margin:2px 0 6px}.meta div{flex:1}.line{border-top:1px solid #111;margin:5px 0}table{width:100%;border-collapse:collapse;margin-top:5px}th,td{border:1px solid #111;padding:3px 4px;text-align:left;vertical-align:top}th{text-align:center;background:#f3f3f3;font-size:9pt}.total{text-align:right;font-size:11pt;font-weight:700;margin-top:6px}.debt{text-align:right;margin-top:3px}.sign{display:flex;justify-content:space-between;margin-top:12px;font-size:9pt}
    </style></head><body><h1>ТОВАРНАЯ НАКЛАДНАЯ № ${esc(op.receiptNo)} от ${esc(op.date)}</h1><div class="meta"><div><b>Поставщик:</b> ____________________</div><div><b>Покупатель:</b> ${esc(d?.name||op.dealer||'')}</div></div><div class="line"></div><table><thead><tr><th>№</th><th>Артикул</th><th>Наименование</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead><tbody>${rows}</tbody></table><div class="total">Итого: ${money(op.total)}</div><div class="debt"><b>Остаток долга:</b> ${money(debtOf(op.dealerId))}</div><div class="sign"><span>Отпустил: ______________</span><span>Получил: ______________</span></div></body></html>`;
  }

  if(window.receiptAPI){
    window.downloadReceipt=async function(id){
      const op=(state.ops||[]).find(x=>x.id==id),d=op&&(state.dealers||[]).find(x=>x.id==op.dealerId);if(!op)return;
      const r=await window.receiptAPI.savePdf({fileName:`Товарная_накладная_${op.receiptNo}.pdf`,html:compactPdfHtml(op,d)});
      if(!r?.ok&&!r?.canceled)alert(r?.message||'Не удалось сохранить PDF');
    };
    window.sendWhatsApp=async function(id){
      const op=(state.ops||[]).find(x=>x.id==id),d=op&&(state.dealers||[]).find(x=>x.id==op.dealerId);if(!op)return;
      const r=await window.receiptAPI.sendPdf({phone:d?.phone||'',fileName:`Товарная_накладная_${op.receiptNo}.pdf`,html:compactPdfHtml(op,d)});
      if(!r?.ok)return alert(r?.message||'Не удалось подготовить PDF для WhatsApp');
      alert(r.message||'PDF накладной подготовлен. В WhatsApp вставь файл Ctrl+V и отправь.');
    };
  }

  function showFilmPriceSource(){
    try{
      if(!window.nmCurrent||!Array.isArray(window.nmPreviewItems))return;
      const found=priceFromProductCard(window.nmCurrent);if(!found)return;
      let el=document.getElementById('nmFilmPriceSource8917');
      if(!el){el=document.createElement('div');el.id='nmFilmPriceSource8917';el.className='card';el.style.margin='10px 0';document.getElementById('nmPreview')?.prepend(el)}
      el.innerHTML='<b>Цена плёнки определена автоматически:</b> '+esc(found.product.name)+' — '+money(found.price)+' / м²'+(found.width?' · ширина '+found.width+' м':'');
    }catch(_){ }
  }
  const preview=document.getElementById('nmPreview');if(preview)new MutationObserver(()=>setTimeout(showFilmPriceSource,0)).observe(preview,{childList:true,subtree:true});
})();