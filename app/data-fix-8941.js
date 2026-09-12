(()=>{
  'use strict';
  if(window.__dataFix8941Installed)return;

  const install=()=>{
    if(typeof state==='undefined'||typeof save!=='function'||typeof norm!=='function')return false;

    const normName=v=>String(v??'').trim().replace(/\s+/g,' ').toLocaleLowerCase('ru-RU');
    const productKey=p=>String(p?.article||'').trim().toLocaleLowerCase('ru-RU')+'||'+String(p?.name||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('ru-RU');
    const catalogue=window.__stockGroupCatalogue8941&&typeof window.__stockGroupCatalogue8941==='object'?window.__stockGroupCatalogue8941:{};

    function repairGroupsInState(s){
      if(!s||typeof s!=='object')return {changed:false,duplicatesRemoved:0,relinked:0,orphansBefore:0,orphansAfter:0,mismatches:0,catalogueMatches:0};
      s.groups=Array.isArray(s.groups)?s.groups:[];
      s.products=Array.isArray(s.products)?s.products:[];

      const idMap=()=>new Map(s.groups.filter(Boolean).map(g=>[String(g.id),g]));
      let groupsById=idMap();
      const matched=[];
      let mismatches=0;
      let orphansBefore=0;

      for(const p of s.products){
        if(!p)continue;
        const current=groupsById.get(String(p.groupId));
        if(!current)orphansBefore++;
        const expectedRaw=catalogue[productKey(p)];
        if(!expectedRaw)continue;
        const expected=String(expectedRaw).trim().replace(/\s+/g,' ');
        if(!expected)continue;
        const mismatch=!current||normName(current.name)!==normName(expected);
        matched.push({p,current,expected,mismatch});
        if(mismatch)mismatches++;
      }

      // A few manual moves are legitimate. A broad mismatch is a damaged group-ID map.
      // Always repair catalogue-backed orphans; repair all catalogue mismatches only when the damage is systemic.
      const systemicShift=matched.length>=5&&mismatches>=3&&(mismatches/matched.length)>=0.10;
      let changed=false;
      let relinked=0;

      const usage=new Map();
      for(const p of s.products){
        if(!p)continue;
        const k=String(p.groupId);
        usage.set(k,(usage.get(k)||0)+1);
      }

      const groupsByName=new Map();
      for(const g of s.groups){
        if(!g)continue;
        const key=normName(g.name);
        if(!groupsByName.has(key))groupsByName.set(key,[]);
        groupsByName.get(key).push(g);
      }

      const canonicalForName=name=>{
        const key=normName(name);
        let list=groupsByName.get(key)||[];
        if(list.length){
          list=list.slice().sort((a,b)=>(usage.get(String(b.id))||0)-(usage.get(String(a.id))||0)||String(a.id).localeCompare(String(b.id)));
          return list[0];
        }
        const g={id:Date.now()+Math.floor(Math.random()*1000000),name:String(name).trim(),note:'Восстановлено из исходного списка товаров'};
        s.groups.push(g);
        groupsByName.set(key,[g]);
        groupsById.set(String(g.id),g);
        changed=true;
        return g;
      };

      for(const item of matched){
        if(!item.mismatch)continue;
        const isOrphan=!item.current;
        if(!isOrphan&&!systemicShift)continue;
        const target=canonicalForName(item.expected);
        if(String(item.p.groupId)!==String(target.id)){
          item.p.groupId=target.id;
          relinked++;
          changed=true;
        }
      }

      // Recalculate usage after restoring damaged links, then merge only exact same-name duplicates.
      usage.clear();
      for(const p of s.products){
        if(!p)continue;
        const k=String(p.groupId);
        usage.set(k,(usage.get(k)||0)+1);
      }

      const buckets=new Map();
      for(const g of s.groups){
        if(!g)continue;
        const key=normName(g.name);
        if(!key)continue;
        if(!buckets.has(key))buckets.set(key,[]);
        buckets.get(key).push(g);
      }

      const remap={};
      const removeIds=new Set();
      let duplicatesRemoved=0;
      for(const list of buckets.values()){
        if(list.length<2)continue;
        const ranked=list.slice().sort((a,b)=>(usage.get(String(b.id))||0)-(usage.get(String(a.id))||0)||String(a.id).localeCompare(String(b.id)));
        const canonical=ranked[0];
        for(const duplicate of ranked.slice(1)){
          remap[String(duplicate.id)]=canonical.id;
          removeIds.add(String(duplicate.id));
          if(!canonical.note&&duplicate.note)canonical.note=duplicate.note;
          duplicatesRemoved++;
        }
      }

      if(duplicatesRemoved){
        for(const p of s.products){
          if(!p)continue;
          const mapped=remap[String(p.groupId)];
          if(mapped!==undefined){p.groupId=mapped;changed=true}
        }
        s.groups=s.groups.filter(g=>g&&!removeIds.has(String(g.id)));
        changed=true;
      }

      groupsById=idMap();
      const orphansAfter=s.products.filter(p=>p&&!groupsById.has(String(p.groupId))).length;
      return {changed,duplicatesRemoved,relinked,orphansBefore,orphansAfter,mismatches,catalogueMatches:matched.length,systemicShift};
    }

    const persistIfChanged=()=>{
      const result=repairGroupsInState(state);
      if(result.changed){
        try{localStorage.setItem(KEY,JSON.stringify(state))}catch(_){}
        try{save()}catch(_){}
        try{if(typeof render==='function')render()}catch(_){}
      }
      return result;
    };

    const initial=persistIfChanged();

    // Repair after every multi-PC merge as well, so a stale machine cannot shift group IDs back.
    const previousMerge=typeof mergeSyncState==='function'?mergeSyncState:null;
    if(previousMerge){
      const merge8941=function(remote,local){
        const merged=previousMerge(remote,local);
        repairGroupsInState(merged);
        return norm(merged||{});
      };
      merge8941.__dataFix8941=true;
      window.mergeSyncState=merge8941;
      try{mergeSyncState=merge8941}catch(_){}
    }

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
    window.__dataFix8941={repairGroupsInState,persistIfChanged,initial,catalogue};
    document.documentElement.dataset.groupFix='8.9.41';
    return true;
  };

  let tries=0;
  const timer=setInterval(()=>{tries++;if(install()||tries>160)clearInterval(timer)},100);
})();
