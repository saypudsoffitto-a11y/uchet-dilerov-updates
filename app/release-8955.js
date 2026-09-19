(()=>{
  'use strict';
  if(window.__release8955Installed)return;
  window.__release8955Installed=true;

  const now=()=>Date.now();
  const ensureMarks=s=>{
    if(!s||typeof s!=='object')return {};
    s.deletedProducts=s.deletedProducts&&typeof s.deletedProducts==='object'?s.deletedProducts:{};
    return s.deletedProducts;
  };
  const mergeMarks=(a,b)=>{
    const out={};
    for(const src of [a||{},b||{}]){
      for(const [k,v] of Object.entries(src)){
        const n=Number(v)||0;
        out[String(k)]=Math.max(Number(out[String(k)]||0),n);
      }
    }
    return out;
  };
  const applyMarks=s=>{
    if(!s||typeof s!=='object')return {changed:false,removed:0};
    s.products=Array.isArray(s.products)?s.products:[];
    const marks=ensureMarks(s);
    const before=s.products.length;
    s.products=s.products.filter(p=>p&&!Object.prototype.hasOwnProperty.call(marks,String(p.id)));
    return {changed:s.products.length!==before,removed:before-s.products.length};
  };
  const cleanEmptyProducts=s=>{
    if(!s||typeof s!=='object')return {changed:false,removed:0};
    s.products=Array.isArray(s.products)?s.products:[];
    const marks=ensureMarks(s);
    let removed=0;
    const keep=[];
    for(const p of s.products){
      if(!p)continue;
      const name=String(p.name??'').trim();
      if(name){keep.push(p);continue}
      marks[String(p.id)]=Math.max(Number(marks[String(p.id)]||0),now());
      removed++;
    }
    if(removed)s.products=keep;
    return {changed:removed>0,removed};
  };

  function installMergeGuard(){
    const current=typeof mergeSyncState==='function'?mergeSyncState:null;
    if(!current)return false;
    if(current.__productTombstones8955)return true;
    const base=current;
    const guarded=function(remote,local){
      remote=typeof norm==='function'?norm(remote||{}):(remote||{});
      local=typeof norm==='function'?norm(local||{}):(local||{});
      const marks=mergeMarks(remote.deletedProducts,local.deletedProducts);
      remote.deletedProducts=marks;
      local.deletedProducts=marks;
      applyMarks(remote);
      applyMarks(local);
      let merged=base(remote,local);
      merged=typeof norm==='function'?norm(merged||{}):(merged||{});
      merged.deletedProducts=mergeMarks(marks,merged.deletedProducts);
      applyMarks(merged);
      cleanEmptyProducts(merged);
      return merged;
    };
    guarded.__productTombstones8955=true;
    guarded.__baseMerge8955=base;
    window.mergeSyncState=guarded;
    try{mergeSyncState=guarded}catch(_){}
    return true;
  }

  const previousDel=typeof delProduct==='function'?delProduct:window.delProduct;
  if(typeof previousDel==='function'&&!previousDel.__productTombstones8955){
    const wrapped=function(id){
      const p=(state.products||[]).find(x=>String(x?.id)===String(id));
      if(!p)return;
      const used=(state.ops||[]).some(o=>o?.type==='sale'&&Array.isArray(o.items)&&o.items.some(i=>String(i?.productId)===String(id)));
      if(used)return previousDel.apply(this,arguments);
      if(!confirm('Удалить товар «'+String(p.name||'Без названия')+'»?'))return;
      if(!confirm('Подтверди ещё раз: удалить товар без возможности восстановления?'))return;
      const marks=ensureMarks(state);
      marks[String(p.id)]=Math.max(Number(marks[String(p.id)]||0),now());
      state.products=(state.products||[]).filter(x=>String(x?.id)!==String(p.id));
      try{save()}catch(_){try{localStorage.setItem(KEY,JSON.stringify(state));render()}catch(__){}}
      try{
        if(state.sync?.enabled&&state.sync?.url&&typeof syncPush==='function')setTimeout(()=>syncPush(true),80);
      }catch(_){}
    };
    wrapped.__productTombstones8955=true;
    wrapped.__base=previousDel;
    window.delProduct=wrapped;
    try{delProduct=wrapped}catch(_){}
  }

  const initial=(()=>{
    try{
      ensureMarks(state);
      const a=applyMarks(state),b=cleanEmptyProducts(state);
      if(a.changed||b.changed){
        localStorage.setItem(KEY,JSON.stringify(state));
        if(typeof render==='function')render();
        if(state.sync?.enabled&&state.sync?.url&&typeof syncPush==='function')setTimeout(()=>syncPush(true),120);
      }
      return {tombstonesApplied:a.removed,emptyRemoved:b.removed};
    }catch(e){
      console.error('8.9.55 product cleanup error',e);
      return {tombstonesApplied:0,emptyRemoved:0};
    }
  })();

  installMergeGuard();
  setTimeout(installMergeGuard,4300);
  setTimeout(installMergeGuard,6800);
  setTimeout(installMergeGuard,8500);

  window.__release8955={
    ensureMarks,
    mergeMarks,
    applyMarks,
    cleanEmptyProducts,
    installMergeGuard,
    initial
  };
  document.documentElement.dataset.productDeletionFix='8.9.55';
  document.documentElement.dataset.interfaceVersion='8.9.55';
})();