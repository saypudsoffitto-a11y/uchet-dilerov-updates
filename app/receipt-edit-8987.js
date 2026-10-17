(function(root){
 'use strict';
 const round=n=>Math.round((n+Number.EPSILON)*100)/100;
 function number(value,label){if(String(value??'').trim()==='')throw Error('Укажи '+label+'.');if(!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(String(value).trim()))throw Error('Проверь '+label+'.');const n=Number(String(value).replace(',','.'));if(!Number.isFinite(n))throw Error('Проверь '+label+'.');return n;}
 function line(item,field,value){
  const next={...item};
  if(field==='name'){next.name=String(value??'').trim();if(!next.name)throw Error('Укажи название товара.');next.receiptNameEdited=true;return next;}
  if(!['qty','price','total'].includes(field))throw Error('Неизвестное поле.');
  const n=number(value,field==='qty'?'количество':field==='price'?'цену':'сумму');
  if(n<0||(field==='qty'&&n===0))throw Error(field==='qty'?'Количество должно быть больше 0.':'Цена и сумма не могут быть отрицательными.');
  next[field]=n;
  if(field==='total'){if(!(Number(next.qty)>0))throw Error('Количество должно быть больше 0.');next.price=n/Number(next.qty);next.total=round(n);}else next.total=round(Number(next.qty)*Number(next.price));
  next.profit=round(next.total-(Number(next.buyPrice)||0)*Number(next.qty));
  if(!(Number(next.qty)>0)||Number(next.price)<0)throw Error('Проверь количество и цену.');
  if(!Number.isFinite(next.total)||!Number.isFinite(next.price)||!Number.isFinite(next.profit))throw Error('Слишком большое значение.');
  return next;
 }
 function edit(current,opId,index,field,value){
  const next=JSON.parse(JSON.stringify(current)),op=next.ops.find(o=>String(o.id)===String(opId)&&o.type==='sale');
  if(!op||!Number.isInteger(index)||!op.items?.[index])throw Error('Позиция чека не найдена.');
  const old=op.items[index],item=line(old,field,value);op.items[index]=item;
  op.total=round(op.items.reduce((s,i)=>s+(Number(i.total)||0),0));op.profit=round(op.items.reduce((s,i)=>s+(Number(i.profit)||0),0));op.updatedAt=Date.now();if(!Number.isFinite(op.total)||!Number.isFinite(op.profit))throw Error('Слишком большая сумма чека.');
  const product=(next.products||[]).find(p=>String(p.id)===String(item.productId));
  if(field==='qty'&&product&&product.inventoryVersion!==2&&op.inventoryTracked!==false&&(!/^NM-/.test(item.article||'')||item.stockTracked))product.stock=(Number(product.stock)||0)+Number(old.qty)-Number(item.qty);
  return {state:next,op,item};
 }
 const api={line,edit};if(typeof module!=='undefined'&&module.exports){module.exports=api;return;}root.receiptEdit8987=api;
 const $=id=>document.getElementById(id);
 const printStyle=document.createElement('style');printStyle.textContent='.receiptPrintValue8987{display:none}@media print{.receipt .receiptEditInput{display:none!important}.receiptPrintValue8987{display:inline!important;white-space:normal;overflow-wrap:anywhere}}';document.head.appendChild(printStyle);
 root.editReceiptItem=function(opId,index,field,value){try{
  const result=edit(state,opId,Number(index),field,value);root.SyncCore8962?.recalcInventory(result.state);
  if(root.masterSync8962)root.masterSync8962.commitState(result.state);else{localStorage.setItem(KEY,JSON.stringify(result.state));state=result.state;}
  render();refreshReceiptViews(opId);
  const dealer=$('dealerModal');if(dealer&&!dealer.classList.contains('hidden')&&typeof openDealer==='function')openDealer(result.op.dealerId);
  if(!syncApplying&&state.sync?.enabled){clearTimeout(syncSaveTimer);syncSaveTimer=setTimeout(()=>syncPush(false),350);}
 }catch(e){alert(e.message||'Не удалось сохранить изменения.');refreshReceiptViews(opId);}};
 try{editReceiptItem=root.editReceiptItem;}catch(_){}
 function input(value,field,opId,index){const e=document.createElement('input');e.className='receiptEditInput';e.type='text';e.value=String(value??'');e.setAttribute('aria-label',({name:'Название товара',qty:'Количество',price:'Цена',total:'Сумма'})[field]);if(field!=='name')e.inputMode='decimal';e.onchange=()=>root.editReceiptItem(opId,index,field,e.value);e.onkeydown=ev=>{if(ev.key==='Enter'){ev.preventDefault();e.blur();}};return e;}
 function decorate(){document.querySelectorAll('.receipt[data-receipt-op-id]').forEach(receipt=>{
  const op=state.ops.find(o=>String(o.id)===receipt.dataset.receiptOpId);if(!op)return;
  receipt.querySelectorAll('tr[data-receipt-item-index]').forEach(row=>{if(row.dataset.edit8987)return;row.dataset.edit8987='1';const index=Number(row.dataset.receiptItemIndex),item=op.items?.[index];if(!item)return;
   const cells=row.cells,offset=cells.length>=6&&row.querySelector('input')?.closest('td')===cells[3]?1:0;
   const cell=(prefix,fallback)=>Array.from(cells).find(c=>String(c.dataset.colKey||'').startsWith(prefix+'_'))||cells[fallback];cell('Наименование',1+offset).replaceChildren(input(item.name,'name',op.id,index));cell('Кол-во',2+offset).replaceChildren(input(item.qty,'qty',op.id,index),document.createTextNode(' '+(item.unit||'шт')));cell('Цена',3+offset).replaceChildren(input(item.price,'price',op.id,index));cell('Сумма',4+offset).replaceChildren(input(item.total,'total',op.id,index));row.querySelectorAll('input').forEach(e=>{const span=document.createElement('span');span.className='receiptPrintValue8987';span.textContent=e.value;e.after(span);});
  });const help=receipt.querySelector('.receiptEditHelp');if(help&&help.textContent!=='Название, количество, цену и сумму можно изменить. При изменении суммы пересчитывается цена; итог и долг сохраняются автоматически.')help.textContent='Название, количество, цену и сумму можно изменить. При изменении суммы пересчитывается цена; итог и долг сохраняются автоматически.';
 });}
 new MutationObserver(decorate).observe(document.body,{childList:true,subtree:true});decorate();
 // The quantity dialog is also used before a new receipt is saved.
 const modal=$('qtyModal');if(!modal)return;
 const name=document.createElement('input');name.id='qtyModalName8987';name.setAttribute('aria-label','Название товара');$('qtyProductName').replaceChildren(name);
 function moneyInput(id,label){const old=$(id),e=document.createElement('input');e.id=id;e.type='text';e.inputMode='decimal';e.setAttribute('aria-label',label);old.replaceWith(e);return e;}
 const price=moneyInput('qtyModalPrice','Цена'),total=moneyInput('qtyModalTotal','Сумма');
 let draft=null;
 const show=promptQtyAndAddSelected;
 root.promptQtyAndAddSelected=function(){show();const p=state.products.find(p=>String(p.id)===String(qtyModalProductId));if(!p)return;draft={name:p.name,qty:1,price:Number(salePrice.value)||0,buyPrice:Number(p.buyPrice)||0};draft.total=round(draft.qty*draft.price);$('qtyProductName').replaceChildren(name);name.value=draft.name;price.value=draft.price;total.value=draft.total;};
 try{promptQtyAndAddSelected=root.promptQtyAndAddSelected;}catch(_){}
 function update(field,e){try{draft=line({...draft,qty:number($('qtyModalInput').value,'количество')},field,e.value);price.value=draft.price;total.value=draft.total;e.setCustomValidity('');}catch(err){e.setCustomValidity(err.message);}}
 $('qtyModalInput').oninput=()=>update('qty',$('qtyModalInput'));price.oninput=()=>update('price',price);total.oninput=()=>update('total',total);name.oninput=()=>update('name',name);
 root.confirmQtyModal=function(){try{let item=line({...draft,qty:number($('qtyModalInput').value,'количество'),price:number(price.value,'цену')},'name',name.value);item=line(item,'qty',item.qty);const enteredTotal=number(total.value,'сумму');if(enteredTotal<0)throw Error('Сумма не может быть отрицательной.');item=line(item,'total',enteredTotal);const p=state.products.find(p=>String(p.id)===String(qtyModalProductId));if(!p)throw Error('Товар не найден.');cart.push({...item,productId:p.id,article:p.article||'',unit:p.unit||'шт'});renderCart();closeQtyModal();saleProductSearch.focus();saleProductSearch.select();}catch(e){alert(e.message);}};
 try{confirmQtyModal=root.confirmQtyModal;}catch(_){}
 for(const e of [price,total,name])e.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();root.confirmQtyModal();}else if(event.key==='Escape')closeQtyModal();};
 const help=modal.querySelector('.qtyHelp');if(help)help.textContent='Измени название, количество, цену или сумму и нажми «Добавить в чек». При изменении суммы пересчитывается цена.';
})(globalThis);
