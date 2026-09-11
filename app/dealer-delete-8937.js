(()=>{
  'use strict';

  const install=()=>{
    if(typeof state==='undefined'||typeof save!=='function'||typeof norm!=='function')return false;
    if(window.__dealerDelete8937Installed)return true;
    window.__dealerDelete8937Installed=true;

    const idKey=id=>String(id);
    const hasOwn=(obj,key)=>Object.prototype.hasOwnProperty.call(obj||{},key);
    const mergeMarks=(a,b)=>{
      const out={};
      for(const src of [a||{},b||{}])for(const [k,v] of Object.entries(src))out[k]=Math.max(+out[k]||0,+v||0);
      return out;
    };

    state.deletedDealers=state.deletedDealers&&typeof state.deletedDealers==='object'?state.deletedDealers:{};
    // 8.9.35 also tombstoned by phone/name. That is unsafe for duplicate cards:
    // deleting one duplicate could hide the other. 8.9.37 uses exact dealer IDs.
    state.deletedDealerKeys={};

    const snapshotDealer=(op,d)=>{
      if(!op||!d)return;
      if(!op.dealer)op.dealer=d.name||'';
      if(!op.dealerPhone)op.dealerPhone=d.phone||'';
      if(!op.dealerCity)op.dealerCity=d.city||'';
      if(!op.dealerCompany)op.dealerCompany=d.company||'';
    };

    const isDeletedId=(d,marks=state.deletedDealers)=>!!(d&&hasOwn(marks,idKey(d.id)));

    function queueSyncPush(){
      if(!state.sync?.url||typeof syncPush!=='function')return;
      let attempts=0;
      const run=()=>{
        attempts++;
        try{
          if(typeof syncBusy!=='undefined'&&syncBusy){
            if(attempts<12)setTimeout(run,300);
            return;
          }
          const r=syncPush(true);
          if(r&&typeof r.catch==='function')r.catch(()=>{if(attempts<12)setTimeout(run,600)});
        }catch(_){if(attempts<12)setTimeout(run,600)}
      };
      setTimeout(run,100);
    }

    function removeDealerNow(id){
      const d=(state.dealers||[]).find(x=>x.id==id);
      if(!d)return false;
      const related=(state.ops||[]).filter(o=>o.dealerId==id);
      if(!confirm('Удалить карточку дилера «'+(d.name||'')+'»?'))return false;
      const detail=related.length
        ?'Карточка будет удалена из списка. '+related.length+' старых продаж, чеков и оплат останутся в истории. Подтвердить удаление?'
        :'Карточка будет удалена из списка. Подтвердить удаление?';
      if(!confirm(detail))return false;

      related.forEach(o=>snapshotDealer(o,d));
      state.deletedDealers=state.deletedDealers&&typeof state.deletedDealers==='object'?state.deletedDealers:{};
      state.deletedDealers[idKey(id)]=Date.now();
      state.dealers=(state.dealers||[]).filter(x=>x.id!=id);

      // Save immediately before any asynchronous sync work.
      localStorage.setItem(KEY,JSON.stringify(state));
      save();

      let persisted={};
      try{persisted=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(_){}
      const absentInState=!(state.dealers||[]).some(x=>x.id==id);
      const absentPersisted=!(persisted.dealers||[]).some(x=>x.id==id);
      const tombstonePersisted=hasOwn(persisted.deletedDealers,idKey(id));
      if(!absentInState||!absentPersisted||!tombstonePersisted){
        try{alert('Не удалось надёжно удалить карточку дилера. Изменения не подтверждены в базе.')}catch(_){}
        return false;
      }

      try{if(typeof closeDealerModal==='function')closeDealerModal()}catch(_){}
      try{if(typeof renderDealers==='function')renderDealers()}catch(_){}
      try{if(typeof renderDebts==='function')renderDebts()}catch(_){}
      queueSyncPush();
      return true;
    }

    const previousMerge=(typeof mergeSyncState==='function'&&!mergeSyncState.__dealer8937)?mergeSyncState:null;
    const fixedMerge=function(remote,local){
      remote=norm(remote||{});local=norm(local||{});
      const deletedDealers=mergeMarks(remote.deletedDealers,local.deletedDealers);
      // Legacy identity tombstones must not erase a duplicate dealer that the user kept.
      remote.deletedDealerKeys={};local.deletedDealerKeys={};
      let merged=previousMerge?previousMerge(remote,local):remote;
      merged=norm(merged||{});
      merged.deletedDealers=deletedDealers;
      merged.deletedDealerKeys={};
      // A manual deletion is final for this exact dealer ID. Never resurrect it
      // merely because an old imported record carries a later-looking timestamp.
      merged.dealers=(merged.dealers||[]).filter(d=>!isDeletedId(d,deletedDealers));
      return merged;
    };
    fixedMerge.__dealer8937=true;

    window.deleteDealerPermanent8937=removeDealerNow;
    window.deleteDealerFromList=removeDealerNow;
    try{deleteDealerFromList=removeDealerNow}catch(_){}

    window.mergeSyncState=fixedMerge;
    try{mergeSyncState=fixedMerge}catch(_){}

    window.showDealerContextMenu=function(e,id){
      e.preventDefault();e.stopPropagation();
      try{if(typeof hideDealerContextMenu==='function')hideDealerContextMenu()}catch(_){}
      document.getElementById('dealerContextMenu')?.remove();
      document.getElementById('dealerContextMenu8933')?.remove();
      const m=document.createElement('div');
      m.id='dealerContextMenu';m.className='dealerContextMenu';
      m.style.left=Math.min(e.clientX,window.innerWidth-260)+'px';
      m.style.top=Math.min(e.clientY,window.innerHeight-120)+'px';

      const edit=document.createElement('button');
      edit.type='button';edit.textContent='Изменить карточку дилера';
      edit.onclick=()=>{
        m.remove();
        if(typeof openDealerForEdit==='function')openDealerForEdit(id);
        else if(typeof openDealer==='function')openDealer(id);
      };

      const del=document.createElement('button');
      del.type='button';del.className='dangerMenuItem';del.textContent='Удалить дилера';
      del.onclick=()=>{m.remove();removeDealerNow(id)};
      m.append(edit,del);document.body.appendChild(m);
    };
    try{showDealerContextMenu=window.showDealerContextMenu}catch(_){}

    // Apply existing exact-ID tombstones immediately when this final handler is installed.
    const before=(state.dealers||[]).length;
    state.dealers=(state.dealers||[]).filter(d=>!isDeletedId(d));
    localStorage.setItem(KEY,JSON.stringify(state));
    if(state.dealers.length!==before)save();

    document.documentElement.dataset.dealerFix='8.9.37';
    window.__dealerDelete8937={removeDealerNow,mergeSyncState:fixedMerge};
    return true;
  };

  let tries=0;
  const timer=setInterval(()=>{tries++;if(install()||tries>120)clearInterval(timer)},100);
})();
