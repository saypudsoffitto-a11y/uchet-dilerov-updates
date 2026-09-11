(()=>{
  const install=()=>{
    if(typeof state==='undefined'||typeof save!=='function'||typeof norm!=='function')return false;
    if(window.__dealerFix8935)return true;
    window.__dealerFix8935=true;

    const idKey=id=>String(id);
    const normText=v=>String(v||'').trim().toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ');
    const normPhone=v=>String(v||'').replace(/\D/g,'').replace(/^8(?=\d{10}$)/,'7');
    const dealerIdentity=d=>{
      const p=normPhone(d&&d.phone);
      if(p)return 'p:'+p;
      const n=normText(d&&d.name);
      return n?'n:'+n:'';
    };
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

    state.deletedDealers=state.deletedDealers&&typeof state.deletedDealers==='object'?state.deletedDealers:{};
    state.deletedDealerKeys=state.deletedDealerKeys&&typeof state.deletedDealerKeys==='object'?state.deletedDealerKeys:{};

    function isDeletedDealer(d,marks=state.deletedDealers,keyMarks=state.deletedDealerKeys){
      if(!d)return false;
      const byId=+marks[idKey(d.id)]||0;
      const ident=dealerIdentity(d);
      const byKey=ident?(+keyMarks[ident]||0):0;
      const deletedAt=Math.max(byId,byKey);
      return !!deletedAt && deletedAt>=itemStamp(d);
    }

    function snapshotDealer(op,d){
      if(!op||!d)return;
      if(!op.dealer)op.dealer=d.name||'';
      if(!op.dealerPhone)op.dealerPhone=d.phone||'';
      if(!op.dealerCity)op.dealerCity=d.city||'';
      if(!op.dealerCompany)op.dealerCompany=d.company||'';
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

      const now=Date.now();
      related.forEach(o=>snapshotDealer(o,d));
      state.deletedDealers=state.deletedDealers||{};
      state.deletedDealerKeys=state.deletedDealerKeys||{};
      state.deletedDealers[idKey(id)]=now;
      const ident=dealerIdentity(d);if(ident)state.deletedDealerKeys[ident]=now;
      state.dealers=(state.dealers||[]).filter(x=>x.id!=id);

      localStorage.setItem(KEY,JSON.stringify(state));
      save();
      try{if(typeof closeDealerModal==='function')closeDealerModal()}catch(_){}
      try{if(typeof renderDealers==='function')renderDealers()}catch(_){}
      try{if(typeof renderDebts==='function')renderDebts()}catch(_){}
      setTimeout(()=>{try{if(state.sync?.url&&typeof syncPush==='function')syncPush(true)}catch(_){}},80);
      return !(state.dealers||[]).some(x=>x.id==id);
    }

    window.deleteDealerPermanent8935=removeDealerNow;
    window.deleteDealerFromList=removeDealerNow;
    try{deleteDealerFromList=removeDealerNow}catch(_){}

    window.showDealerContextMenu=function(e,id){
      e.preventDefault();e.stopPropagation();
      try{if(typeof hideDealerContextMenu==='function')hideDealerContextMenu()}catch(_){}
      document.getElementById('dealerContextMenu')?.remove();
      document.getElementById('dealerContextMenu8933')?.remove();
      const m=document.createElement('div');
      m.id='dealerContextMenu';m.className='dealerContextMenu';
      m.style.left=Math.min(e.clientX,window.innerWidth-260)+'px';
      m.style.top=Math.min(e.clientY,window.innerHeight-120)+'px';
      const edit=document.createElement('button');edit.type='button';edit.textContent='Изменить карточку дилера';
      edit.onclick=()=>{m.remove();if(typeof openDealerForEdit==='function')openDealerForEdit(id);else if(typeof openDealer==='function')openDealer(id)};
      const del=document.createElement('button');del.type='button';del.className='dangerMenuItem';del.textContent='Удалить дилера';
      del.onclick=()=>{m.remove();removeDealerNow(id)};
      m.append(edit,del);document.body.appendChild(m);
    };
    try{showDealerContextMenu=window.showDealerContextMenu}catch(_){}

    const baseMerge=typeof mergeSyncState==='function'?mergeSyncState:null;
    const fixedMerge=function(remote,local){
      remote=norm(remote||{});local=norm(local||{});
      const deletedDealers=mergeMarks(remote.deletedDealers,local.deletedDealers);
      const deletedDealerKeys=mergeMarks(remote.deletedDealerKeys,local.deletedDealerKeys);
      let merged=baseMerge?baseMerge(remote,local):remote;
      merged=norm(merged||{});
      merged.deletedDealers=deletedDealers;
      merged.deletedDealerKeys=deletedDealerKeys;
      merged.dealers=(merged.dealers||[]).filter(d=>!isDeletedDealer(d,deletedDealers,deletedDealerKeys));
      return merged;
    };
    window.mergeSyncState=fixedMerge;
    try{mergeSyncState=fixedMerge}catch(_){}

    const originalAddDealer=typeof addDealer==='function'?addDealer:null;
    if(originalAddDealer&&!originalAddDealer.__8935){
      const wrapped=function(){
        const before=new Set((state.dealers||[]).map(d=>idKey(d.id)));
        const r=originalAddDealer.apply(this,arguments);
        const d=(state.dealers||[]).find(x=>!before.has(idKey(x.id)));
        if(d){
          d.updatedAt=Date.now();
          delete state.deletedDealers?.[idKey(d.id)];
          const ident=dealerIdentity(d);if(ident&&state.deletedDealerKeys)delete state.deletedDealerKeys[ident];
          save();
        }
        return r;
      };
      wrapped.__8935=true;
      window.addDealer=wrapped;try{addDealer=wrapped}catch(_){}
    }

    const originalImport=typeof importNewMatRosClientRows==='function'?importNewMatRosClientRows:null;
    if(originalImport&&!originalImport.__8935){
      const wrapped=function(){
        const r=originalImport.apply(this,arguments);
        const before=(state.dealers||[]).length;
        state.dealers=(state.dealers||[]).filter(d=>!isDeletedDealer(d));
        if(state.dealers.length!==before)save();
        return r;
      };
      wrapped.__8935=true;
      window.importNewMatRosClientRows=wrapped;try{importNewMatRosClientRows=wrapped}catch(_){}
    }

    state.dealers=(state.dealers||[]).filter(d=>!isDeletedDealer(d));
    localStorage.setItem(KEY,JSON.stringify(state));
    try{render()}catch(_){}
    document.documentElement.dataset.dealerFix='8.9.35';
    return true;
  };

  let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>120)clearInterval(timer)},100);
})();
