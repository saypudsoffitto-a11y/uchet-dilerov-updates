(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SyncCore8962=api;})(typeof window==='object'?window:globalThis,()=>{
  'use strict';
  const clone=v=>JSON.parse(JSON.stringify(v));
  const id=v=>String(v??'');
  const normalize=v=>String(v??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('ru-RU').replace(/ё/g,'е');
  const phone=v=>{let n=String(v??'').replace(/\D/g,'');if(n.length===10)n='7'+n;if(n.length===11&&n[0]==='8')n='7'+n.slice(1);return n;};
  const stable=v=>JSON.stringify(v&&typeof v==='object'?Array.isArray(v)?v.map(x=>JSON.parse(stable(x))):Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(stable(v[k]))])):v??null);
  const same=(a,b)=>stable(a)===stable(b);
  const catalogFields=['dealers','products','groups','deletedDealers','deletedProducts','dealerAliases','productAliases','catalogDeletedKeys'];
  const dealerKey=d=>normalize(d.name)&&phone(d.phone)?normalize(d.name)+'|'+phone(d.phone):'';
  const productKey=p=>normalize(p.article)&&normalize(p.name)?[p.article,p.name,p.unit||'шт'].map(normalize).join('|'):'';
  const resolve=(aliases,value)=>{let key=id(value);const seen=new Set();while(aliases?.[key]&&!seen.has(key)){seen.add(key);key=id(aliases[key]);}return key;};
  function remap(state){
    const ds=new Map((state.dealers||[]).map(d=>[id(d.id),d.id]));
    const ps=new Map((state.products||[]).map(p=>[id(p.id),p.id]));
    for(const op of [...(state.ops||[]),...Object.values(state.receiptStates||{}).map(e=>e.receipt).filter(Boolean)]){const d=resolve(state.dealerAliases,op.dealerId);if(ds.has(d))op.dealerId=ds.get(d);for(const item of op.items||[]){const p=resolve(state.productAliases,item.productId);if(ps.has(p))item.productId=ps.get(p);}}
    for(const entry of Object.values(state.receiptItemStates||{})){
      const d=resolve(state.dealerAliases,entry.dealerId);if(ds.has(d))entry.dealerId=ds.get(d);
      if(entry.item){const p=resolve(state.productAliases,entry.item.productId);if(ps.has(p))entry.item.productId=ps.get(p);}
    }
    return state;
  }
  function canonicalize(input){
    const s=clone(input);s.dealerAliases=s.dealerAliases||{};s.productAliases=s.productAliases||{};s.deletedDealers=s.deletedDealers||{};s.deletedProducts=s.deletedProducts||{};
    s.products=(s.products||[]).filter(p=>{if(!normalize(p.name)||/^[\s\-‐‑‒–—―−_.,·•:;|/\\]+$/u.test(normalize(p.name))){s.deletedProducts[id(p.id)]=Date.now();return false;}return !s.deletedProducts[id(p.id)];});
    for(const [field,key,alias,marks] of [['dealers',dealerKey,'dealerAliases','deletedDealers'],['products',productKey,'productAliases','deletedProducts']]){
      const buckets=new Map(),removed=new Set();
      for(const row of s[field]||[]){const k=key(row);if(!k)continue;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(row);}
      for(const rows of buckets.values()){
        // Keep the existing numeric card number; never sum imported stock or money.
        rows.sort((a,b)=>id(a.id).localeCompare(id(b.id),'en',{numeric:true}));
        const target=rows[0];
        for(const row of rows.slice(1)){
          if(field==='products'&&!same({...target,id:null},{...row,id:null}))continue; // Conflicting prices/stocks require human choice.
          for(const k of Object.keys(row))if(k!=='id'&&!target[k]&&row[k])target[k]=row[k];
          s[alias][id(row.id)]=id(target.id);s[marks][id(row.id)]=Date.now();removed.add(id(row.id));
        }
      }
      s[field]=(s[field]||[]).filter(row=>!removed.has(id(row.id)));
    }
    // Phone-less imported copies are unambiguous only when exactly one phone
    // card with the same name exists and their other identifying fields agree.
    const removed=new Set();
    for(const d of s.dealers||[]){
      if(phone(d.phone)||d.source!=='NewMatRos')continue;
      const candidates=s.dealers.filter(x=>phone(x.phone)&&normalize(x.name)===normalize(d.name));
      if(candidates.length!==1)continue;const target=candidates[0];
      if(['city','company','fio','address','email'].some(k=>d[k]&&target[k]&&normalize(d[k])!==normalize(target[k])))continue;
      for(const k of Object.keys(d))if(k!=='id'&&!target[k]&&d[k])target[k]=d[k];
      s.dealerAliases[id(d.id)]=id(target.id);s.deletedDealers[id(d.id)]=Date.now();removed.add(id(d.id));
    }
    s.dealers=s.dealers.filter(d=>!removed.has(id(d.id)));
    return remap(s);
  }
  function diffOps(base,current){
    const a=new Map((base||[]).map(o=>[id(o.id),o])),b=new Map((current||[]).map(o=>[id(o.id),o]));
    return [...new Set([...a.keys(),...b.keys()])].filter(k=>!same(a.get(k),b.get(k))).map(k=>({id:k,before:a.get(k)||null,after:b.get(k)||null}));
  }
  function applyOps(state,changes){
    const out=clone(state),map=new Map((out.ops||[]).map(o=>[id(o.id),o]));
    for(const change of changes||[]){
      if(!change||!change.id||change.after&&id(change.after.id)!==change.id)throw new Error('Неверный номер операции');
      const current=map.get(change.id)||null;
      if(same(current,change.after))continue; // Retry after a lost acknowledgement.
      if(!same(current,change.before))throw new Error('Операция '+change.id+' изменена на другом компьютере. Локальная правка сохранена.');
      if(change.after)map.set(change.id,clone(change.after));else map.delete(change.id);
    }
    out.ops=[...map.values()];return remap(out);
  }
  const archiveFields=['receiptStates','receiptItemStates'];
  function diffArchives(base,current){return Object.fromEntries(archiveFields.map(field=>{const a=base[field]||{},b=current[field]||{};return [field,[...new Set([...Object.keys(a),...Object.keys(b)])].filter(k=>!same(a[k],b[k])).map(k=>({key:k,before:a[k]||null,after:b[k]||null}))];}));}
  function quantities(ops){const q={};for(const op of ops||[])if(op.type==='sale')for(const item of op.items||[]){if(item.productId!=null)q[id(item.productId)]=(q[id(item.productId)]||0)+(Number(item.qty)||0);}return q;}
  function applyTransaction(state,changes,archives){
    const out=applyOps(state,changes),before=quantities(state.ops),after=quantities(out.ops);
    for(const field of archiveFields){out[field]=out[field]||{};for(const change of archives?.[field]||[]){const current=out[field][change.key]||null;if(same(current,change.after))continue;if(!same(current,change.before))throw new Error('Архив чека изменён на другом компьютере');if(change.after)out[field][change.key]=clone(change.after);else delete out[field][change.key];}}
    for(const p of out.products||[]){const k=id(p.id);p.stock=Number(((Number(p.stock)||0)+(before[k]||0)-(after[k]||0)).toFixed(3));
      // The archive UI must not apply the same stock return for a second time.
      for(const [receiptId,entry] of Object.entries(out.receiptStates||{}))p.receiptArchiveStock={...p.receiptArchiveStock,[receiptId]:entry.archived?Number(entry.stockQuantities?.[k])||0:0};
    }
    return out;
  }
  function catalog(state){return Object.fromEntries(catalogFields.map(k=>[k,clone(state[k]||(k==='dealers'||k==='products'||k==='groups'?[]:{}))]));}
  function definitions(state){const value=catalog(state);for(const p of value.products){delete p.stock;delete p.receiptArchiveStock;}return value;}
  function applyCatalog(previous,incoming){
    const next={...clone(previous),...catalog(incoming)};
    next.catalogDeletedKeys={...(previous.catalogDeletedKeys||{}),...(next.catalogDeletedKeys||{})};
    for(const [field,marks,key] of [['dealers','deletedDealers',dealerKey],['products','deletedProducts',productKey]]){
      next[marks]={...(previous[marks]||{}),...(next[marks]||{})};
      const ids=new Set(next[field].map(r=>id(r.id)));
      for(const row of previous[field]||[])if(!ids.has(id(row.id))){next[marks][id(row.id)]=Date.now();const k=key(row);if(k&&!next[field].some(r=>key(r)===k))next.catalogDeletedKeys[field+':'+k]=true;}
      next[field]=next[field].filter(row=>!next[marks][id(row.id)]&&!next.catalogDeletedKeys[field+':'+key(row)]);
    }
    return canonicalize(next);
  }
  return {clone,same,normalize,phone,id,catalogFields,catalog,definitions,canonicalize,remap,diffOps,applyOps,applyCatalog,dealerKey,productKey,diffArchives,applyTransaction,quantities};
});
