(()=>{
  'use strict';
  if(window.__dataFix8941Installed)return;

  const install=()=>{
    if(typeof state==='undefined'||typeof save!=='function'||typeof norm!=='function')return false;

    const normName=v=>String(v??'').trim().replace(/\s+/g,' ').toLocaleLowerCase('ru-RU');

    const dedupeGroupsInState=s=>{
      if(!s||typeof s!=='object')return {changed:false,removed:0,remap:{}};
      s.groups=Array.isArray(s.groups)?s.groups:[];
      s.products=Array.isArray(s.products)?s.products:[];

      const byName=new Map();
      const keep=[];
      const remap={};
      let removed=0;

      for(const g of s.groups){
        if(!g)continue;
        const key=normName(g.name);
        if(!key){keep.push(g);continue}
        const current=byName.get(key);
        if(!current){
          byName.set(key,g);
          keep.push(g);
          continue;
        }
        // Keep first group as canonical so existing local product references remain stable.
        remap[String(g.id)]=current.id;
        if(!current.note&&g.note)current.note=g.note;
        removed++;
      }

      if(removed){
        for(const p of s.products){
          if(!p)continue;
          const mapped=remap[String(p.groupId)];
          if(mapped!==undefined)p.groupId=mapped;
        }
        s.groups=keep;
      }
      return {changed:removed>0,removed,remap};
    };

    const persistIfChanged=()=>{
      const result=dedupeGroupsInState(state);
      if(result.changed){
        try{localStorage.setItem(KEY,JSON.stringify(state))}catch(_){}
        try{save()}catch(_){}
        try{if(typeof render==='function')render()}catch(_){}
      }
      return result;
    };

    // Run once immediately to repair already duplicated groups on the user's database.
    const initial=persistIfChanged();

    // Make sync merge group-name aware so stale PCs cannot recreate same-named groups under another ID.
    const previousMerge=typeof mergeSyncState==='function'?mergeSyncState:null;
    if(previousMerge){
      const merge8941=function(remote,local){
        const merged=previousMerge(remote,local);
        dedupeGroupsInState(merged);
        return norm(merged||{});
      };
      merge8941.__dataFix8941=true;
      window.mergeSyncState=merge8941;
      try{mergeSyncState=merge8941}catch(_){}
    }

    // Prevent creating another duplicate manually from the Groups screen.
    const originalAdd=typeof addGroup==='function'?addGroup:null;
    const addGroup8941=function(){
      const n=String(window.gname?.value||'').trim();
      if(!n)return alert('Укажи группу');
      const existing=(state.groups||[]).find(g=>normName(g.name)===normName(n));
      if(existing){
        if(window.gname)gname.value='';
        if(window.gnote)gnote.value='';
        try{if(typeof render==='function')render()}catch(_){}
        return alert('Группа «'+(existing.name||n)+'» уже существует. Дубликат не создан.');
      }
      if(originalAdd)return originalAdd();
      state.groups.push({id:Date.now(),name:n,note:String(window.gnote?.value||'').trim()});
      if(window.gname)gname.value='';
      if(window.gnote)gnote.value='';
      save();
    };
    window.addGroup=addGroup8941;
    try{addGroup=addGroup8941}catch(_){}

    window.__dataFix8941Installed=true;
    window.__dataFix8941={dedupeGroupsInState,persistIfChanged,initial};
    document.documentElement.dataset.groupFix='8.9.41';
    return true;
  };

  let tries=0;
  const timer=setInterval(()=>{tries++;if(install()||tries>160)clearInterval(timer)},100);
})();
