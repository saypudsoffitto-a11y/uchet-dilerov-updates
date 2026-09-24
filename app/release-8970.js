(()=>{
  'use strict';
  if(window.__release8970Final)return;
  window.__release8970Final=true;

  const h=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  /* Correct the Price table: move the Group column, including body cells, to the far right. */
  function priceGroupRight8970(){
    const table=document.querySelector('#pricelist8962 .priceTable8962');
    if(!table)return;
    const head=table.querySelector('thead tr');
    if(!head)return;
    let heads=[...head.children];
    let groupIndex=heads.findIndex(x=>String(x.textContent||'').trim().toLocaleLowerCase('ru-RU')==='группа');
    if(groupIndex<0)return;
    if(groupIndex!==heads.length-1){head.appendChild(heads[groupIndex]);groupIndex=head.children.length-1;}
    table.querySelectorAll('tbody tr').forEach(row=>{
      if(row.dataset.groupRight8970==='1')return;
      const cells=[...row.children];
      if(cells.length===heads.length&&cells.length>1)row.appendChild(cells[0]);
      row.dataset.groupRight8970='1';
    });
  }
  const priceRoot=document.getElementById('pricelist8962')||document.body;
  new MutationObserver(priceGroupRight8970).observe(priceRoot,{childList:true,subtree:true});
  setTimeout(priceGroupRight8970,0);

  /* Allow changing only the displayed name of an item in a saved receipt. */
  const baseEditReceiptItem=window.editReceiptItem;
  window.editReceiptItem=function(opId,itemIndex,field,value){
    if(field!=='name')return typeof baseEditReceiptItem==='function'?baseEditReceiptItem.apply(this,arguments):undefined;
    const op=(state.ops||[]).find(x=>String(x.id)===String(opId)&&x.type==='sale');
    const item=op?.items?.[Number(itemIndex)];
    if(!item)return;
    const next=String(value??'').trim();
    if(!next){alert('Название товара не может быть пустым');if(typeof refreshReceiptViews==='function')refreshReceiptViews(opId);return;}
    item.name=next;
    item.receiptNameEditedAt=Date.now();
    if(typeof save==='function')save();else localStorage.setItem(KEY,JSON.stringify(state));
    if(typeof refreshReceiptViews==='function')refreshReceiptViews(opId);
  };
  try{editReceiptItem=window.editReceiptItem}catch(_){}

  function nameCell8970(opId,index,item){
    return '<span class="receiptName8970" tabindex="0" data-op-id="'+h(opId)+'" data-item-index="'+index+'" title="Двойной щелчок или правая кнопка — изменить название">'+h(item?.name||'Товар')+'</span>';
  }

  window.renderReceiptHtml=function(op,d){
    const rows=(op.items||[]).map((i,n)=>'<tr><td>'+(n+1)+'</td><td>'+h(i.article||'')+'</td><td>'+nameCell8970(op.id,n,i)+'</td><td><input class="receiptEditInput" type="number" min="0.01" step="0.01" value="'+(+i.qty||0)+'" onchange="editReceiptItem('+op.id+','+n+',\'qty\',this.value)"> '+h(i.unit||'шт')+'</td><td><input class="receiptEditInput" type="number" min="0" step="0.01" value="'+(+i.price||0)+'" onchange="editReceiptItem('+op.id+','+n+',\'price\',this.value)"></td><td>'+money(i.total)+'</td></tr>').join('');
    return '<div class="receipt" id="receiptPrint" data-receipt-op-id="'+op.id+'"><h2>ТОВАРНАЯ НАКЛАДНАЯ № '+op.receiptNo+' от '+h(op.date)+'</h2><div class="meta"><div><b>Поставщик:</b> ____________________</div><div><b>Покупатель:</b> '+h(d?.name||op.dealer||'')+'</div></div><p class="receiptEditHelp">Количество и цену можно изменить прямо в накладной. Название товара — двойным щелчком или правой кнопкой мыши.</p><table><thead><tr><th>№</th><th>Артикул</th><th>Наименование</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead><tbody>'+rows+'</tbody></table><div class="total">Итого: '+money(op.total)+'</div><p><b>Остаток долга:</b> '+money(debtOf(d.id))+'</p><div class="sign"><span>Отпустил: ____________</span><span>Получил: ____________</span></div><div class="actions" style="margin-top:20px"><button class="primary" onclick="printReceipt()">Распечатать</button><button class="primary" onclick="downloadReceipt('+op.id+')">Скачать накладную</button><button class="primary" onclick="sendWhatsApp('+op.id+')">Отправить в WhatsApp</button><button class="primary" type="button" onclick="openReceiptAdd('+op.id+')">Добавить товар в этот чек</button><button class="dangerBtn" type="button" onclick="archiveReceipt('+op.id+')">Удалить чек</button></div></div>';
  };
  try{renderReceiptHtml=window.renderReceiptHtml}catch(_){}

  function closeNameMenu(){document.getElementById('receiptNameMenu8970')?.remove();}
  function startNameEdit(el){
    if(!el||el.dataset.editing8970==='1')return;
    closeNameMenu();
    el.dataset.editing8970='1';
    const old=el.textContent||'';
    const input=document.createElement('input');
    input.className='receiptEditInput receiptNameInput8970';
    input.type='text';input.value=old;
    const finish=saveIt=>{
      if(!input.isConnected)return;
      if(saveIt){window.editReceiptItem(el.dataset.opId,Number(el.dataset.itemIndex),'name',input.value);return;}
      input.replaceWith(el);delete el.dataset.editing8970;
    };
    input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();finish(true)}else if(e.key==='Escape'){e.preventDefault();finish(false)}});
    input.addEventListener('blur',()=>setTimeout(()=>finish(false),0));
    el.replaceWith(input);input.focus();input.select();
  }
  function showNameMenu(e,el){
    e.preventDefault();e.stopPropagation();closeNameMenu();
    const m=document.createElement('div');m.id='receiptNameMenu8970';m.className='saleContextMenu';m.style.left=Math.min(e.clientX,window.innerWidth-250)+'px';m.style.top=Math.min(e.clientY,window.innerHeight-80)+'px';
    const b=document.createElement('button');b.type='button';b.textContent='Изменить название';b.onclick=()=>startNameEdit(el);m.appendChild(b);document.body.appendChild(m);
  }
  document.addEventListener('dblclick',e=>{const el=e.target.closest?.('.receiptName8970');if(el)startNameEdit(el)});
  document.addEventListener('contextmenu',e=>{const el=e.target.closest?.('.receiptName8970');if(el)showNameMenu(e,el)});
  document.addEventListener('click',e=>{if(!e.target.closest?.('#receiptNameMenu8970'))closeNameMenu()});
  window.addEventListener('blur',closeNameMenu);

  const style=document.createElement('style');
  style.textContent='.receiptName8970{display:inline-block;min-width:120px;cursor:text;border-radius:5px;padding:3px 4px}.receiptName8970:hover{background:#eef5ff;outline:1px dashed #8eb5e8}.receiptNameInput8970{min-width:180px}@media print{.receiptName8970{padding:0!important;background:transparent!important;outline:0!important}}';
  document.head.appendChild(style);

  /* Make manual sync actions visibly report completion/failure even when called from old inline buttons. */
  if(window.masterSync8962&&!window.masterSync8962.__feedback8970){
    const wrap=(fn,label)=>async function(){
      const s=document.getElementById('syncStatus');if(s)s.textContent=label+'…';
      const ok=await fn.apply(this,arguments);
      if(s&&!String(s.textContent||'').trim())s.textContent=ok?label+' выполнено':label+' не выполнено';
      return ok;
    };
    if(typeof window.masterSync8962.pull==='function')window.masterSync8962.pull=wrap(window.masterSync8962.pull,'Загрузка с сервера');
    if(typeof window.masterSync8962.push==='function')window.masterSync8962.push=wrap(window.masterSync8962.push,'Отправка на сервер');
    window.masterSync8962.__feedback8970=true;
  }

  document.documentElement.dataset.interfaceVersion='8.9.70';
})();
