'use strict';
const C=require('./sync-core-8962');const fail=m=>{throw new Error(m)};
const stamp=x=>Number(x?.updatedAt)||0;
function applyCatalogPatch(state,patch){
 if(!patch)return state;const next=C.clone(state);
 for(const g of patch.groups||[]){const i=next.groups.findIndex(x=>C.id(x.id)===C.id(g.id));if(i<0)next.groups.push(C.clone(g));else if(C.same(next.groups[i],g)){}else next.groups[i]=C.clone(g)}
 for(const ch of patch.products||[]){if(!ch?.id)fail('Неверная карточка товара');const i=next.products.findIndex(x=>C.id(x.id)===C.id(ch.id)),cur=i>=0?next.products[i]:null;if(C.same(cur,ch.after))continue;if(!C.same(cur,ch.before)){if(cur&&ch.after&&stamp(ch.after)>stamp(cur)){const keepStock=cur.stock,keepArchive=cur.receiptArchiveStock;next.products[i]=C.clone(ch.after);next.products[i].stock=keepStock;next.products[i].receiptArchiveStock=keepArchive;continue}fail('Карточка товара '+ch.id+' изменена на другом компьютере. Сначала загрузите базу и повторите изменение.')}if(ch.after){const row=C.clone(ch.after);if(cur){row.stock=cur.stock;row.receiptArchiveStock=cur.receiptArchiveStock}if(i>=0)next.products[i]=row;else next.products.push(row)}else if(i>=0)next.products.splice(i,1)}
 return C.canonicalize(next);
}
function update(current,body){
 if(body.protocol!==2)fail('Обновите программу. Старый протокол синхронизации не принят.');const device=body.device;if(!device||!/^[a-zA-Z0-9-]{16,80}$/.test(device.id))fail('Не определён компьютер');const next=C.clone(current),meta=next.computers||{masterId:null,devices:{}};meta.devices=meta.devices||{};const old=meta.devices[device.id],ordinal=old?.ordinal||Math.max(0,...Object.values(meta.devices).map(d=>Number(d?.ordinal)||0))+1,incomingName=String(device.name||'').trim().slice(0,80);let displayName=old?.name||(body.action==='claim'&&!meta.masterId?'Компьютер 1 · Главный':'Компьютер '+ordinal);if(old&&incomingName&&incomingName!==old.clientName&&!/^Компьютер [a-z0-9-]{4,}$/i.test(incomingName)&&!/^Компьютер \d+(?: · Главный)?$/u.test(incomingName))displayName=incomingName;meta.devices[device.id]={...old,name:displayName,clientName:incomingName,ordinal,lastSeen:new Date().toISOString()};next.computers=meta;
 if(body.action==='register')return next;
 if(body.action==='claim'){if(meta.masterId)fail('Главный компьютер уже выбран.');if(!body.state)fail('Не передана база главного компьютера');const selected=C.canonicalize(body.state),remote=C.clone(current.state||{});next.state=C.applyCatalog(remote,selected);
  const dealerIds=new Set((next.state.dealers||[]).map(d=>C.id(d.id))),ops=new Map(),quarantine=[];
  const keep=(op,source)=>{if(!op||op.id==null)return;const copy=C.clone(op),tmp=C.clone(next.state);tmp.ops=[copy];C.remap(tmp);const normalized=tmp.ops[0],known=dealerIds.has(C.id(normalized.dealerId));if(!known){quarantine.push({source,reason:'unknown_dealer',op:copy});return;}if(source==='server'&&!['payment','initial_debt'].includes(normalized.type)){quarantine.push({source,reason:'pre_master_non_financial',op:copy});return;}ops.set(C.id(normalized.id),normalized)};
  for(const op of remote.ops||[])keep(op,'server');
  for(const op of selected.ops||[])keep(op,'master');
  next.state.ops=[...ops.values()];
  if(quarantine.length)next.claimQuarantine={savedAt:new Date().toISOString(),operations:quarantine};
  C.remap(next.state);next.state.receiptSeq=Math.max(Number(next.state.receiptSeq)||1,...next.state.ops.map(o=>(Number(o.receiptNo)||0)+1));
  meta.masterId=device.id;meta.epoch=1;meta.devices[device.id].name='Компьютер 1 · Главный';return next}
 if(!meta.masterId)fail('Сначала выберите главный компьютер.');
 if(body.action==='transfer'){if(meta.masterId!==device.id)fail('Передать роль можно только с текущего главного компьютера.');if(!meta.devices[body.targetId])fail('Выбранный компьютер не подключён');const oldMaster=meta.masterId;meta.masterId=body.targetId;meta.epoch=(meta.epoch||0)+1;if(meta.devices[oldMaster])meta.devices[oldMaster].name='Компьютер '+(meta.devices[oldMaster].ordinal||1);if(meta.devices[body.targetId])meta.devices[body.targetId].name='Компьютер '+(meta.devices[body.targetId].ordinal||2)+' · Главный';return next}
 if(body.action!=='changes')fail('Неизвестная команда синхронизации');
 next.state=C.applyTransaction(current.state,body.changes||[],body.archives);
 if(body.catalog){if(device.id!==meta.masterId)fail('Полный справочник может отправляться только на главном компьютере.');const selected=C.clone(body.catalog);for(const p of selected.products||[]){const e=next.state.products.find(x=>C.id(x.id)===C.id(p.id));if(e){p.stock=e.stock;p.receiptArchiveStock=e.receiptArchiveStock}}next.state=C.applyCatalog(next.state,selected)}
 if(body.catalogPatch)next.state=applyCatalogPatch(next.state,body.catalogPatch);
 for(const edit of body.stockOverrides||[]){if(device.id!==meta.masterId)fail('Остатки вручную изменяются на главном компьютере.');const prev=(current.state.products||[]).find(p=>C.id(p.id)===edit.id),p=next.state.products.find(p=>C.id(p.id)===edit.id);if(!prev||!p||Number(prev.stock)!==Number(edit.before)||!Number.isFinite(edit.after))fail('Остаток изменён другим компьютером');p.stock+=edit.after-Number(prev.stock)}
 C.remap(next.state);for(const change of body.changes||[]){if(!change.after)continue;const op=next.state.ops.find(o=>C.id(o.id)===change.id);if(!next.state.dealers.some(d=>C.id(d.id)===C.id(op.dealerId)))fail('Дилер операции отсутствует в общем справочнике');if(!['sale','payment','initial_debt'].includes(op.type)||!Number.isFinite(Number(op.total)))fail('Неверная операция '+op.id)}next.state.receiptSeq=Math.max(Number(next.state.receiptSeq)||1,...next.state.ops.map(o=>(Number(o.receiptNo)||0)+1));return next}
module.exports={update};