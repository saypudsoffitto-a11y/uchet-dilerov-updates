(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./sync-core-8962'));
  else root.PermanentDelete8989=factory(root.SyncCore8962);
})(typeof window==='object'?window:globalThis,function(C){
  'use strict';
  const fields=['receiptStates','receiptItemStates'];
  function marks(s){const m=s.permanentDeletions||{};return {dealers:m.dealers||{},operations:m.operations||{},history:m.history||{},requests:m.requests||{}};}
  function dealerId(s,value){let k=C.id(value),seen=new Set();while(s.dealerAliases?.[k]&&!seen.has(k)){seen.add(k);k=C.id(s.dealerAliases[k]);}return k;}
  function blocked(s,op){
    if(!op)return false;
    const m=marks(s),d=dealerId(s,op.dealerId);
    if(m.operations[C.id(op.id)]||m.dealers[d]||m.dealers[C.id(op.dealerId)])return true;
    const cutoff=m.history[d];
    // The server generation, not a PC clock, identifies work created after a clear.
    return !!cutoff&&Number(op.historyEpoch8989)!==Number(cutoff);
  }
  function archiveBlocked(s,key,entry){
    if(!entry)return !!marks(s).operations[C.id(key).split(':')[0]];
    if(entry.receipt)return blocked(s,entry.receipt);
    const receipt=(s.ops||[]).find(o=>C.id(o.id)===C.id(entry.receiptId))||s.receiptStates?.[C.id(entry.receiptId)]?.receipt;
    if(receipt)return blocked(s,receipt);
    const m=marks(s),d=dealerId(s,entry.dealerId);
    return !!(m.operations[C.id(entry.receiptId)]||m.dealers[d]||m.history[d]);
  }
  function filterChanges(s,changes){return (changes||[]).filter(ch=>!blocked(s,ch.after||ch.before));}
  function filterArchives(s,archives){return Object.fromEntries(fields.map(f=>[f,(archives?.[f]||[]).filter(ch=>!archiveBlocked(s,ch.key,ch.after||ch.before))]));}
  function sanitize(s){
    const out=C.clone(s),m=marks(out);
    out.ops=(out.ops||[]).filter(o=>!blocked(out,o));
    out.dealers=(out.dealers||[]).filter(d=>!m.dealers[dealerId(out,d.id)]&&!m.dealers[C.id(d.id)]);
    for(const f of fields)out[f]=Object.fromEntries(Object.entries(out[f]||{}).filter(([k,e])=>!archiveBlocked(out,k,e)));
    for(const p of out.products||[])if(p.receiptArchiveStock)p.receiptArchiveStock=Object.fromEntries(Object.entries(p.receiptArchiveStock).filter(([k])=>!m.operations[k]));
    return out;
  }
  function opTime(o){if(o&&Number.isFinite(+o.ts))return +o.ts;const match=String(o?.date||'').match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{4}),?\s*(\d{1,2})?:?(\d{2})?:?(\d{2})?/);if(match)return new Date(+match[3],+match[2]-1,+match[1],+(match[4]||0),+(match[5]||0),+(match[6]||0)).getTime();return +o.id||0;}
  function paymentBalances(s,d){
    let balance=0;
    for(const o of (s.ops||[]).filter(o=>dealerId(s,o.dealerId)===d).slice().sort((a,b)=>opTime(a)-opTime(b))){
      if(o.type==='payment'){o.beforeDebt=balance;balance=Number((balance-(Number(o.total)||0)).toFixed(6));o.afterDebt=balance;}
      else if(o.type==='sale'||o.type==='initial_debt')balance=Number((balance+(Number(o.total)||0)).toFixed(6));
    }
  }
  function apply(s,command,now=Date.now()){
    if(!command||command.confirmed!==true||command.preserveStock!==true||!['dealer','history','operation'].includes(command.target)||!/^[-a-zA-Z0-9:]{8,120}$/.test(command.requestId||''))throw Error('Подтвердите полное удаление с сохранением склада');
    let out=C.clone(s);out.permanentDeletions=marks(out);
    const m=out.permanentDeletions,d=dealerId(out,command.dealerId);
    const signature={target:command.target,dealerId:d,operationId:command.target==='operation'?C.id(command.operationId):null};
    if(m.requests[command.requestId]){
      if(!C.same(m.requests[command.requestId].command,signature))throw Error('Номер команды удаления уже использован');
      return out;
    }
    const dealer=(out.dealers||[]).find(row=>dealerId(out,row.id)===d);
    if(!dealer&&!m.dealers[d])throw Error('Дилер не найден. Удаление отменено');
    let removed=(out.ops||[]).filter(o=>dealerId(out,o.dealerId)===d);
    if(command.target==='operation'){
      removed=removed.filter(o=>C.id(o.id)===C.id(command.operationId));
      if(removed.length&&removed[0].type!=='initial_debt')throw Error('Эта команда удаляет только сумму из тетради');
      if(!removed.length&&!m.operations[C.id(command.operationId)])throw Error('Сумма не найдена у выбранного дилера');
      m.operations[C.id(command.operationId)]=now;
    }else{
      for(const e of Object.values(out.receiptStates||{}))if(e.receipt&&dealerId(out,e.receipt.dealerId)===d)m.operations[C.id(e.receipt.id)]=now;
      if(command.target==='dealer'){
        m.dealers[d]=now;
        for(const k of Object.keys(out.dealerAliases||{}))if(dealerId(out,k)===d)m.dealers[k]=now;
        out.deletedDealers={...out.deletedDealers,...m.dealers};
        const identity=dealer&&C.dealerKey(dealer);if(identity)out.catalogDeletedKeys={...out.catalogDeletedKeys,['dealers:'+identity]:true};
      }else m.history[d]=Math.max((Number(m.history[d])||0)+1,now);
    }
    for(const o of removed)m.operations[C.id(o.id)]=now;
    m.requests[command.requestId]={at:now,command:signature};
    out=sanitize(out);
    // Removing accounting history is not a physical return of goods.
    const before=C.quantities(s.ops),after=C.quantities(out.ops);
    for(const p of out.products||[])if(p.inventoryVersion===2)p.warehouseOpening=Number((Number(p.warehouseOpening)-(before[C.id(p.id)]||0)+(after[C.id(p.id)]||0)).toFixed(6));
    C.recalcInventory(out);paymentBalances(out,d);
    return out;
  }
  function markOperationDeletes(s,changes,archives,now=Date.now()){
    const out=C.clone(s);out.permanentDeletions=marks(out);
    for(const ch of changes||[])if(ch.before&&['payment','initial_debt'].includes(ch.before.type)&&!ch.after&&!archives?.receiptStates?.some(a=>C.id(a.key)===C.id(ch.id)&&a.after?.archived))out.permanentDeletions.operations[C.id(ch.id)]=now;
    return out;
  }
  function draftBlocked(s,draft){
    const m=marks(s),d=dealerId(s,draft.dealerId);
    const identity=C.dealerKey({name:draft.dealerName,phone:draft.dealerPhone});
    return !!(m.dealers[d]||identity&&s.catalogDeletedKeys?.['dealers:'+identity]||m.history[d]&&Number(draft.historyEpoch8989)!==Number(m.history[d]));
  }
  return {apply,sanitize,blocked,filterChanges,filterArchives,markOperationDeletes,draftBlocked};
});
