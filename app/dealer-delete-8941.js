(()=>{
  'use strict';
  if(window.__dealerDelete8941Installed)return;

  const install=()=>{
    if(typeof state==='undefined'||typeof save!=='function'||typeof norm!=='function')return false;

    const style=document.createElement('style');
    style.id='dealerDelete8941Style';
    style.textContent=`
      #dealerRows tr.dealerDeleteSelected8941 td{background:#dcecff!important;box-shadow:inset 0 2px 0 #1667d9,inset 0 -2px 0 #1667d9}
      #dealerRows tr.dealerDeleteSelected8941 td:first-child{box-shadow:inset 4px 0 0 #1667d9,inset 0 2px 0 #1667d9,inset 0 -2px 0 #1667d9}
      #dealerContextMenu8941 .dealerLockedName8941{padding:8px 11px 7px;font-size:12px;font-weight:800;color:#36506f;border-bottom:1px solid #e6eaf0;margin-bottom:4px;white-space:normal;max-width:310px}
    `;
    if(!document.getElementById(style.id))document.head.appendChild(style);

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

    function removeDealerNow8941(id,expectedName){
      const lockedId=String(id);
      const d=findDealer(lockedId);
      if(!d){
        try{alert('Не удалось найти выбранного дилера. Удаление отменено, чтобы не удалить другую карточку.')}catch(_){}
        return false;
      }
      // Safety against any accidental row/selection jump: never switch to another dealer.
      if(expectedName!=null&&String(d.name||'')!==String(expectedName||'')){
        try{alert('Выбранная строка изменилась. Удаление отменено, чтобы не удалить другого дилера.')}catch(_){}
        return false;
      }
      const related=(state.ops||[]).filter(o=>String(o.dealerId)===lockedId);
      if(!confirm('Удалить карточку дилера «'+(d.name||'')+'»?'))return false;
      const detail=related.length
        ?'Удаляется именно «'+(d.name||'')+'». '+related.length+' старых продаж, чеков и оплат останутся в истории. Подтвердить окончательное удаление?'
        :'Удаляется именно «'+(d.name||'')+'». Подтвердить окончательное удаление?';
      if(!confirm(detail))return false;

      related.forEach(o=>snapshotDealer(o,d));
      state.deletedDealers=state.deletedDealers&&typeof state.deletedDealers==='object'?state.deletedDealers:{};
      state.deletedDealerKeys={};
      state.deletedDealers[idKey(lockedId)]=Date.now();
      state.dealers=(state.dealers||[]).filter(x=>String(x.id)!==lockedId);
      persist();
      enforceTombstones();
      localStorage.setItem(KEY,JSON.stringify(state));

      try{document.querySelectorAll('#dealerRows tr').forEach(row=>{if(String(row.dataset.dealerId||'')===lockedId)row.remove()})}catch(_){}
      try{if(typeof closeDealerModal==='function')closeDealerModal()}catch(_){}
      refresh();
      verifyAfterSync(lockedId);
      return !findDealer(lockedId)&&isDeleted(lockedId);
    }

    let lockedSelection=null;
    const clearLockedSelection=()=>{
      document.querySelectorAll('#dealerRows tr.dealerDeleteSelected8941').forEach(r=>r.classList.remove('dealerDeleteSelected8941'));
      lockedSelection=null;
    };

    const closeMenus=(keepSelection=false)=>{
      document.getElementById('dealerContextMenu')?.remove();
      document.getElementById('dealerContextMenu8933')?.remove();
      document.getElementById('dealerContextMenu8938')?.remove();
      document.getElementById('dealerContextMenu8941')?.remove();
      if(!keepSelection)clearLockedSelection();
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
      if(lockedSelection){
        const current=[...document.querySelectorAll('#dealerRows tr')].find(r=>String(r.dataset.dealerId||'')===lockedSelection.id);
        if(current)current.classList.add('dealerDeleteSelected8941');
      }
    };

    const lockDealer=(row,id)=>{
      const lockedId=String(id);
      const d=findDealer(lockedId);
      if(!d)return null;
      document.querySelectorAll('#dealerRows tr.dealerDeleteSelected8941').forEach(r=>r.classList.remove('dealerDeleteSelected8941'));
      row.dataset.dealerId=lockedId;
      row.classList.add('dealerDeleteSelected8941');
      lockedSelection={id:lockedId,name:String(d.name||''),phone:String(d.phone||'')};
      return {...lockedSelection};
    };

    const showMenu=(e,id,row)=>{
      e.preventDefault();
      e.stopPropagation();
      try{e.stopImmediatePropagation()}catch(_){}
      closeMenus(true);
      const locked=row?lockDealer(row,id):(()=>{const d=findDealer(id);return d?{id:String(id),name:String(d.name||''),phone:String(d.phone||'')}:null})();
      if(!locked)return;
      lockedSelection=locked;

      const m=document.createElement('div');
      m.id='dealerContextMenu8941';
      m.className='dealerContextMenu';
      m.style.left=Math.min(e.clientX,window.innerWidth-320)+'px';
      m.style.top=Math.min(e.clientY,window.innerHeight-160)+'px';
      // Keep all menu pointer events away from the table beneath it.
      ['pointerdown','mousedown','mouseup','click','contextmenu'].forEach(type=>m.addEventListener(type,ev=>ev.stopPropagation()));

      const lockedName=document.createElement('div');
      lockedName.className='dealerLockedName8941';
      lockedName.textContent='Выбран: '+locked.name+(locked.phone?' · '+locked.phone:'');

      const edit=document.createElement('button');
      edit.type='button';edit.textContent='Изменить карточку дилера';
      edit.onclick=ev=>{ev.preventDefault();ev.stopPropagation();const target={...locked};closeMenus();if(typeof openDealerForEdit==='function')openDealerForEdit(target.id);else if(typeof openDealer==='function')openDealer(target.id)};
      const del=document.createElement('button');
      del.type='button';del.className='dangerMenuItem';del.textContent='Удалить именно «'+locked.name+'»';
      del.onclick=ev=>{
        ev.preventDefault();ev.stopPropagation();
        const target={...locked};
        document.getElementById('dealerContextMenu8941')?.remove();
        const ok=removeDealerNow8941(target.id,target.name);
        clearLockedSelection();
        return ok;
      };
      m.append(lockedName,edit,del);document.body.appendChild(m);
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
      showMenu(e,String(id),row);
    };
    window.addEventListener('contextmenu',finalCapture,true);

    const body=document.getElementById('dealerRows');
    if(body)new MutationObserver(tagRows).observe(body,{childList:true,subtree:true});
    tagRows();

    window.deleteDealerFromList=(id)=>removeDealerNow8941(id,null);
    window.deleteDealerPermanent8941=removeDealerNow8941;
    window.showDealerContextMenu=(e,id)=>showMenu(e,String(id),e?.target?.closest?.('#dealerRows tr')||null);
    try{deleteDealerFromList=window.deleteDealerFromList}catch(_){}
    try{showDealerContextMenu=window.showDealerContextMenu}catch(_){}

    enforceTombstones();
    localStorage.setItem(KEY,JSON.stringify(state));
    refresh();

    window.__dealerDelete8941Installed=true;
    window.__dealerDelete8941={removeDealerNow:removeDealerNow8941,guardedMerge,finalCapture,tagRows,enforceTombstones,lockDealer,getLocked:()=>lockedSelection&&({...lockedSelection})};
    document.documentElement.dataset.dealerFix='8.9.41';
    return true;
  };

  let tries=0;
  const timer=setInterval(()=>{tries++;if(install()||tries>160)clearInterval(timer)},100);
})();
