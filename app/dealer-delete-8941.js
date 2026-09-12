(()=>{
  'use strict';
  if(window.__dealerDelete8941Installed)return;

  const install=()=>{
    if(typeof state==='undefined'||typeof save!=='function'||typeof norm!=='function')return false;

    const idKey=id=>String(id);
    const hasOwn=(obj,key)=>Object.prototype.hasOwnProperty.call(obj||{},key);
    const mergeMarks=(a,b)=>{
      const out={};
      for(const src of [a||{},b||{}])for(const [k,v] of Object.entries(src))out[String(k)]=Math.max(+out[String(k)]||0,+v||0);
      return out;
    };
    const findDealer=id=>(state.dealers||[]).find(x=>String(x.id)===String(id));
    const isDeleted=(id,marks=state.deletedDealers)=>hasOwn(marks||{},idKey(id));
    const snapshotDealer=(op,d)=>{
      if(!op||!d)return;
      if(!op.dealer)op.dealer=d.name||'';
      if(!op.dealerPhone)op.dealerPhone=d.phone||'';
      if(!op.dealerCity)op.dealerCity=d.city||'';
      if(!op.dealerCompany)op.dealerCompany=d.company||'';
    };

    const persist=()=>{
      state.deletedDealers=state.deletedDealers&&typeof state.deletedDealers==='object'?state.deletedDealers:{};
      state.deletedDealerKeys={};
      localStorage.setItem(KEY,JSON.stringify(state));
      try{save()}catch(_){}
    };

    const enforceTombstones=()=>{
      state.deletedDealers=state.deletedDealers&&typeof state.deletedDealers==='object'?state.deletedDealers:{};
      const before=(state.dealers||[]).length;
      state.dealers=(state.dealers||[]).filter(d=>!isDeleted(d.id));
      return before!==(state.dealers||[]).length;
    };

    const previousMerge=typeof mergeSyncState==='function'?mergeSyncState:null;
    const guardedMerge=function(remote,local){
      remote=norm(remote||{});
      local=norm(local||{});
      const marks=mergeMarks(remote.deletedDealers,local.deletedDealers);
      remote.deletedDealers=marks;
      local.deletedDealers=marks;
      remote.deletedDealerKeys={};
      local.deletedDealerKeys={};
      let merged=previousMerge?previousMerge(remote,local):local;
      merged=norm(merged||{});
      merged.deletedDealers=marks;
      merged.deletedDealerKeys={};
      merged.dealers=(merged.dealers||[]).filter(d=>!isDeleted(d.id,marks));
      return merged;
    };
    guardedMerge.__dealer8941=true;
    window.mergeSyncState=guardedMerge;
    try{mergeSyncState=guardedMerge}catch(_){}

    const refresh=()=>{
      try{if(typeof render==='function')render()}catch(_){}
      try{if(typeof renderDealers==='function')renderDealers()}catch(_){}
      try{if(typeof renderDebts==='function')renderDebts()}catch(_){}
      try{if(typeof renderPaymentDealers==='function')renderPaymentDealers()}catch(_){}
    };

    const verifyAfterSync=async id=>{
      let attempts=0;
      const run=async()=>{
        attempts++;
        try{
          enforceTombstones();
          localStorage.setItem(KEY,JSON.stringify(state));
          if(state.sync?.url&&typeof syncPush==='function')await syncPush(true);
          enforceTombstones();
          localStorage.setItem(KEY,JSON.stringify(state));
          if(state.sync?.url&&typeof syncPull==='function')await syncPull(false);
          const returned=findDealer(id);
          if(returned){
            state.deletedDealers=state.deletedDealers&&typeof state.deletedDealers==='object'?state.deletedDealers:{};
            state.deletedDealers[idKey(id)]=Math.max(+state.deletedDealers[idKey(id)]||0,Date.now());
            state.dealers=(state.dealers||[]).filter(d=>String(d.id)!==String(id));
            persist();
            if(attempts<4)return setTimeout(run,700);
          }
          refresh();
        }catch(_){if(attempts<4)setTimeout(run,900)}
      };
      setTimeout(run,120);
    };

    function removeDealerNow8941(id){
      const d=findDealer(id);
      if(!d)return false;
      const related=(state.ops||[]).filter(o=>String(o.dealerId)===String(id));
      if(!confirm('Удалить карточку дилера «'+(d.name||'')+'»?'))return false;
      const detail=related.length
        ?'Карточка будет удалена. '+related.length+' старых продаж, чеков и оплат останутся в истории. Подтвердить окончательное удаление?'
        :'Карточка будет удалена. Подтвердить окончательное удаление?';
      if(!confirm(detail))return false;

      related.forEach(o=>snapshotDealer(o,d));
      state.deletedDealers=state.deletedDealers&&typeof state.deletedDealers==='object'?state.deletedDealers:{};
      state.deletedDealerKeys={};
      state.deletedDealers[idKey(id)]=Date.now();
      state.dealers=(state.dealers||[]).filter(x=>String(x.id)!==String(id));
      persist();
      enforceTombstones();
      localStorage.setItem(KEY,JSON.stringify(state));

      try{document.querySelectorAll('#dealerRows tr').forEach(row=>{if(String(row.dataset.dealerId||'')===String(id))row.remove()})}catch(_){}
      try{if(typeof closeDealerModal==='function')closeDealerModal()}catch(_){}
      refresh();
      verifyAfterSync(id);
      return !findDealer(id)&&isDeleted(id);
    }

    const closeMenus=()=>{
      document.getElementById('dealerContextMenu')?.remove();
      document.getElementById('dealerContextMenu8933')?.remove();
      document.getElementById('dealerContextMenu8938')?.remove();
      document.getElementById('dealerContextMenu8941')?.remove();
    };

    const rowId=row=>{
      if(!row)return null;
      if(row.dataset.dealerId)return row.dataset.dealerId;
      const attr=(row.getAttribute('oncontextmenu')||'')+' '+(row.getAttribute('onclick')||'');
      const m=attr.match(/(?:showDealerContextMenu\(event,|openDealer\()\s*([^\)]+)\)/);
      if(!m)return null;
      let id=m[1].trim();
      if(/^['"].*['"]$/.test(id))id=id.slice(1,-1);
      return id;
    };

    const tagRows=()=>{
      document.querySelectorAll('#dealerRows tr').forEach(row=>{
        const id=rowId(row);
        if(id!==null&&id!==undefined&&id!=='')row.dataset.dealerId=String(id);
      });
    };

    const showMenu=(e,id)=>{
      e.preventDefault();
      e.stopPropagation();
      try{e.stopImmediatePropagation()}catch(_){}
      closeMenus();
      const m=document.createElement('div');
      m.id='dealerContextMenu8941';
      m.className='dealerContextMenu';
      m.style.left=Math.min(e.clientX,window.innerWidth-270)+'px';
      m.style.top=Math.min(e.clientY,window.innerHeight-130)+'px';
      const edit=document.createElement('button');
      edit.type='button';edit.textContent='Изменить карточку дилера';
      edit.onclick=()=>{m.remove();if(typeof openDealerForEdit==='function')openDealerForEdit(id);else if(typeof openDealer==='function')openDealer(id)};
      const del=document.createElement('button');
      del.type='button';del.className='dangerMenuItem';del.textContent='Удалить дилера';
      del.onclick=()=>{m.remove();removeDealerNow8941(id)};
      m.append(edit,del);document.body.appendChild(m);
    };

    // Remove the 8.9.39 capture listener so this real-world handler is the final one.
    try{
      const old=window.__dealerDelete8939?.finalContextMenuCapture;
      if(old)window.removeEventListener('contextmenu',old,true);
    }catch(_){}

    const finalCapture=e=>{
      const row=e.target?.closest?.('#dealerRows tr');
      if(!row)return;
      const id=rowId(row);
      if(id===null||id===undefined||id==='')return;
      row.dataset.dealerId=String(id);
      showMenu(e,id);
    };
    window.addEventListener('contextmenu',finalCapture,true);

    const body=document.getElementById('dealerRows');
    if(body)new MutationObserver(tagRows).observe(body,{childList:true,subtree:true});
    tagRows();

    window.deleteDealerFromList=removeDealerNow8941;
    window.deleteDealerPermanent8941=removeDealerNow8941;
    window.showDealerContextMenu=showMenu;
    try{deleteDealerFromList=removeDealerNow8941}catch(_){}
    try{showDealerContextMenu=showMenu}catch(_){}

    enforceTombstones();
    localStorage.setItem(KEY,JSON.stringify(state));
    refresh();

    window.__dealerDelete8941Installed=true;
    window.__dealerDelete8941={removeDealerNow:removeDealerNow8941,guardedMerge,finalCapture,tagRows,enforceTombstones};
    document.documentElement.dataset.dealerFix='8.9.41';
    return true;
  };

  let tries=0;
  const timer=setInterval(()=>{tries++;if(install()||tries>160)clearInterval(timer)},100);
})();
