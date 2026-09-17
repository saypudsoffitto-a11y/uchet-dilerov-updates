(function(root){
  'use strict';
  const clone=x=>JSON.parse(JSON.stringify(x));
  const key=x=>String(x);
  const round=x=>Math.round((+x||0)*1e6)/1e6;

  function mergeStates(a,b){
    const out={};
    for(const source of [a||{},b||{}])for(const [id,entry] of Object.entries(source)){
      if(!entry?.receipt||key(entry.receipt.id)!==id)continue;
      const old=out[id];
      const rank=e=>[+e.version||0,+e.at||0,e.archived?1:0,JSON.stringify(e)];
      const newer=()=>{const x=rank(entry),y=rank(old);for(let i=0;i<x.length;i++){if(x[i]!==y[i])return x[i]>y[i]}return false};
      if(!old||newer())out[id]=clone(entry);
    }
    return out;
  }

  function mergeItemStates(a,b){
    const out={};
    for(const source of [a||{},b||{}])for(const [id,entry] of Object.entries(source)){
      if(!entry?.item||entry.receiptId==null||!entry.lineId)continue;
      const old=out[id];
      const rank=e=>[+e.version||0,+e.at||0,e.archived?1:0,JSON.stringify(e)];
      const newer=()=>{const x=rank(entry),y=rank(old);for(let i=0;i<x.length;i++){if(x[i]!==y[i])return x[i]>y[i]}return false};
      if(!old||newer())out[id]=clone(entry);
    }
    return out;
  }

  function ensureLineIds(state){
    const visit=op=>{
      if(!op||op.type!=='sale'||!Array.isArray(op.items))return;
      op.items.forEach((item,index)=>{if(!item._lineId)item._lineId='r'+key(op.id)+'-i'+index});
    };
    for(const op of state.ops||[])visit(op);
    for(const entry of Object.values(state.receiptStates||{}))visit(entry&&entry.receipt);
    return state;
  }

  function recalcReceipt(op){
    if(!op||op.type!=='sale')return op;
    op.total=round((op.items||[]).reduce((sum,item)=>sum+(Number.isFinite(+item.total)?+item.total:(+item.qty||0)*(+item.price||0)),0));
    op.profit=round((op.items||[]).reduce((sum,item)=>sum+(Number.isFinite(+item.profit)?+item.profit:((+item.price||0)-(+item.buyPrice||0))*(+item.qty||0)),0));
    return op;
  }

  function stockQuantities(op){
    const amounts={};
    for(const i of op.items||[]){
      if(i.productId==null||(op.source==='NewMatRos'&&(i.ceilingNo||/^NM-/.test(i.article||''))&&!i.stockTracked))continue;
      const qty=+i.qty;if(!Number.isFinite(qty)||qty<=0)continue;
      amounts[key(i.productId)]=(amounts[key(i.productId)]||0)+qty;
    }
    return amounts;
  }

  function recalcPaymentBalances(state,affected){
    if(!affected||!affected.size)return;
    const balances={};
    const time=o=>Number(o.ts)||Number(o.id)||0;
    for(const op of (state.ops||[]).slice().sort((a,b)=>time(a)-time(b))){
      const id=key(op.dealerId);if(!affected.has(id))continue;
      const before=balances[id]||0;
      if(op.type==='payment'){
        op.beforeDebt=before;
        op.afterDebt=round(before-(+op.total||0));
        balances[id]=op.afterDebt;
      }else if(op.type==='sale'||op.type==='initial_debt'){
        balances[id]=round(before+(+op.total||0));
      }
    }
  }

  function apply(state){
    state.receiptStates=mergeStates(state.receiptStates,{});
    state.receiptItemStates=mergeItemStates(state.receiptItemStates,{});
    ensureLineIds(state);

    for(const [id,entry] of Object.entries(state.receiptStates)){
      const existing=(state.ops||[]).find(o=>key(o.id)===id);
      if(entry.archived)state.ops=(state.ops||[]).filter(o=>key(o.id)!==id);
      else if(!existing)state.ops.push(clone(entry.receipt));
      for(const p of state.products||[]){
        const desired=entry.archived?(+entry.stockQuantities?.[key(p.id)]||0):0;
        const applied=+p.receiptArchiveStock?.[id]||0;
        if(desired!==applied){
          p.stock=round((+p.stock||0)+desired-applied);
          p.receiptArchiveStock={...p.receiptArchiveStock,[id]:desired};
        }
      }
    }

    ensureLineIds(state);
    for(const [entryKey,entry] of Object.entries(state.receiptItemStates)){
      const receiptId=key(entry.receiptId);
      if(state.receiptStates?.[receiptId]?.archived)continue;
      const op=(state.ops||[]).find(o=>key(o.id)===receiptId&&o.type==='sale');
      if(!op)continue;
      const idx=(op.items||[]).findIndex(item=>item&&item._lineId===entry.lineId);
      if(entry.archived){
        if(idx>=0)op.items.splice(idx,1);
      }else if(idx<0){
        const insertAt=Math.max(0,Math.min(+entry.originalIndex||0,op.items.length));
        op.items.splice(insertAt,0,clone(entry.item));
      }
      recalcReceipt(op);
      if(!entry.key)entry.key=entryKey;
    }

    const affected=new Set();
    for(const e of Object.values(state.receiptStates||{}))if(e?.receipt?.dealerId!=null)affected.add(key(e.receipt.dealerId));
    for(const e of Object.values(state.receiptItemStates||{}))if(e?.dealerId!=null)affected.add(key(e.dealerId));
    recalcPaymentBalances(state,affected);
    return state;
  }

  function transition(state,id,archived,now=Date.now()){
    const next=clone(state);next.receiptStates=next.receiptStates||{};
    ensureLineIds(next);
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
    return apply(next);
  }

  function deleteItem(state,receiptId,itemIndex,now=Date.now()){
    const next=clone(state);next.receiptItemStates=next.receiptItemStates||{};
    ensureLineIds(next);
    const op=(next.ops||[]).find(o=>key(o.id)===key(receiptId)&&o.type==='sale');
    if(!op)throw Error('Чек не найден. Обнови список.');
    if((op.items||[]).length<=1)throw Error('В чеке только одна позиция. Для неё используй «Удалить чек», чтобы чек сохранился в архиве.');
    const item=op.items?.[itemIndex];
    if(!item)throw Error('Позиция не найдена. Обнови чек.');
    const lineId=item._lineId;
    const entryKey=key(receiptId)+'::'+lineId;
    const previous=next.receiptItemStates[entryKey];
    if(previous?.archived)return apply(next);
    next.receiptItemStates[entryKey]={key:entryKey,version:(+previous?.version||0)+1,at:now,archived:true,receiptId:op.id,receiptNo:op.receiptNo,dealerId:op.dealerId,dealer:op.dealer,lineId,originalIndex:itemIndex,item:clone(item)};
    return apply(next);
  }

  function restoreItem(state,entryKey,now=Date.now()){
    const next=clone(state);next.receiptItemStates=next.receiptItemStates||{};
    const previous=next.receiptItemStates[entryKey];
    if(!previous?.archived)return apply(next);
    if(next.receiptStates?.[key(previous.receiptId)]?.archived)throw Error('Сначала восстанови сам чек в разделе «Удалённые чеки».');
    const op=(next.ops||[]).find(o=>key(o.id)===key(previous.receiptId)&&o.type==='sale');
    if(!op)throw Error('Чек не найден. Обнови список.');
    next.receiptItemStates[entryKey]={...clone(previous),version:(+previous.version||0)+1,at:now,archived:false};
    return apply(next);
  }

  function merge(remote,local,merged){
    merged.receiptStates=mergeStates(remote.receiptStates,local.receiptStates);
    merged.receiptItemStates=mergeItemStates(remote.receiptItemStates,local.receiptItemStates);
    return apply(merged);
  }

  const api={transition,deleteItem,restoreItem,merge,apply,mergeStates,mergeItemStates,stockQuantities,ensureLineIds,recalcReceipt};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.receiptArchiveCore=api;
})(globalThis);
