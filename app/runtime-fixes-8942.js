(()=>{
  'use strict';
  if(window.__runtimeFix8942Bootstrapped)return;
  window.__runtimeFix8942Bootstrapped=true;

  const normGroupName=v=>String(v??'')
    .normalize('NFKC')
    .replace(/\u00a0/g,' ')
    .trim()
    .replace(/\s+/g,' ')
    .replace(/ё/g,'е')
    .toLocaleLowerCase('ru-RU');

  const install=()=>{
    if(typeof state==='undefined'||typeof save!=='function'||typeof renderSaleProducts!=='function'||typeof renderSaleProductGroups!=='function')return false;

    const groupById=(s,id)=>(s?.groups||[]).find(g=>String(g?.id)===String(id));
    const sameGroup=(s,productGroupId,selectedGroupId)=>{
      if(selectedGroupId==null||String(selectedGroupId)==='')return true;
      if(String(productGroupId)===String(selectedGroupId))return true;
      const productName=normGroupName(groupById(s,productGroupId)?.name);
      const selectedName=normGroupName(groupById(s,selectedGroupId)?.name);
      return !!productName&&!!selectedName&&productName===selectedName;
    };

    function canonicalizeDuplicateGroups(s){
      if(!s||!Array.isArray(s.groups)||!Array.isArray(s.products))return {changed:false,removed:0,relinked:0};
      const usage=new Map();
      for(const p of s.products||[]){
        if(!p)continue;
        const k=String(p.groupId);
        usage.set(k,(usage.get(k)||0)+1);
      }
      const buckets=new Map();
      for(const g of s.groups||[]){
        if(!g)continue;
        const key=normGroupName(g.name);
        if(!key)continue;
        if(!buckets.has(key))buckets.set(key,[]);
        buckets.get(key).push(g);
      }
      const remap=new Map();
      const remove=new Set();
      let removed=0,relinked=0;
      for(const list of buckets.values()){
        if(list.length<2)continue;
        const ranked=list.slice().sort((a,b)=>(usage.get(String(b.id))||0)-(usage.get(String(a.id))||0)||String(a.id).localeCompare(String(b.id)));
        const canonical=ranked[0];
        for(const duplicate of ranked.slice(1)){
          remap.set(String(duplicate.id),canonical.id);
          remove.add(String(duplicate.id));
          removed++;
        }
      }
      if(!remove.size)return {changed:false,removed:0,relinked:0};
      for(const p of s.products||[]){
        if(!p)continue;
        const mapped=remap.get(String(p.groupId));
        if(mapped!==undefined&&String(mapped)!==String(p.groupId)){
          p.groupId=mapped;
          relinked++;
        }
      }
      s.groups=s.groups.filter(g=>g&&!remove.has(String(g.id)));
      return {changed:true,removed,relinked};
    }

    const currentGroupName=()=>{
      const el=document.getElementById('saleProductGroup');
      if(!el||!el.value)return '';
      return normGroupName(groupById(state,el.value)?.name||el.selectedOptions?.[0]?.textContent||'');
    };

    function renderSaleProductGroups8942(){
      const el=document.getElementById('saleProductGroup');
      if(!el)return;
      const oldId=String(el.value||'');
      const oldName=currentGroupName();
      const groups=(state.groups||[]).filter(Boolean).slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'ru',{numeric:true,sensitivity:'base'}));
      const seen=new Set(),unique=[];
      for(const g of groups){
        const key=normGroupName(g.name);
        if(!key||seen.has(key))continue;
        seen.add(key);unique.push(g);
      }
      el.innerHTML='<option value="">Все группы</option>'+unique.map(g=>'<option value="'+String(g.id).replace(/"/g,'&quot;')+'">'+esc(g.name)+'</option>').join('');
      let next='';
      if(oldId&&[...el.options].some(o=>String(o.value)===oldId))next=oldId;
      else if(oldName){
        const hit=unique.find(g=>normGroupName(g.name)===oldName);
        if(hit)next=String(hit.id);
      }
      el.value=next;
    }

    const saleCandidates=()=>{
      const search=document.getElementById('saleProductSearch');
      const group=document.getElementById('saleProductGroup');
      const q=String(search?.value||'').trim().toLocaleLowerCase('ru-RU');
      const gid=String(group?.value||'');
      return (state.products||[])
        .filter(p=>p&&!p.archived&&sameGroup(state,p.groupId,gid)&&((String(p.name||'')+' '+String(p.article||'')).toLocaleLowerCase('ru-RU').includes(q)))
        .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'ru',{numeric:true,sensitivity:'base'}))
        .slice(0,160);
    };

    function renderSaleProducts8942(){
      const list=document.getElementById('saleProductList');
      if(!list)return;
      const arr=saleCandidates();
      saleProductCursor=Math.min(saleProductCursor,Math.max(0,arr.length-1));
      list.innerHTML=arr.map((p,i)=>'<div class="choiceRow '+(i===saleProductCursor?'active':'')+'" onclick="selectSaleProduct('+p.id+')" ondblclick="selectSaleProduct('+p.id+');promptQtyAndAddSelected()" oncontextmenu="showSaleProductContextMenu(event,'+p.id+')"><div><b>'+esc(p.name)+'</b></div><span>'+money(priceType.value==='wholesale'?p.wholesalePrice:p.retailPrice)+'</span></div>').join('');
    }

    function saleProductKey8942(e){
      const arr=saleCandidates();
      if(e.key==='ArrowDown'){
        e.preventDefault();saleProductCursor=Math.min(Math.max(0,arr.length-1),saleProductCursor+1);renderSaleProducts8942();
      }else if(e.key==='ArrowUp'){
        e.preventDefault();saleProductCursor=Math.max(0,saleProductCursor-1);renderSaleProducts8942();
      }else if(e.key==='Enter'&&arr.length){
        e.preventDefault();selectSaleProduct(arr[Math.min(saleProductCursor,arr.length-1)].id);promptQtyAndAddSelected();
      }
    }

    window.renderSaleProductGroups=renderSaleProductGroups8942;
    window.renderSaleProducts=renderSaleProducts8942;
    window.saleProductKey=saleProductKey8942;
    try{renderSaleProductGroups=renderSaleProductGroups8942}catch(_){}
    try{renderSaleProducts=renderSaleProducts8942}catch(_){}
    try{saleProductKey=saleProductKey8942}catch(_){}

    const initial=canonicalizeDuplicateGroups(state);
    if(initial.changed){
      try{localStorage.setItem(KEY,JSON.stringify(state))}catch(_){}
      try{save()}catch(_){}
    }

    const mergeMarks=(a,b)=>{
      const out={};
      for(const src of [a||{},b||{}])for(const [k,v] of Object.entries(src))out[String(k)]=Math.max(+out[String(k)]||0,+v||0);
      return out;
    };

    // Re-install this guard after every known legacy delayed patch window. This is
    // intentionally the final authority for sync: an exact-ID dealer tombstone is
    // permanent, and group duplicates are canonicalized after every merge.
    const installFinalMergeGuard=()=>{
      const current=typeof mergeSyncState==='function'?mergeSyncState:null;
      if(!current)return false;
      if(current.__finalMerge8942)return true;
      const base=current;
      const finalMerge8942=function(remote,local){
        remote=typeof norm==='function'?norm(remote||{}):(remote||{});
        local=typeof norm==='function'?norm(local||{}):(local||{});
        const deletedDealers=mergeMarks(remote.deletedDealers,local.deletedDealers);
        remote.deletedDealers=deletedDealers;
        local.deletedDealers=deletedDealers;
        remote.deletedDealerKeys={};
        local.deletedDealerKeys={};
        let merged=base(remote,local);
        merged=typeof norm==='function'?norm(merged||{}):(merged||{});
        merged.deletedDealers=deletedDealers;
        merged.deletedDealerKeys={};
        merged.dealers=(merged.dealers||[]).filter(d=>!Object.prototype.hasOwnProperty.call(deletedDealers,String(d?.id)));
        canonicalizeDuplicateGroups(merged);
        return merged;
      };
      finalMerge8942.__finalMerge8942=true;
      finalMerge8942.__baseMerge8942=base;
      window.mergeSyncState=finalMerge8942;
      try{mergeSyncState=finalMerge8942}catch(_){}
      window.__finalMerge8942=finalMerge8942;
      document.documentElement.dataset.finalMergeFix='8.9.42';
      return true;
    };

    installFinalMergeGuard();
    setTimeout(installFinalMergeGuard,4200);
    setTimeout(installFinalMergeGuard,6500);

    renderSaleProductGroups8942();
    renderSaleProducts8942();
    window.__runtimeFix8942={normGroupName,sameGroup,canonicalizeDuplicateGroups,saleCandidates,renderSaleProductGroups:renderSaleProductGroups8942,renderSaleProducts:renderSaleProducts8942,installFinalMergeGuard};
    document.documentElement.dataset.groupFilterFix='8.9.42';
    window.__runtimeFix8942Installed=true;
    return true;
  };

  let tries=0;
  const timer=setInterval(()=>{tries++;if(install()||tries>240)clearInterval(timer)},100);
})();
