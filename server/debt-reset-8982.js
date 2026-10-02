'use strict';
// Preparation only: preserve every catalog card and historical document.
// Returned changes use the existing initial_debt operation supported by all clients.
function prepareDebtReset(state, resetId, timestamp=Date.now()) {
  if(!/^[a-zA-Z0-9-]{16,80}$/.test(String(resetId))) throw new Error('Invalid reset ID');
  const previous=(state.ops||[]).filter(op=>op.debtResetId===resetId);
  if(previous.length)return {changes:[],dealers:previous.length};
  const balances=new Map((state.dealers||[]).map(d=>[String(d.id),0]));
  for(const op of state.ops||[]) {
    const id=String(op.dealerId);
    if(!balances.has(id))continue;
    const total=Number(op.total)||0;
    if(op.type==='sale'||op.type==='initial_debt')balances.set(id,balances.get(id)+total);
    else if(op.type==='payment')balances.set(id,balances.get(id)-total);
  }
  const changes=[];
  for(const dealer of state.dealers||[]) {
    const total=-Number(balances.get(String(dealer.id)).toFixed(2));
    if(total===0)continue;
    const id=Number.parseInt(require('node:crypto').createHash('sha256').update(resetId+'|'+dealer.id).digest('hex').slice(0,13),16);
    if(!id||(state.ops||[]).some(op=>String(op.id)===String(id))||changes.some(ch=>ch.id===String(id)))throw new Error('Reset ID collision');
    changes.push({id:String(id),before:null,after:{id,type:'initial_debt',dealerId:dealer.id,dealer:dealer.name,total,ts:timestamp,date:new Date(timestamp).toLocaleString('ru-RU'),note:'Обнуление задолженности перед началом рабочего учёта',debtResetId:resetId}});
  }
  return {changes,dealers:changes.length};
}
module.exports={prepareDebtReset};
