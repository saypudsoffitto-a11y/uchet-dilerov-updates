(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SyncConvergence8988=api;
})(typeof window==='object'?window:globalThis,()=>{
  'use strict';
  const clone=v=>JSON.parse(JSON.stringify(v));
  const id=v=>String(v??'');
  const stable=v=>JSON.stringify(v&&typeof v==='object'?Array.isArray(v)?v.map(x=>JSON.parse(stable(x))):Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(stable(v[k]))])):v??null);
  const same=(a,b)=>stable(a)===stable(b);

  function rebase(serverOps,changes){
    const server=new Map((serverOps||[]).map(op=>[id(op.id),op]));
    const safe=[],conflicts=[];
    for(const raw of changes||[]){
      const change=clone(raw);
      const key=id(change.id);
      const current=server.get(key)||null;
      if(same(current,change.after))continue;
      if(same(current,change.before)){
        safe.push(change);
        continue;
      }
      conflicts.push({
        id:key,
        before:clone(change.before),
        local:clone(change.after),
        server:clone(current)
      });
    }
    return {safe,conflicts};
  }

  return {rebase};
});
