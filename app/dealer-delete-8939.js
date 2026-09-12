(()=>{
  'use strict';
  if(window.__dealerDelete8939Installed)return;

  const install=()=>{
    const verified=window.__dealerDelete8937;
    if(!verified||typeof verified.removeDealerNow!=='function')return false;

    const removeDealerNow=verified.removeDealerNow;
    const mergeDealerState=typeof verified.mergeSyncState==='function'?verified.mergeSyncState:null;

    window.deleteDealerFromList=removeDealerNow;
    window.deleteDealerPermanent8939=removeDealerNow;
    try{deleteDealerFromList=removeDealerNow}catch(_){}

    if(mergeDealerState){
      window.mergeSyncState=mergeDealerState;
      try{mergeSyncState=mergeDealerState}catch(_){}
    }

    const closeMenus=()=>{
      document.getElementById('dealerContextMenu')?.remove();
      document.getElementById('dealerContextMenu8933')?.remove();
      document.getElementById('dealerContextMenu8938')?.remove();
    };

    const showMenu=(e,id)=>{
      e.preventDefault();
      e.stopPropagation();
      closeMenus();

      const m=document.createElement('div');
      m.id='dealerContextMenu';
      m.className='dealerContextMenu';
      m.style.left=Math.min(e.clientX,window.innerWidth-260)+'px';
      m.style.top=Math.min(e.clientY,window.innerHeight-120)+'px';

      const edit=document.createElement('button');
      edit.type='button';
      edit.textContent='Изменить карточку дилера';
      edit.onclick=()=>{
        m.remove();
        if(typeof openDealerForEdit==='function')openDealerForEdit(id);
        else if(typeof openDealer==='function')openDealer(id);
      };

      const del=document.createElement('button');
      del.type='button';
      del.className='dangerMenuItem';
      del.textContent='Удалить дилера';
      del.onclick=()=>{
        m.remove();
        const ok=removeDealerNow(id);
        if(ok){
          try{if(typeof render==='function')render()}catch(_){}
          try{if(typeof renderDealers==='function')renderDealers()}catch(_){}
          try{if(typeof renderDebts==='function')renderDebts()}catch(_){}
        }
      };

      m.append(edit,del);
      document.body.appendChild(m);
    };

    const idFromDealerRow=row=>{
      if(!row)return null;
      const attr=row.getAttribute('oncontextmenu')||'';
      const match=attr.match(/showDealerContextMenu\(event,\s*([^\)]+)\)/);
      if(!match)return null;
      let id=match[1].trim();
      if(/^['"].*['"]$/.test(id))id=id.slice(1,-1);
      else if(/^-?\d+(?:\.\d+)?$/.test(id))id=Number(id);
      return id;
    };

    // 8.9.38 registered an anonymous capture listener on document. It runs before
    // the inline row handler and creates dealerContextMenu8938. A capture listener
    // on window is earlier in the event path than document, so it is the only safe
    // way to stop that stale handler without keeping a reference to it.
    const finalContextMenuCapture=e=>{
      const row=e.target?.closest?.('#dealerRows tr[oncontextmenu]');
      if(!row)return;
      const id=idFromDealerRow(row);
      if(id===null||id===undefined||id==='')return;
      e.preventDefault();
      e.stopPropagation();
      try{e.stopImmediatePropagation()}catch(_){}
      showMenu(e,id);
    };
    window.addEventListener('contextmenu',finalContextMenuCapture,true);

    window.showDealerContextMenu=showMenu;
    try{showDealerContextMenu=showMenu}catch(_){}

    window.__dealerDelete8939Installed=true;
    window.__dealerDelete8939={removeDealerNow,showMenu,finalContextMenuCapture};
    document.documentElement.dataset.dealerFix='8.9.39';
    return true;
  };

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(install()||tries>120)clearInterval(timer);
  },100);
})();
