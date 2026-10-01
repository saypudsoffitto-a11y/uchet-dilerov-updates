(()=>{
  'use strict';
  if(window.warehouseInstalled)return;
  const C=window.SyncCore8962;
  if(!C)throw new Error('Модуль расчёта склада не загружен');
  window.warehouseInstalled=true;
  const el=id=>document.getElementById(id),h=v=>esc(String(v??''));
  const round=n=>Number(n.toFixed(6));
  const names={initial:'Начальный остаток',stock_opening:'Начальный остаток',stock_expense:'Расход',stock_receipt:'Приход',sale:'Продажа',stock_return:'Возврат',stock_adjustment:'Корректировка'};
  const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
  const section=document.createElement('section');section.id='warehouse';section.className='hidden';
  section.innerHTML=`<h2>Склад</h2><p class="sectionHint">Остатки рассчитываются по документам. Отмена и изменение продажи пересчитывают количество автоматически.</p>
    <div class="card"><h3>Новый документ</h3><div class="form">
    <label>Тип<select id="warehouseType"><option value="stock_receipt">Приход</option><option value="stock_expense">Расход</option><option value="stock_opening">Начальные остатки (один раз)</option><option value="stock_return">Возврат</option><option value="stock_adjustment">Корректировка</option></select></label>
    <label>Дата<input id="warehouseDate" type="date"></label><label class="full">Примечание<input id="warehouseNote"></label>
    </div><p class="muted">Отметьте несколько товаров и заполните количество и закупочную цену. Для корректировки укажите изменение со знаком + или −.</p>
    <input id="warehouseSearch" class="search" placeholder="Поиск по названию или артикулу"><div class="tableWrap" style="max-height:360px;overflow:auto"><table><thead><tr><th>Выбрать</th><th>Товар</th><th>Остаток</th><th>Количество</th><th>Закупочная цена, ₽</th></tr></thead><tbody id="warehouseDocumentRows"></tbody></table></div>
    <button id="warehouseSave" class="primary" type="button">Провести документ</button><p id="warehouseDocumentStatus" role="status"></p></div>
    <div class="card"><h3>Остатки и история</h3><label>Товар<select id="warehouseHistoryProduct"></select></label><p id="warehouseBalance"></p>
    <div class="tableWrap"><table><thead><tr><th>Дата</th><th>Документ</th><th>Количество</th><th>Остаток</th><th>Примечание</th></tr></thead><tbody id="warehouseHistoryRows"></tbody></table></div></div>`;
  document.querySelector('main').appendChild(section);
  const nav=document.createElement('button');nav.dataset.section='warehouse';nav.textContent='Склад';nav.onclick=()=>go('warehouse');
  document.querySelector('nav').appendChild(nav);
  el('warehouseDate').value=today();
  const draft=new Map();let renderedSignature='';
  function rememberDraft(){
    for(const row of el('warehouseDocumentRows').querySelectorAll('tr[data-product-id]')){
      draft.set(row.dataset.productId,{selected:row.querySelector('[data-field="selected"]').checked,qty:row.querySelector('[data-field="qty"]').value,buyPrice:row.querySelector('[data-field="buyPrice"]').value});
    }
  }
  function renderWarehouse(resetDraft=false){
    C.enableInventory(state);
    const products=(state.products||[]).filter(p=>!p.archived).slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'ru'));
    const signature=JSON.stringify(products.map(p=>[p.id,p.name,p.article,p.stock,p.buyPrice]));
    if(signature!==renderedSignature){
      if(!resetDraft)rememberDraft();renderedSignature=signature;
      el('warehouseDocumentRows').innerHTML=products.map(p=>{
        const d=draft.get(String(p.id))||{selected:false,qty:'',buyPrice:p.buyPrice||0};
        return '<tr data-product-id="'+h(p.id)+'"><td><input aria-label="Выбрать '+h(p.name)+'" data-field="selected" type="checkbox" '+(d.selected?'checked':'')+'></td><td>'+h(p.name)+'<br><span class="muted">'+h(p.article)+'</span></td><td>'+h(p.stock)+' '+h(p.unit||'шт')+'</td><td><input aria-label="Количество '+h(p.name)+'" data-field="qty" type="number" step="0.001" value="'+h(d.qty)+'"></td><td><input aria-label="Закупочная цена '+h(p.name)+'" data-field="buyPrice" type="number" min="0" step="0.01" value="'+h(d.buyPrice)+'"></td></tr>';
      }).join('');
    }
    const previous=el('warehouseHistoryProduct').value;
    el('warehouseHistoryProduct').innerHTML=(state.products||[]).map(p=>'<option value="'+h(p.id)+'">'+h(p.name)+'</option>').join('');
    if((state.products||[]).some(p=>String(p.id)===previous))el('warehouseHistoryProduct').value=previous;
    renderHistory();filterRows();
  }
  function filterRows(){
    const q=C.normalize(el('warehouseSearch').value);
    for(const row of el('warehouseDocumentRows').querySelectorAll('tr'))row.hidden=!C.normalize(row.cells[1].textContent).includes(q);
  }
  function renderHistory(){
    const id=el('warehouseHistoryProduct').value,p=(state.products||[]).find(p=>String(p.id)===id);
    if(!p){el('warehouseHistoryRows').innerHTML='';el('warehouseBalance').textContent='Товаров пока нет';return;}
    el('warehouseBalance').textContent=(window.warehouseModeEnabled?.()===false?'Складской учёт выключен · ':'')+'Начальное количество: '+(p.initialStock??p.stock??0)+' · Остаток: '+p.stock+' '+(p.unit||'шт');
    let balance=0;
    el('warehouseHistoryRows').innerHTML=C.inventoryHistory(state,id).map(row=>{
      balance=round(balance+row.qty);
      const item=row.items?.find(i=>String(i.productId)===id);
      const note=[row.note,row.cancelled?'Продажа отменена':'',item&&row.type==='stock_receipt'?'Закупка: '+money(item.buyPrice):''].filter(Boolean).join(' · ');
      return '<tr><td>'+h(row.date||'')+'</td><td>'+h(names[row.type]||row.type)+(row.type==='initial'?'':' № '+h(row.number))+'</td><td>'+h(row.qty)+'</td><td>'+h(balance)+'</td><td>'+h(note)+'</td></tr>';
    }).join('');
  }
  function makeDocument(type,items,date,note,persist=true){
    if(window.warehouseModeEnabled?.()===false)throw new Error('Включите складской учёт в настройках');
    if(type==='stock_opening'&&items.some(i=>state.ops.some(o=>o.type==='stock_opening'&&o.items?.some(j=>String(j.productId)===String(i.productId)))))throw new Error('Начальный остаток уже введён. Используйте корректировку');
    if(!C.warehouseTypes.includes(type)||!items.length)throw new Error('Выберите товары');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||(!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date))throw new Error('Укажите дату');
    items=C.clone(items);
    if(type==='stock_opening')items=items.map(item=>{const p=state.products.find(p=>String(p.id)===String(item.productId));if(!p)throw new Error('Товар не найден');if(!Number.isFinite(item.qty)||item.qty<0)throw new Error('Начальное количество должно быть не меньше 0');return {...item,openingCount:item.qty,qty:round(item.qty-Number(p.stock||0))}});
    for(const item of items){
      if(!Number.isFinite(item.qty)||(item.qty===0&&type!=='stock_opening')||(['stock_receipt','stock_return','stock_expense'].includes(type)&&item.qty<=0))throw new Error('Укажите допустимое количество');
      if(!Number.isFinite(item.buyPrice)||item.buyPrice<0)throw new Error('Проверьте закупочную цену');
      if(!(state.products||[]).some(p=>String(p.id)===String(item.productId)))throw new Error('Товар не найден');
    }
    const op={id:'stock-'+crypto.randomUUID(),type,ts:Date.now(),date,note:String(note||''),items:C.clone(items),total:round(items.reduce((sum,i)=>sum+i.qty*i.buyPrice,0))};
    op.number=date.replace(/-/g,'')+'-'+op.id.slice(-6).toUpperCase();
    state.ops.push(op);C.recalcInventory(state);if(persist)save();return op;
  }
  window.warehouseDocument=makeDocument;
  window.warehouseImportOpening=items=>makeDocument('stock_opening',items,today(),'Начальное количество из CSV',false);
  window.warehouseSetOpening=(p,value)=>{
    if(window.warehouseModeEnabled?.()===false)return;
    if(state.ops.some(o=>o.type==='stock_opening'&&o.items?.some(i=>String(i.productId)===String(p.id))))return;
    C.enableInventory(state);
    makeDocument('stock_opening',[{productId:p.id,name:p.name,qty:value,buyPrice:Number(p.buyPrice)||0}],today(),'Изменение начального количества в карточке товара');
  };
  window.renderWarehouse=renderWarehouse;
  el('warehouseHistoryProduct').onchange=renderHistory;
  el('warehouseSearch').oninput=filterRows;
  el('warehouseSave').onclick=()=>{
    try{
      rememberDraft();
      const items=[...draft.entries()].filter(([,d])=>d.selected).map(([id,d])=>{
        const p=state.products.find(p=>String(p.id)===id);
        if(!String(d.qty).trim())throw new Error('Укажите количество');
        return {productId:p.id,name:p.name,qty:Number(d.qty),buyPrice:Number(d.buyPrice)};
      });
      const op=makeDocument(el('warehouseType').value,items,el('warehouseDate').value,el('warehouseNote').value);
      draft.clear();renderedSignature='';el('warehouseNote').value='';renderWarehouse(true);
      el('warehouseDocumentStatus').textContent='Документ проведён: '+op.items.length+' позиций. '+(state.sync?.enabled?'Ожидает синхронизации.':'Сохранён локально.');
    }catch(e){el('warehouseDocumentStatus').textContent=e.message;}
  };
  C.enableInventory(state);localStorage.setItem(KEY,JSON.stringify(state));renderWarehouse();
})();
