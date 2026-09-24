(()=>{
  'use strict';
  if(window.__release8973Installed)return;
  window.__release8973Installed=true;

  const esc8973=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function findColumn8973(root,label){
    const headers=[...root.querySelectorAll('table thead th')];
    const needle=String(label).toLocaleLowerCase('ru');
    return headers.findIndex(th=>String(th.textContent||'').trim().toLocaleLowerCase('ru').includes(needle));
  }

  function nameInput8973(op,item,index){
    const input=document.createElement('input');
    input.type='text';
    input.className='receiptNameInput8973';
    input.value=item.name||'';
    input.title='Название можно менять произвольно';
    input.onchange=()=>{
      if(typeof window.editReceiptItemName8973==='function')window.editReceiptItemName8973(op.id,index,input.value);
    };
    input.ondblclick=()=>{input.focus();input.select()};
    input.onkeydown=e=>{
      if(e.key==='Enter'){e.preventDefault();input.blur()}
      else if(e.key==='Escape'){e.preventDefault();input.value=item.name||'';input.blur()}
    };
    return input;
  }

  function qtyCell8973(cell,op,item,index){
    const guard=document.createElement('span');
    guard.hidden=true;
    guard.className='receiptNameInput8973 receiptNameGuard8973';
    const input=document.createElement('input');
    input.className='receiptEditInput';
    input.type='number';
    input.min='0.01';
    input.step='0.01';
    input.value=Number(item.qty)||0;
    input.onchange=()=>editReceiptItem(op.id,index,'qty',input.value);
    cell.replaceChildren(guard,input,document.createTextNode(' '+(item.unit||'шт')));
  }

  function priceCell8973(cell,op,item,index){
    const input=document.createElement('input');
    input.className='receiptEditInput';
    input.type='number';
    input.min='0';
    input.step='0.01';
    input.value=Number(item.price)||0;
    input.onchange=()=>editReceiptItem(op.id,index,'price',input.value);
    cell.replaceChildren(input);
  }

  function repairReceipt8973(root){
    if(!root||!root.matches?.('[data-receipt-op-id]')||root.dataset.receipt8973Fixed==='1')return;
    const op=(state.ops||[]).find(x=>String(x.id)===String(root.dataset.receiptOpId)&&x.type==='sale');
    if(!op)return;
    const nameCol=findColumn8973(root,'наименование');
    const qtyCol=findColumn8973(root,'кол-во');
    const priceCol=findColumn8973(root,'цена');
    if(nameCol<0||qtyCol<0||priceCol<0)return;

    const rows=[...root.querySelectorAll('table tbody tr')];
    rows.forEach((tr,index)=>{
      const item=op.items?.[index];if(!item)return;
      const nameCell=tr.children?.[nameCol],qtyCell=tr.children?.[qtyCol],priceCell=tr.children?.[priceCol];
      if(nameCell)nameCell.replaceChildren(nameInput8973(op,item,index));
      if(qtyCell)qtyCell8973(qtyCell,op,item,index);
      if(priceCell)priceCell8973(priceCell,op,item,index);
    });

    const help=root.querySelector('.receiptEditHelp');
    if(help)help.textContent='Название, количество и цену можно изменить прямо в накладной — сумма и долг пересчитаются автоматически.';

    const actions=root.querySelector('.actions');
    if(actions&&!actions.querySelector('.manualReceiptBtn8973')&&typeof window.openReceiptManualAdd8973==='function'){
      const button=document.createElement('button');
      button.type='button';
      button.className='secondary manualReceiptBtn8973';
      button.textContent='＋ Своя позиция';
      button.onclick=()=>window.openReceiptManualAdd8973(op.id);
      const danger=actions.querySelector('.dangerBtn');
      if(danger)actions.insertBefore(button,danger);else actions.appendChild(button);
    }
    root.dataset.receipt8973Fixed='1';
  }

  function repairAll8973(){
    document.querySelectorAll('[data-receipt-op-id]').forEach(repairReceipt8973);
  }

  const observer=new MutationObserver(()=>queueMicrotask(repairAll8973));
  observer.observe(document.body,{childList:true,subtree:true});
  repairAll8973();

  const baseRefresh=window.refreshReceiptViews;
  if(typeof baseRefresh==='function'){
    window.refreshReceiptViews=function(opId){
      const result=baseRefresh.apply(this,arguments);
      queueMicrotask(repairAll8973);
      return result;
    };
    try{refreshReceiptViews=window.refreshReceiptViews}catch(_){}
  }

  // Re-apply compact widths after any product-table rerender.
  function compactProducts8973(){
    const table=document.querySelector('#products .productTable');if(!table)return;
    const headers=[...table.querySelectorAll('thead th')];
    for(const [label,width] of [['Группа','78px'],['Артикул','82px']]){
      const index=headers.findIndex(th=>String(th.textContent||'').trim()===label);if(index<0)continue;
      const th=headers[index];th.style.width=width;th.style.minWidth=width;th.style.maxWidth=width;
      table.querySelectorAll('tbody tr').forEach(tr=>{const td=tr.children?.[index];if(td){td.style.width=width;td.style.minWidth=width;td.style.maxWidth=width;td.style.whiteSpace='nowrap';td.style.overflow='hidden';td.style.textOverflow='ellipsis'}});
    }
  }
  new MutationObserver(()=>queueMicrotask(compactProducts8973)).observe(document.getElementById('products')||document.body,{childList:true,subtree:true});
  compactProducts8973();

  document.documentElement.dataset.uchetRuntime='8.9.73';
})();
