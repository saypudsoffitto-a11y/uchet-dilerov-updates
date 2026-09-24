(()=>{
  'use strict';
  if(window.__release8973Installed)return;
  window.__release8973Installed=true;

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

  function ensureNameCell8973(cell,op,item,index){
    const existing=cell.querySelector('input.receiptNameInput8973:not(.receiptNameGuard8973)');
    if(existing){
      if(document.activeElement!==existing&&existing.value!==(item.name||''))existing.value=item.name||'';
      return;
    }
    cell.replaceChildren(nameInput8973(op,item,index));
  }

  function ensureQtyCell8973(cell,op,item,index){
    const guard=cell.querySelector('.receiptNameGuard8973');
    const existing=cell.querySelector('input.receiptEditInput');
    if(guard&&existing){
      const wanted=String(Number(item.qty)||0);
      if(document.activeElement!==existing&&existing.value!==wanted)existing.value=wanted;
      return;
    }
    const nextGuard=document.createElement('span');
    nextGuard.hidden=true;
    nextGuard.className='receiptNameInput8973 receiptNameGuard8973';
    const input=document.createElement('input');
    input.className='receiptEditInput';
    input.type='number';
    input.min='0.01';
    input.step='0.01';
    input.value=Number(item.qty)||0;
    input.onchange=()=>editReceiptItem(op.id,index,'qty',input.value);
    cell.replaceChildren(nextGuard,input,document.createTextNode(' '+(item.unit||'шт')));
  }

  function ensurePriceCell8973(cell,op,item,index){
    const existing=cell.querySelector('input.receiptEditInput');
    if(existing){
      const wanted=String(Number(item.price)||0);
      if(document.activeElement!==existing&&existing.value!==wanted)existing.value=wanted;
      return;
    }
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
    if(!root||!root.matches?.('[data-receipt-op-id]'))return;
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
      if(nameCell)ensureNameCell8973(nameCell,op,item,index);
      if(qtyCell)ensureQtyCell8973(qtyCell,op,item,index);
      if(priceCell)ensurePriceCell8973(priceCell,op,item,index);
    });

    const help=root.querySelector('.receiptEditHelp');
    const helpText='Название, количество и цену можно изменить прямо в накладной — сумма и долг пересчитаются автоматически.';
    if(help&&help.textContent!==helpText)help.textContent=helpText;

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

  let repairQueued8973=false;
  const queueRepair8973=()=>{
    if(repairQueued8973)return;
    repairQueued8973=true;
    queueMicrotask(()=>{repairQueued8973=false;repairAll8973()});
  };
  const observer=new MutationObserver(queueRepair8973);
  observer.observe(document.body,{childList:true,subtree:true});
  repairAll8973();

  const baseRefresh=window.refreshReceiptViews;
  if(typeof baseRefresh==='function'){
    window.refreshReceiptViews=function(opId){
      const result=baseRefresh.apply(this,arguments);
      queueRepair8973();
      return result;
    };
    try{refreshReceiptViews=window.refreshReceiptViews}catch(_){}
  }

  function compactProducts8973(){
    const table=document.querySelector('#products .productTable');if(!table)return;
    const headers=[...table.querySelectorAll('thead th')];
    for(const [label,width] of [['Группа','78px'],['Артикул','82px']]){
      const index=headers.findIndex(th=>String(th.textContent||'').trim()===label);if(index<0)continue;
      const th=headers[index];
      if(th.style.width!==width){th.style.width=width;th.style.minWidth=width;th.style.maxWidth=width}
      table.querySelectorAll('tbody tr').forEach(tr=>{
        const td=tr.children?.[index];if(!td)return;
        if(td.style.width!==width){td.style.width=width;td.style.minWidth=width;td.style.maxWidth=width;td.style.whiteSpace='nowrap';td.style.overflow='hidden';td.style.textOverflow='ellipsis'}
      });
    }
  }
  let compactQueued8973=false;
  const queueCompact8973=()=>{
    if(compactQueued8973)return;
    compactQueued8973=true;
    queueMicrotask(()=>{compactQueued8973=false;compactProducts8973()});
  };
  new MutationObserver(queueCompact8973).observe(document.getElementById('products')||document.body,{childList:true,subtree:true});
  compactProducts8973();

  document.documentElement.dataset.interfaceVersion='8.9.73';
  document.documentElement.dataset.uchetRuntime='8.9.73';
})();
