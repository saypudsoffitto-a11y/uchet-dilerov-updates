(function(root){
  'use strict';
  const clone=x=>JSON.parse(JSON.stringify(x));
  const key=x=>String(x);
  function mergeStates(a,b){
    const out={};
    for(const source of [a||{},b||{}])for(const [id,entry] of Object.entries(source)){
      if(!entry?.receipt||key(entry.receipt.id)!==id)continue;
      const old=out[id];
      // Logical revision takes precedence over computer clocks; archive wins ties.
      const rank=e=>[+e.version||0,+e.at||0,e.archived?1:0,JSON.stringify(e)];
      const newer=()=>{const x=rank(entry),y=rank(old);for(let i=0;i<x.length;i++){if(x[i]!==y[i])return x[i]>y[i]}return false};
      if(!old||newer())out[id]=clone(entry);
    }
    return out;
  }
  function stockQuantities(op){
    const amounts={};
    for(const i of op.items||[]){
      // Imported ceiling rows never reduced inventory in the existing importer.
      if(i.productId==null||(op.source==='NewMatRos'&&(i.ceilingNo||/^NM-/.test(i.article||''))&&!i.stockTracked))continue;
      const qty=+i.qty;if(!Number.isFinite(qty)||qty<=0)continue;
      amounts[key(i.productId)]=(amounts[key(i.productId)]||0)+qty;
    }
    return amounts;
  }
  function apply(state){
    state.receiptStates=mergeStates(state.receiptStates,{});
    for(const [id,entry] of Object.entries(state.receiptStates)){
      const existing=(state.ops||[]).find(o=>key(o.id)===id);
      if(entry.archived)state.ops=(state.ops||[]).filter(o=>key(o.id)!==id);
      else if(!existing)state.ops.push(clone(entry.receipt));
      for(const p of state.products||[]){
        const desired=entry.archived?(+entry.stockQuantities?.[key(p.id)]||0):0;
        const applied=+p.receiptArchiveStock?.[id]||0;
        if(desired!==applied){
          p.stock=Math.round(((+p.stock||0)+desired-applied)*1e6)/1e6;
          p.receiptArchiveStock={...p.receiptArchiveStock,[id]:desired};
        }
      }
    }
    return state;
  }
  function transition(state,id,archived,now=Date.now()){
    const next=clone(state);next.receiptStates=next.receiptStates||{};
    const previous=next.receiptStates[key(id)];
    if(archived&&previous?.archived)return next;
    if(!archived&&!previous?.archived)return next;
    const receipt=archived?(next.ops||[]).find(o=>key(o.id)===key(id)&&o.type==='sale'):previous.receipt;
    if(!receipt)throw Error('Чек не найден. Обнови список.');
    if(!archived&&!(next.dealers||[]).some(d=>key(d.id)===key(receipt.dealerId)))throw Error('Карточка дилера удалена. Восстановление чека для этого дилера недоступно.');
    if(!archived&&receipt.source==='NewMatRos'){
      const keys=new Set([receipt.newmatrosKey,...(receipt.newmatrosKeys||[])].filter(Boolean));
      if(next.ops.some(o=>o.type==='sale'&&o.source==='NewMatRos'&&[o.newmatrosKey,...(o.newmatrosKeys||[])].some(k=>keys.has(k))))throw Error('Этот потолок уже оформлен повторно. Сначала удали повторный чек, чтобы не начислить долг дважды.');
    }
    next.receiptStates[key(id)]={version:(+previous?.version||0)+1,at:now,archived,receipt:clone(receipt),stockQuantities:archived?stockQuantities(receipt):(previous.stockQuantities||{})};
    apply(next);
    return next;
  }
  function merge(remote,local,merged){
    merged.receiptStates=mergeStates(remote.receiptStates,local.receiptStates);
    return apply(merged);
  }
  const api={transition,merge,apply,mergeStates,stockQuantities};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.receiptArchiveCore=api;
})(globalThis);
