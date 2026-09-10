(()=>{
  'use strict';
  if(window.__uchetCore8933)return;

  const install=()=>{
    if(window.__uchetCore8933)return true;
    if(typeof state==='undefined'||typeof save!=='function'||typeof render!=='function'||typeof norm!=='function')return false;
    window.__uchetCore8933=true;

    const key=id=>String(id);
    const stamp=v=>{
      if(Number.isFinite(+v)&&+v>0)return +v;
      const p=Date.parse(String(v||''));
      return Number.isFinite(p)?p:0;
    };
    const itemStamp=x=>Math.max(stamp(x&&x.updatedAt),stamp(x&&x.ts),stamp(x&&x.id));
    const mergeMarks=(a,b)=>{
      const out={};
      for(const src of [a||{},b||{}])for(const [k,v] of Object.entries(src))out[k]=Math.max(+out[k]||0,+v||0);
      return out;
    };
    const mergeNewest=(remote,local,deleted)=>{
      const m=new Map();
      for(const x of remote||[])m.set(key(x.id),x);
      for(const x of local||[]){const k=key(x.id),prev=m.get(k);if(!prev||itemStamp(x)>=itemStamp(prev))m.set(k,x)}
      for(const [k,x] of [...m]){const d=+deleted[k]||0;if(d&&d>=itemStamp(x))m.delete(k)}
      return [...m.values()];
    };

    state.deletedDealers=state.deletedDealers&&typeof state.deletedDealers==='object'?state.deletedDealers:{};
    state.deletedProducts=state.deletedProducts&&typeof state.deletedProducts==='object'?state.deletedProducts:{};
    localStorage.setItem(KEY,JSON.stringify(state));

    function snapshotDealer(op,d){
      if(!op||!d)return;
      if(!op.dealer)op.dealer=d.name||'';
      if(!op.dealerPhone)op.dealerPhone=d.phone||'';
      if(!op.dealerCity)op.dealerCity=d.city||'';
      if(!op.dealerCompany)op.dealerCompany=d.company||'';
    }
    function dealerFromOp(op){
      return (state.dealers||[]).find(d=>d.id==op?.dealerId)||{
        id:op?.dealerId,
        name:op?.dealer||'Удалённый дилер',
        phone:op?.dealerPhone||'',
        city:op?.dealerCity||'',
        company:op?.dealerCompany||''
      };
    }

    window.deleteDealerPermanent8933=function(id){
      const d=(state.dealers||[]).find(x=>x.id==id);if(!d)return false;
      const related=(state.ops||[]).filter(o=>o.dealerId==id);
      if(!confirm('Удалить карточку дилера «'+d.name+'»?'))return false;
      const msg=related.length
        ?'Карточка исчезнет из списка. '+related.length+' старых продаж/чеков/оплат останутся в истории. Подтвердить удаление карточки?'
        :'Карточка будет полностью удалена из списка. Подтвердить удаление?';
      if(!confirm(msg))return false;
      related.forEach(o=>snapshotDealer(o,d));
      state.deletedDealers=state.deletedDealers||{};
      state.deletedDealers[key(id)]=Date.now();
      state.dealers=(state.dealers||[]).filter(x=>x.id!=id);
      localStorage.setItem(KEY,JSON.stringify(state));
      save();
      try{if(typeof closeDealerModal==='function')closeDealerModal()}catch(_){}
      try{if(typeof renderDealers==='function')renderDealers()}catch(_){}
      setTimeout(()=>{try{if(state.sync?.enabled&&state.sync?.url&&typeof syncPush==='function')syncPush(true)}catch(_){}},80);
      return !(state.dealers||[]).some(x=>x.id==id);
    };

    deleteDealerFromList=function(id){return window.deleteDealerPermanent8933(id)};
    showDealerContextMenu=function(e,id){
      e.preventDefault();e.stopPropagation();
      try{if(typeof hideDealerContextMenu==='function')hideDealerContextMenu()}catch(_){}
      document.getElementById('dealerContextMenu8933')?.remove();
      const m=document.createElement('div');m.id='dealerContextMenu8933';m.className='dealerContextMenu';
      m.style.left=Math.min(e.clientX,window.innerWidth-260)+'px';m.style.top=Math.min(e.clientY,window.innerHeight-120)+'px';
      const edit=document.createElement('button');edit.type='button';edit.textContent='Изменить карточку дилера';
      edit.onclick=()=>{m.remove();if(typeof openDealerForEdit==='function')openDealerForEdit(id);else if(typeof openDealer==='function')openDealer(id)};
      const del=document.createElement('button');del.type='button';del.className='dangerMenuItem';del.textContent='Удалить дилера';
      del.onclick=()=>{m.remove();window.deleteDealerPermanent8933(id)};
      m.append(edit,del);document.body.appendChild(m);
    };

    const oldMerge=typeof mergeSyncState==='function'?mergeSyncState:null;
    window.mergeSyncState8933=function(remote,local){
      remote=norm(remote||{});local=norm(local||{});
      const deletedDealers=mergeMarks(remote.deletedDealers,local.deletedDealers);
      const deletedProducts=mergeMarks(remote.deletedProducts,local.deletedProducts);
      remote.deletedDealers=deletedDealers;
      remote.deletedProducts=deletedProducts;
      remote.dealers=mergeNewest(remote.dealers,local.dealers,deletedDealers);
      remote.groups=mergeNewest(remote.groups,local.groups,{});
      remote.products=mergeNewest(remote.products,local.products,deletedProducts);
      remote.ops=mergeNewest(remote.ops,local.ops,{}).sort((a,b)=>typeof opTime==='function'?opTime(a)-opTime(b):itemStamp(a)-itemStamp(b));
      remote.receiptSeq=Math.max(+remote.receiptSeq||1,+local.receiptSeq||1);
      remote.update=local.update||remote.update;
      remote.newmatros=local.newmatros||remote.newmatros;
      remote.sync=local.sync||remote.sync;
      return norm(remote);
    };
    mergeSyncState=window.mergeSyncState8933;

    const originalAddDealer=typeof addDealer==='function'?addDealer:null;
    if(originalAddDealer&&!originalAddDealer.__8933){
      const wrapped=function(){
        const before=new Set((state.dealers||[]).map(d=>key(d.id)));
        const r=originalAddDealer.apply(this,arguments);
        const d=(state.dealers||[]).find(x=>!before.has(key(x.id)));
        if(d){d.updatedAt=Date.now();if(state.deletedDealers)delete state.deletedDealers[key(d.id)];save()}
        return r;
      };wrapped.__8933=true;addDealer=wrapped;
    }
    const originalSaveDealerEdit=typeof saveDealerEdit==='function'?saveDealerEdit:null;
    if(originalSaveDealerEdit&&!originalSaveDealerEdit.__8933){
      const wrapped=function(id){const d=(state.dealers||[]).find(x=>x.id==id);if(d)d.updatedAt=Date.now();return originalSaveDealerEdit.apply(this,arguments)};
      wrapped.__8933=true;saveDealerEdit=wrapped;
    }
    const originalSaveDealerPhoto=typeof saveDealerPhoto==='function'?saveDealerPhoto:null;
    if(originalSaveDealerPhoto&&!originalSaveDealerPhoto.__8933){
      const wrapped=async function(id){const d=(state.dealers||[]).find(x=>x.id==id);if(d)d.updatedAt=Date.now();return await originalSaveDealerPhoto.apply(this,arguments)};
      wrapped.__8933=true;saveDealerPhoto=wrapped;
    }

    if(typeof showReceiptFromHistory==='function')showReceiptFromHistory=function(id){
      const op=(state.ops||[]).find(x=>x.id==id);if(!op)return;
      const d=dealerFromOp(op);
      receiptViewBody.innerHTML=renderReceiptHtml(op,d);
      receiptViewModal.classList.remove('hidden');
    };
    if(typeof refreshReceiptViews==='function')refreshReceiptViews=function(opId){
      const op=(state.ops||[]).find(x=>x.id==opId);if(!op)return;
      const d=dealerFromOp(op),html=renderReceiptHtml(op,d);
      if(receiptArea?.querySelector?.('[data-receipt-op-id="'+opId+'"]'))receiptArea.innerHTML=html;
      if(receiptViewBody?.querySelector?.('[data-receipt-op-id="'+opId+'"]'))receiptViewBody.innerHTML=html;
    };

    document.addEventListener('click',()=>document.getElementById('dealerContextMenu8933')?.remove());
    window.addEventListener('blur',()=>document.getElementById('dealerContextMenu8933')?.remove());
    document.documentElement.dataset.dealerFix='8.9.33';
    window.uchet8933={deleteDealer:window.deleteDealerPermanent8933,mergeSync:window.mergeSyncState8933,oldMerge};
    return true;
  };

  let tries=0;const t=setInterval(()=>{tries++;if(install()||tries>100)clearInterval(t)},100);
})();
