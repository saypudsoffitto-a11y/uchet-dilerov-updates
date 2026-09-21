(()=>{
  'use strict';
  if(window.__release8961Installed)return;
  window.__release8961Installed=true;

  const PENDING_KEY='uchet_cleanup_pending_8961';
  const now=()=>Date.now();
  const ensureMarks=s=>{
    if(!s||typeof s!=='object')return {};
    s.deletedProducts=s.deletedProducts&&typeof s.deletedProducts==='object'?s.deletedProducts:{};
    return s.deletedProducts;
  };
  const normalizeName=value=>String(value==null?'':value)
    .normalize('NFKC')
    .replace(/\u00a0/g,' ')
    .trim();
  const isPlaceholderProductName=value=>{
    const name=normalizeName(value);
    if(!name)return true;
    return /^[\s\-‐‑‒–—―−_.,·•:;|/\\]+$/u.test(name);
  };
  const markPending=()=>{try{localStorage.setItem(PENDING_KEY,'1')}catch(_){}};
  const hasPendingCleanup=()=>{try{return localStorage.getItem(PENDING_KEY)==='1'}catch(_){return false}};
  const clearPendingCleanup=()=>{try{localStorage.removeItem(PENDING_KEY)}catch(_){}};

  const cleanupState=s=>{
    if(!s||typeof s!=='object')return {changed:false,removed:0};
    s.products=Array.isArray(s.products)?s.products:[];
    const marks=ensureMarks(s);
    const keep=[];
    let removed=0;
    for(const p of s.products){
      if(!p)continue;
      if(!isPlaceholderProductName(p.name)){keep.push(p);continue}
      if(p.id!==undefined&&p.id!==null&&String(p.id)!==''){
        marks[String(p.id)]=Math.max(Number(marks[String(p.id)]||0),now());
      }
      removed++;
    }
    if(removed){
      s.products=keep;
      markPending();
    }
    return {changed:removed>0,removed};
  };

  function persistCleanup(){
    try{
      const result=cleanupState(state);
      if(result.changed){
        localStorage.setItem(KEY,JSON.stringify(state));
        if(typeof render==='function')render();
      }
      return result;
    }catch(e){
      console.error('8.9.61 placeholder product cleanup error',e);
      return {changed:false,removed:0};
    }
  }

  function installMergeGuard(){
    const current=typeof mergeSyncState==='function'?mergeSyncState:null;
    if(!current)return false;
    if(current.__placeholderCleanup8961)return true;
    const base=current;
    const guarded=function(remote,local){
      const merged=base(remote,local);
      cleanupState(merged);
      return merged;
    };
    guarded.__placeholderCleanup8961=true;
    guarded.__baseMerge8961=base;
    window.mergeSyncState=guarded;
    try{mergeSyncState=guarded}catch(_){}
    return true;
  }

  function installStockImportGuard(){
    const current=typeof importStockProductRows==='function'?importStockProductRows:null;
    if(!current)return false;
    if(current.__placeholderCleanup8961)return true;
    const base=current;
    const guarded=function(rows){
      const list=Array.isArray(rows)?rows:[];
      const filtered=list.filter(r=>!isPlaceholderProductName(r&&r[1]));
      return base.call(this,filtered);
    };
    guarded.__placeholderCleanup8961=true;
    guarded.__baseImport8961=base;
    window.importStockProductRows=guarded;
    try{importStockProductRows=guarded}catch(_){}
    return true;
  }

  const initial=persistCleanup();
  installMergeGuard();
  installStockImportGuard();

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    const a=installMergeGuard();
    const b=installStockImportGuard();
    if((a&&b)||tries>80)clearInterval(timer);
  },100);

  window.__release8961={
    isPlaceholderProductName,
    cleanupState,
    persistCleanup,
    hasPendingCleanup,
    clearPendingCleanup,
    initial
  };
  document.documentElement.dataset.productCleanup='8.9.61';
  document.documentElement.dataset.interfaceVersion='8.9.62';
})();
