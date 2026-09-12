(()=>{
  'use strict';
  if(window.__groupBackup8941Installed)return;
  const install=()=>{
    if(typeof state==='undefined'||typeof KEY==='undefined')return false;
    const backupKey=String(KEY)+'_groupmap_before_8941';
    try{
      if(!localStorage.getItem(backupKey)){
        const payload={
          createdAt:new Date().toISOString(),
          groups:(state.groups||[]).map(g=>({id:g.id,name:g.name||'',note:g.note||''})),
          productGroups:(state.products||[]).map(p=>({id:p.id,groupId:p.groupId}))
        };
        localStorage.setItem(backupKey,JSON.stringify(payload));
      }
    }catch(e){console.warn('8.9.41 group-link backup failed:',e)}

    const restore=()=>{
      try{
        const raw=localStorage.getItem(backupKey);
        if(!raw)return false;
        const b=JSON.parse(raw);
        if(!Array.isArray(b.groups)||!Array.isArray(b.productGroups))return false;
        const groupMap=new Map(b.productGroups.map(x=>[String(x.id),x.groupId]));
        state.groups=b.groups.map(g=>({...g}));
        for(const p of state.products||[]){
          if(groupMap.has(String(p.id)))p.groupId=groupMap.get(String(p.id));
        }
        localStorage.setItem(KEY,JSON.stringify(state));
        if(typeof render==='function')render();
        return true;
      }catch(e){console.error('8.9.41 group-link restore failed:',e);return false}
    };

    window.__groupBackup8941Installed=true;
    window.__groupBackup8941={backupKey,restore};
    return true;
  };
  let tries=0;
  const timer=setInterval(()=>{tries++;if(install()||tries>160)clearInterval(timer)},100);
})();
