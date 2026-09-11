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

    window.showDealerContextMenu=showMenu;
    try{showDealerContextMenu=showMenu}catch(_){}

    window.__dealerDelete8939Installed=true;
    window.__dealerDelete8939={removeDealerNow,showMenu};
    document.documentElement.dataset.dealerFix='8.9.39';
    return true;
  };

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(install()||tries>120)clearInterval(timer);
  },100);
})();
