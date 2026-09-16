(()=>{
  'use strict';
  if(window.__dataFix8941Installed)return;

  const install=()=>{
    if(typeof state==='undefined'||typeof save!=='function'||typeof norm!=='function')return false;

    const normName=v=>String(v??'').normalize('NFKC').replace(/\u00a0/g,' ').trim().replace(/\s+/g,' ').replace(/ё/g,'е').toLocaleLowerCase('ru-RU');
    const catalogueKey=p=>String(p?.article||'').trim().toLocaleLowerCase('ru-RU')+'||'+String(p?.name||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('ru-RU');
    const catalogue=window.__stockGroupCatalogue8941&&typeof window.__stockGroupCatalogue8941==='object'?window.__stockGroupCatalogue8941:{};
    const stamp=v=>{
      if(Number.isFinite(+v)&&+v>0)return +v;
      const p=Date.parse(String(v||''));
      return Number.isFinite(p)?p:0;
    };
    const productStamp=p=>Math.max(stamp(p?.updatedAt),stamp(p?.ts),stamp(p?.id));

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
        const expectedRaw=catalogue[catalogueKey(p)];
        if(!expectedRaw)continue;
        const expected=String(expectedRaw).trim().replace(/\s+/g,' ');
        if(!expected)continue;
        const mismatch=!current||normName(current.name)!==normName(expected);
        matched.push({p,current,expected,mismatch});
        if(mismatch)mismatches++;
      }

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

    function repairProductsInState(s){
      if(!s||typeof s!=='object')return {changed:false,duplicatesRemoved:0,relinked:0,buckets:0};
      s.groups=Array.isArray(s.groups)?s.groups:[];
      s.products=Array.isArray(s.products)?s.products:[];
      s.ops=Array.isArray(s.ops)?s.ops:[];
      s.deletedProducts=s.deletedProducts&&typeof s.deletedProducts==='object'?s.deletedProducts:{};

      const groupsById=new Map(s.groups.filter(Boolean).map(g=>[String(g.id),g]));
      const logicalKey=p=>{
        const name=normName(p?.name);
        if(!name)return '';
        const article=normName(p?.article);
        if(article)return 'a:'+article+'||n:'+name;
        const group=normName(groupsById.get(String(p?.groupId))?.name);
        return 'n:'+name+'||g:'+group;
      };

      const refs=new Map();
      const countRef=id=>{if(id===undefined||id===null||id==='')return;const k=String(id);refs.set(k,(refs.get(k)||0)+1)};
      for(const op of s.ops){for(const item of (op?.items||[]))countRef(item?.productId)}
      for(const entry of Object.values(s.receiptStates||{})){for(const item of (entry?.receipt?.items||[]))countRef(item?.productId)}

      const buckets=new Map();
      for(const p of s.products){
        if(!p)continue;
        const key=logicalKey(p);
        if(!key)continue;
        if(!buckets.has(key))buckets.set(key,[]);
        buckets.get(key).push(p);
      }

      const idRemap=new Map();
      const removeIds=new Set();
      let duplicateBuckets=0;
      for(const list of buckets.values()){
        if(list.length<2)continue;
        duplicateBuckets++;
        const ranked=list.slice().sort((a,b)=>(refs.get(String(b.id))||0)-(refs.get(String(a.id))||0)||productStamp(b)-productStamp(a)||String(a.id).localeCompare(String(b.id)));
        const canonical=ranked[0];
        const donor=list.slice().sort((a,b)=>productStamp(b)-productStamp(a)||String(a.id).localeCompare(String(b.id)))[0]||canonical;
        const fields=['groupId','name','article','buyPrice','retailPrice','wholesalePrice','stock','unit','photo','extraInfo','oldAux','source','updatedAt'];
        for(const f of fields){if(donor[f]!==undefined&&donor[f]!==null&&donor[f]!=='')canonical[f]=donor[f]}
        canonical.archived=list.every(p=>!!p.archived);
        for(const duplicate of ranked.slice(1)){
          idRemap.set(String(duplicate.id),canonical.id);
          removeIds.add(String(duplicate.id));
        }
      }

      if(!removeIds.size)return {changed:false,duplicatesRemoved:0,relinked:0,buckets:duplicateBuckets};

      let relinked=0;
      const relinkItems=items=>{
        for(const item of (items||[])){
          const mapped=idRemap.get(String(item?.productId));
          if(mapped!==undefined&&String(item.productId)!==String(mapped)){item.productId=mapped;relinked++}
        }
      };
      for(const op of s.ops)relinkItems(op?.items);
      for(const entry of Object.values(s.receiptStates||{}))relinkItems(entry?.receipt?.items);
      try{if(typeof cart!=='undefined'&&Array.isArray(cart))relinkItems(cart)}catch(_){}

      const now=Date.now();
      for(const id of removeIds)s.deletedProducts[id]=Math.max(+s.deletedProducts[id]||0,now);
      s.products=s.products.filter(p=>p&&!removeIds.has(String(p.id)));
      return {changed:true,duplicatesRemoved:removeIds.size,relinked,buckets:duplicateBuckets};
    }

    const persistIfChanged=()=>{
      const groups=repairGroupsInState(state);
      const products=repairProductsInState(state);
      if(groups.changed||products.changed){
        try{localStorage.setItem(KEY,JSON.stringify(state))}catch(_){}
        try{save()}catch(_){}
        try{if(typeof render==='function')render()}catch(_){}
      }
      return {groups,products,changed:groups.changed||products.changed};
    };

    const initial=persistIfChanged();

    const previousMerge=typeof mergeSyncState==='function'?mergeSyncState:null;
    if(previousMerge){
      const merge8941=function(remote,local){
        const merged=previousMerge(remote,local);
        repairGroupsInState(merged);
        repairProductsInState(merged);
        return norm(merged||{});
      };
      merge8941.__dataFix8941=true;
      window.mergeSyncState=merge8941;
      try{mergeSyncState=merge8941}catch(_){}
    }

    const originalImport=typeof importStockProductRows==='function'?importStockProductRows:null;
    if(originalImport&&!originalImport.__productDedupe8946){
      const wrappedImport=function(){
        const result=originalImport.apply(this,arguments);
        const fixed=repairProductsInState(state);
        if(fixed.changed){
          try{localStorage.setItem(KEY,JSON.stringify(state))}catch(_){}
          try{save()}catch(_){}
        }
        if(result&&typeof result==='object')result.mergedDuplicates=(+result.mergedDuplicates||0)+fixed.duplicatesRemoved;
        return result;
      };
      wrappedImport.__productDedupe8946=true;
      window.importStockProductRows=wrappedImport;
      try{importStockProductRows=wrappedImport}catch(_){}
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
    window.__dataFix8941={repairGroupsInState,repairProductsInState,persistIfChanged,initial,catalogue};
    document.documentElement.dataset.groupFix='8.9.41';
    document.documentElement.dataset.productDedupe='8.9.46';
    return true;
  };

  let tries=0;
  const timer=setInterval(()=>{tries++;if(install()||tries>160)clearInterval(timer)},100);
})();
