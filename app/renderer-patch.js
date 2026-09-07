(()=>{
  if(window.__uchetPatch8914)return;
  window.__uchetPatch8914=true;

  // Более мягкая и читаемая тема без изменения структуры интерфейса.
  const style=document.createElement('style');
  style.textContent=`
    :root{--bg:#f3f6f4;--card:#ffffff;--text:#20302b;--muted:#68756f;--blue:#2f6f68;--blue2:#e8f2ef;--red:#b0443b;--green:#2f7a54;--line:#dfe7e3;--sidebar:#243a35;--sidebar2:#304c45;--shadow:0 8px 24px rgba(28,55,47,.07)}
    header{background:#fbfcfb}
    nav{background:linear-gradient(180deg,#243a35,#1d302c)}
    nav button.active{background:#3b5f56;box-shadow:inset 3px 0 0 #9bc8bb}
    nav button:hover{background:#304c45}
    .primary{background:#2f6f68}
    .secondary{background:#edf2f0;color:#294039}
    input:focus,select:focus,textarea:focus{border-color:#76a99c;box-shadow:0 0 0 3px #e7f1ee}
    .choiceRow:hover,.choiceRow.active,.clickable:hover td{background:#edf6f3!important}
    .clickable:hover td:first-child{box-shadow:inset 4px 0 0 #4d887c}
    th{background:#f5f8f6;color:#50605a}
  `;
  document.head.appendChild(style);

  // Правый клик по дилеру: исправляем удаление без обращения к несуществующему renderAll().
  window.deleteDealerFromList=function(id){
    if(typeof hideDealerContextMenu==='function')hideDealerContextMenu();
    const d=(state.dealers||[]).find(x=>x.id==id);if(!d)return;
    const related=(state.ops||[]).filter(o=>o.dealerId==id).length;
    if(!confirm('Удалить дилера «'+d.name+'»?'))return;
    const detail='Это удалит карточку дилера'+(related?' и '+related+' связанных операций/чеков/оплат.':' и все связанные данные.')+' Действие нельзя отменить. Подтвердить окончательное удаление?';
    if(!confirm(detail))return;
    state.dealers=state.dealers.filter(x=>x.id!=id);
    state.ops=state.ops.filter(o=>o.dealerId!=id);
    save();
  };

  // Поля начального и текущего остатка в карточке товара.
  const addForm=document.getElementById('addProductForm');
  if(addForm&&!document.getElementById('pInitialStock')){
    const label=document.createElement('label');
    label.innerHTML='Начальный остаток<input id="pInitialStock" type="number" step="0.001" min="0" value="0" placeholder="Например, 100">';
    const unit=document.getElementById('punit');
    (unit&&unit.parentElement===addForm?addForm.insertBefore(label,unit):addForm.appendChild(label));
  }
  const editForm=document.querySelector('#productModal .form');
  if(editForm&&!document.getElementById('editPinitialStock')){
    const initial=document.createElement('label');
    initial.innerHTML='Начальный остаток<input id="editPinitialStock" type="number" step="0.001" min="0">';
    const current=document.createElement('label');
    current.innerHTML='Текущий остаток<input id="editPstock" type="number" step="0.001">';
    const unitLabel=document.getElementById('editPunit')?.parentElement;
    if(unitLabel){editForm.insertBefore(initial,unitLabel);editForm.insertBefore(current,unitLabel)}else{editForm.append(initial,current)}
  }

  // Для уже существующих товаров текущий остаток становится исходной точкой учёта.
  let migrated=false;
  (state.products||[]).forEach(p=>{
    if(p.initialStock==null){p.initialStock=Number.isFinite(+p.stock)?+p.stock:0;migrated=true}
    if(p.stock==null){p.stock=+p.initialStock||0;migrated=true}
  });
  if(migrated)save();

  const originalAddProduct=window.addProduct;
  if(typeof originalAddProduct==='function'){
    window.addProduct=async function(){
      const before=new Set((state.products||[]).map(p=>p.id));
      const initial=Math.max(0,Number(String(document.getElementById('pInitialStock')?.value||'0').replace(',','.'))||0);
      await originalAddProduct();
      const p=(state.products||[]).find(x=>!before.has(x.id));
      if(p){p.initialStock=initial;p.stock=initial;save()}
      const el=document.getElementById('pInitialStock');if(el)el.value='0';
    };
  }

  const originalEditProduct=window.editProduct;
  if(typeof originalEditProduct==='function'){
    window.editProduct=function(id){
      originalEditProduct(id);
      const p=(state.products||[]).find(x=>x.id==id);
      if(!p)return;
      const a=document.getElementById('editPinitialStock'),s=document.getElementById('editPstock');
      if(a)a.value=Number.isFinite(+p.initialStock)?+p.initialStock:(+p.stock||0);
      if(s)s.value=+p.stock||0;
    };
  }

  const originalSaveProductEdit=window.saveProductEdit;
  if(typeof originalSaveProductEdit==='function'){
    window.saveProductEdit=function(){
      const id=+document.getElementById('editProductId')?.value;
      const initial=Math.max(0,Number(String(document.getElementById('editPinitialStock')?.value||'0').replace(',','.'))||0);
      const current=Number(String(document.getElementById('editPstock')?.value||'0').replace(',','.'));
      originalSaveProductEdit();
      const p=(state.products||[]).find(x=>x.id==id);
      if(p){p.initialStock=initial;p.stock=Number.isFinite(current)?current:initial;save()}
    };
  }

  // После продажи автоматически уменьшаем остаток по каждой позиции.
  const originalSaveSale=window.saveSale;
  if(typeof originalSaveSale==='function'){
    window.saveSale=function(){
      const snapshot=(cart||[]).map(i=>({...i}));
      const shortages=snapshot.filter(i=>{
        const p=(state.products||[]).find(x=>x.id==i.productId);
        return p&&Number.isFinite(+p.stock)&&(+i.qty||0)>(+p.stock||0);
      });
      if(shortages.length&&!confirm('По некоторым товарам продажа превышает текущий остаток. Сохранить продажу и получить отрицательный остаток?'))return;
      const before=(state.ops||[]).length;
      originalSaveSale();
      if((state.ops||[]).length<=before)return;
      snapshot.forEach(i=>{
        const p=(state.products||[]).find(x=>x.id==i.productId);
        if(p)p.stock=(+p.stock||0)-(+i.qty||0);
      });
      save();
    };
  }

  // После Enter на выбранном дилере сразу переходим к поиску товара.
  const dealerSearch=document.getElementById('saleDealerSearch');
  if(dealerSearch){
    dealerSearch.addEventListener('keydown',e=>{
      if(e.key!=='Enter')return;
      setTimeout(()=>{
        const chosen=document.getElementById('saleDealer');
        const productSearch=document.getElementById('saleProductSearch');
        if(chosen?.value&&productSearch){productSearch.focus();productSearch.select()}
      },0);
    });
  }
  const originalSelectSaleDealer=window.selectSaleDealer;
  if(typeof originalSelectSaleDealer==='function'){
    window.selectSaleDealer=function(id){
      originalSelectSaleDealer(id);
      setTimeout(()=>{const el=document.getElementById('saleProductSearch');if(el){el.focus();el.select()}},20);
    };
  }

  // NewMatRos: при новой выгрузке не оставляем только уведомление — открываем раздел,
  // показываем заказ и прокручиваем к результату обработки.
  const nmPreviewEl=document.getElementById('nmPreview');
  if(nmPreviewEl){
    const priceToggle=document.querySelector('#newmatros .nmPriceToggle');
    if(priceToggle&&(nmPreviewEl.compareDocumentPosition(priceToggle)&Node.DOCUMENT_POSITION_FOLLOWING)){
      priceToggle.parentNode.insertBefore(nmPreviewEl,priceToggle);
    }
  }
  if(window.newmatrosAPI?.onIni){
    window.newmatrosAPI.onIni(payload=>{
      if(!payload?.text)return;
      try{
        go('newmatros');
        showNewMatRosPreview(parseIni(payload.text),payload.name||'NewMatRos');
        setTimeout(()=>document.getElementById('nmPreview')?.scrollIntoView({behavior:'smooth',block:'start'}),120);
      }catch(e){console.error('NewMatRos patch',e)}
    });
  }

  function receiptPdfHtml(op,d){
    const rows=(op.items||[]).map((i,n)=>`<tr><td>${n+1}</td><td>${esc(i.article||'')}</td><td>${esc(i.name||'')}</td><td>${money(i.price)}</td><td>${+i.qty||0}</td><td>${esc(i.unit||'шт')}</td><td>${money(i.total)}</td></tr>`).join('');
    return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
      @page{size:A4;margin:14mm}body{font-family:Arial,sans-serif;color:#111;font-size:11pt}h1{text-align:center;font-size:16pt;margin:0 0 14px}.meta{margin:3px 0}.line{border-top:1px solid #111;margin:10px 0}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #111;padding:6px;text-align:left}th{text-align:center;background:#f2f2f2}.total{text-align:right;font-size:14pt;font-weight:700;margin-top:12px}.sign{display:flex;justify-content:space-between;margin-top:36px;font-size:10pt}
    </style></head><body><h1>ТОВАРНАЯ НАКЛАДНАЯ № ${esc(op.receiptNo)} от ${esc(op.date)}</h1><div class="meta"><b>Поставщик:</b> ______________________________</div><div class="meta"><b>Покупатель:</b> ${esc(d?.name||op.dealer||'')}</div><div class="line"></div><table><thead><tr><th>№</th><th>Артикул</th><th>Наименование</th><th>Цена</th><th>Кол-во</th><th>Ед.</th><th>Сумма</th></tr></thead><tbody>${rows}</tbody></table><div class="total">Итого: ${money(op.total)}</div><div class="meta"><b>Остаток долга:</b> ${money(debtOf(op.dealerId))}</div><div class="sign"><span>Отпустил: ____________________</span><span>Получил: ____________________</span></div></body></html>`;
  }

  if(window.receiptAPI){
    window.sendWhatsApp=async function(id){
      const op=(state.ops||[]).find(x=>x.id==id),d=op&&(state.dealers||[]).find(x=>x.id==op.dealerId);if(!op)return;
      const r=await window.receiptAPI.sendPdf({phone:d?.phone||'',fileName:`Товарная_накладная_${op.receiptNo}.pdf`,html:receiptPdfHtml(op,d)});
      if(!r?.ok)return alert(r?.message||'Не удалось подготовить PDF для WhatsApp');
      alert(r.message||'PDF готов. В WhatsApp нажми Ctrl+V, чтобы прикрепить файл, затем отправь сообщение.');
    };
    window.downloadReceipt=async function(id){
      const op=(state.ops||[]).find(x=>x.id==id),d=op&&(state.dealers||[]).find(x=>x.id==op.dealerId);if(!op)return;
      const r=await window.receiptAPI.savePdf({fileName:`Товарная_накладная_${op.receiptNo}.pdf`,html:receiptPdfHtml(op,d)});
      if(!r?.ok&&r?.message)alert(r.message);
    };
  }
})();