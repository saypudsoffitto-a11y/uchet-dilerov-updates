(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CatalogPending8972=api;})(typeof window==='object'?window:globalThis,()=>{
  'use strict';
  const clone=x=>JSON.parse(JSON.stringify(x));
  const stable=x=>JSON.stringify(x&&typeof x==='object'?(Array.isArray(x)?x.map(v=>JSON.parse(stable(v))):Object.fromEntries(Object.keys(x).sort().map(k=>[k,JSON.parse(stable(x[k]))]))):x??null);
  const same=(a,b)=>stable(a)===stable(b);
  const fields=['products','groups','dealers'];
  const maps=['deletedProducts','deletedDealers','productAliases','dealerAliases','catalogDeletedKeys'];
  const definition=p=>p?Object.fromEntries(Object.entries(p).filter(([k])=>!['stock','receiptArchiveStock'].includes(k))):null;
  const conflict=(field,id)=>{throw new Error('Конфликт карточки '+field+' '+id+'. Локальные изменения сохранены; данные сервера не перезаписаны.');};
  function merge(remote,base,local){
    const out=clone(remote);
    for(const field of fields){
      const a=new Map((base[field]||[]).map(p=>[String(p.id),p]));
      const b=new Map((local[field]||[]).map(p=>[String(p.id),p]));
      const rows=new Map((out[field]||[]).map(p=>[String(p.id),p]));
      for(const id of new Set([...a.keys(),...b.keys()])){
        const before=a.get(id),after=b.get(id),current=rows.get(id);
        const clean=p=>field==='products'?definition(p):p||null;
        if(same(clean(before),clean(after)))continue;
        if(after&&((field==='products'&&remote.deletedProducts?.[id])||(field==='dealers'&&remote.deletedDealers?.[id])))conflict(field,id);
        if(!before){if(current&&!same(clean(current),clean(after)))conflict(field,id);if(!current)rows.set(id,clone(after));continue;}
        if(!after){if(current&&!same(clean(current),clean(before)))conflict(field,id);rows.delete(id);continue;}
        if(!current)conflict(field,id);
        const row=clone(current);
        for(const k of new Set([...Object.keys(before),...Object.keys(after)])){
          if(field==='products'&&['stock','receiptArchiveStock'].includes(k))continue;
          if(same(before[k],after[k]))continue;
          if(k!=='updatedAt'&&!same(current[k],before[k])&&!same(current[k],after[k]))conflict(field,id);
          if(Object.hasOwn(after,k))row[k]=clone(after[k]);else delete row[k];
        }
        rows.set(id,row);
      }
      out[field]=[...rows.values()];
    }
    for(const field of maps){
      const a=base[field]||{},b=local[field]||{},next={...(out[field]||{})};
      for(const k of new Set([...Object.keys(a),...Object.keys(b)])){
        if(same(a[k],b[k]))continue;
        if(!same(next[k],a[k])&&!same(next[k],b[k]))conflict(field,k);
        if(Object.hasOwn(b,k))next[k]=clone(b[k]);else delete next[k];
      }
      out[field]=next;
    }
    return out;
  }
  function record(state,before,after){
    const pending=state.pendingProducts8972||(state.pendingProducts8972={});
    const id=String(after?.id??before?.id);
    pending[id]={before:Object.hasOwn(pending,id)?pending[id].before:clone(before||null),after:clone(after||null)};
  }
  function firstBase(state){
    const base=clone(state),rows=new Map((base.products||[]).map(p=>[String(p.id),p]));
    for(const [id,ch] of Object.entries(state.pendingProducts8972||{})){
      if(ch.before)rows.set(id,clone(ch.before));else rows.delete(id);
    }
    base.products=[...rows.values()];return base;
  }
  function remaining(local,sent){
    const out={};
    for(const [id,ch] of Object.entries(local.pendingProducts8972||{})){
      const p=(sent.products||[]).find(p=>String(p.id)===id)||null;
      if(!same(definition(ch.after),definition(p)))out[id]={before:clone(p),after:clone(ch.after)};
    }
    return out;
  }
  return {merge,record,firstBase,remaining,definition,same};
});
