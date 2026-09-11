(()=>{
  'use strict';
  if(window.__stableFix8938Installed)return;
  window.__stableFix8938Installed=true;

  const style=document.createElement('style');
  style.id='stableFix8938Style';
  style.textContent=`
    #products{overflow:visible!important;max-width:100%!important}
    #products .productTableScroll8938{overflow:auto!important;max-width:100%!important;max-height:calc(100vh - 300px)!important;scrollbar-gutter:stable both-edges;border:1px solid #d8dee7;background:#fff}
    #products .productTable{table-layout:auto!important;width:max-content!important;min-width:1280px!important;margin:0!important;border:0!important}
    #products .productTable th,#products .productTable td{overflow:visible!important;text-overflow:clip!important;white-space:nowrap!important;min-width:90px!important;max-width:none!important}
    #products .productTable th:nth-child(1),#products .productTable td:nth-child(1){min-width:150px!important}
    #products .productTable th:nth-child(2),#products .productTable td:nth-child(2){min-width:120px!important}
    #products .productTable th:nth-child(3),#products .productTable td:nth-child(3){min-width:300px!important;white-space:normal!important}
    #products .productTable th:nth-child(4),#products .productTable td:nth-child(4){min-width:110px!important}
    #products .productTable th:nth-child(5),#products .productTable td:nth-child(5){min-width:80px!important}
    #products .productTable th:nth-child(6),#products .productTable td:nth-child(6),#products .productTable th:nth-child(7),#products .productTable td:nth-child(7),#products .productTable th:nth-child(8),#products .productTable td:nth-child(8){min-width:120px!important}
    #products .productTable th:nth-child(9),#products .productTable td:nth-child(9){min-width:170px!important}
    #products .productTable thead th{position:sticky;top:0;z-index:2;background:#f4f6f8!important}
    #products .productTableScroll8938::-webkit-scrollbar{height:14px;width:14px}
    #products .productTableScroll8938::-webkit-scrollbar-thumb{background:#9aa7b3;border-radius:8px;border:3px solid #eef1f4}
    #products .productTableScroll8938::-webkit-scrollbar-track{background:#eef1f4}
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
  document.documentElement.dataset.stableFix='8.9.38';
})();
