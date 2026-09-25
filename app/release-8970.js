(()=>{
  'use strict';
  if(window.__release8970Final)return;
  window.__release8970Final=true;

  /* Price: keep Group as the last visible column, moving matching body cells with the header. */
  function priceGroupRight8970(){
    const table=document.querySelector('#pricelist8962 .priceTable8962');
    if(!table)return;
    const head=table.querySelector('thead tr');
    if(!head)return;
    const heads=[...head.children];
    const groupIndex=heads.findIndex(x=>String(x.textContent||'').trim().toLocaleLowerCase('ru-RU')==='группа');
    if(groupIndex<0||groupIndex===heads.length-1)return;
    head.appendChild(heads[groupIndex]);
    table.querySelectorAll('tbody tr').forEach(row=>{
      const cells=[...row.children];
      if(cells[groupIndex])row.appendChild(cells[groupIndex]);
    });
  }
  const priceRoot=document.getElementById('pricelist8962')||document.body;
  new MutationObserver(priceGroupRight8970).observe(priceRoot,{childList:true,subtree:true});
  setTimeout(priceGroupRight8970,0);

  /* Saved receipt: change only the displayed item name. Do not replace the approved receipt/JPEG renderers. */
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

  function enhanceReceiptNames8970(root=document){
    // The final receipt editor owns these cells. Competing observers starve the UI.
    if(window.__release8973Installed)return;
    root.querySelectorAll?.('.receipt[data-receipt-op-id]').forEach(receipt=>{
      const opId=receipt.dataset.receiptOpId;
      const op=(state.ops||[]).find(x=>String(x.id)===String(opId)&&x.type==='sale');
      if(!op)return;
      receipt.querySelectorAll('tbody tr').forEach((row,index)=>{
        const cell=row.cells?.[1];
        const item=op.items?.[index];
        if(!cell||!item||cell.querySelector('.receiptName8970, .receiptNameInput8973'))return;
        const span=document.createElement('span');
        span.className='receiptName8970';
        span.tabIndex=0;
        span.dataset.opId=String(opId);
        span.dataset.itemIndex=String(index);
        span.title='Двойной щелчок или правая кнопка — изменить название';
        span.textContent=item.name||'Товар';
        cell.replaceChildren(span);
      });
      const help=receipt.querySelector('.receiptEditHelp');
      if(help&&!help.dataset.nameHelp8970){
        help.dataset.nameHelp8970='1';
        help.textContent='Количество и цену можно изменить прямо в накладной. Название товара — двойным щелчком или правой кнопкой мыши.';
      }
    });
  }
  const receiptRoots=['receiptArea','receiptViewBody'].map(id=>document.getElementById(id)).filter(Boolean);
  receiptRoots.forEach(root=>{
    enhanceReceiptNames8970(root);
    new MutationObserver(()=>enhanceReceiptNames8970(root)).observe(root,{childList:true,subtree:true});
  });
  setTimeout(()=>enhanceReceiptNames8970(document),0);

  function closeNameMenu(){document.getElementById('receiptNameMenu8970')?.remove();}
  function startNameEdit(el){
    if(!el||el.dataset.editing8970==='1')return;
    closeNameMenu();
    el.dataset.editing8970='1';
    const old=el.textContent||'';
    const input=document.createElement('input');
    input.className='receiptEditInput receiptNameInput8970';
    input.type='text';input.value=old;
    const cancel=()=>{if(input.isConnected){input.replaceWith(el);delete el.dataset.editing8970;}};
    const saveName=()=>{if(!input.isConnected)return;window.editReceiptItem(el.dataset.opId,Number(el.dataset.itemIndex),'name',input.value);};
    input.addEventListener('keydown',e=>{
      if(e.key==='Enter'){e.preventDefault();saveName();}
      else if(e.key==='Escape'){e.preventDefault();cancel();}
    });
    input.addEventListener('blur',()=>setTimeout(cancel,0));
    el.replaceWith(input);input.focus();input.select();
  }
  function showNameMenu(e,el){
    e.preventDefault();e.stopPropagation();closeNameMenu();
    const m=document.createElement('div');m.id='receiptNameMenu8970';m.className='saleContextMenu';
    m.style.left=Math.min(e.clientX,window.innerWidth-250)+'px';m.style.top=Math.min(e.clientY,window.innerHeight-80)+'px';
    const b=document.createElement('button');b.type='button';b.textContent='Изменить название';b.onclick=()=>startNameEdit(el);m.appendChild(b);document.body.appendChild(m);
  }
  document.addEventListener('dblclick',e=>{const el=e.target.closest?.('.receiptName8970');if(el)startNameEdit(el)});
  document.addEventListener('contextmenu',e=>{const el=e.target.closest?.('.receiptName8970');if(el)showNameMenu(e,el)});
  document.addEventListener('click',e=>{if(!e.target.closest?.('#receiptNameMenu8970'))closeNameMenu()});
  window.addEventListener('blur',closeNameMenu);

  const style=document.createElement('style');
  style.textContent='.receiptName8970{display:inline-block;min-width:120px;cursor:text;border-radius:5px;padding:3px 4px;font-weight:700}.receiptName8970:hover{background:#eef5ff;outline:1px dashed #8eb5e8}.receiptNameInput8970{min-width:180px}@media print{.receiptName8970{padding:0!important;background:transparent!important;outline:0!important}}';
  document.head.appendChild(style);

  /* Manual sync: make the completed action visible. */
  if(window.masterSync8962&&!window.masterSync8962.__feedback8970){
    const wrap=(fn,label)=>async function(){
      const s=document.getElementById('syncStatus');if(s)s.textContent=label+'…';
      try{
        const ok=await fn.apply(this,arguments);
        if(s)s.textContent=ok?label+' выполнено':label+' не выполнено';
        return ok;
      }catch(e){if(s)s.textContent=label+' — ошибка';throw e;}
    };
    if(typeof window.masterSync8962.pull==='function')window.masterSync8962.pull=wrap(window.masterSync8962.pull,'Загрузка с сервера');
    if(typeof window.masterSync8962.push==='function')window.masterSync8962.push=wrap(window.masterSync8962.push,'Отправка на сервер');
    window.masterSync8962.__feedback8970=true;
  }

  document.documentElement.dataset.interfaceVersion='8.9.70';
})();
