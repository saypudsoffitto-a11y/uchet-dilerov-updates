'use strict';
const C=require('./sync-core-8962');
const fail=message=>{throw new Error(message);};
function update(current,body){
  if(body.protocol!==2)fail('Обновите этот компьютер до 8.9.63. Старые списки не приняты.');
  const device=body.device;
  if(!device||!/^[a-zA-Z0-9-]{16,80}$/.test(device.id)||!String(device.name||'').trim())fail('Укажите название компьютера');
  const next=C.clone(current),meta=next.computers||{masterId:null,devices:{}};
  meta.devices=meta.devices||{};
  const existingDevice=meta.devices[device.id];
  const ordinal=existingDevice?.ordinal||Math.max(1,...Object.values(meta.devices).map(d=>Number(d?.ordinal)||0))+1;
  let displayName=existingDevice?.name||String(device.name).trim().slice(0,80);
  if(!existingDevice){
    displayName=body.action==='claim'&&!meta.masterId?'Компьютер 1 · Главный':'Компьютер '+ordinal;
  }else if(String(device.name||'').trim()&&String(device.name).trim()!==existingDevice.clientName){
    const incoming=String(device.name).trim().slice(0,80);
    if(!/^Компьютер [a-z0-9-]{4,}$/i.test(incoming)&&!/^Компьютер \d+(?: · Главный)?$/u.test(incoming))displayName=incoming;
  }
  meta.devices[device.id]={...existingDevice,name:displayName,clientName:String(device.name).trim().slice(0,80),ordinal,lastSeen:new Date().toISOString()};
  next.computers=meta;
  if(body.action==='register')return next;
  if(body.action==='claim'){
    if(meta.masterId)fail('Главный компьютер уже выбран. Сменить его можно с главного компьютера.');
    if(!body.state||!Array.isArray(body.state.dealers)||!Array.isArray(body.state.products))fail('Не передан выбранный справочник');
    const selected=C.canonicalize(body.state);
    // The first designated master is authoritative. Do not mix any pre-master
    // server state into it: old workers/test migrations may contain stale ops,
    // aliases or deletion marks. server.js keeps the whole pre-master store in
    // beforeMaster so nothing is destroyed.
    C.remap(selected);
    const dealerIds=new Set((selected.dealers||[]).map(d=>C.id(d.id)));
    const orphanOps=(selected.ops||[]).filter(op=>!dealerIds.has(C.id(op.dealerId)));
    selected.ops=(selected.ops||[]).filter(op=>dealerIds.has(C.id(op.dealerId)));

    const orphanReceiptStates={},activeReceiptStates={};
    for(const [key,entry] of Object.entries(selected.receiptStates||{})){
      const receipt=entry&&entry.receipt;
      if(receipt&&receipt.dealerId!=null&&!dealerIds.has(C.id(receipt.dealerId)))orphanReceiptStates[key]=entry;
      else activeReceiptStates[key]=entry;
    }
    const orphanReceiptItemStates={},activeReceiptItemStates={};
    for(const [key,entry] of Object.entries(selected.receiptItemStates||{})){
      if(entry&&entry.dealerId!=null&&!dealerIds.has(C.id(entry.dealerId)))orphanReceiptItemStates[key]=entry;
      else activeReceiptItemStates[key]=entry;
    }
    selected.receiptStates=activeReceiptStates;
    selected.receiptItemStates=activeReceiptItemStates;

    if(orphanOps.length||Object.keys(orphanReceiptStates).length||Object.keys(orphanReceiptItemStates).length){
      next.claimQuarantine={
        savedAt:new Date().toISOString(),
        orphanOps:C.clone(orphanOps),
        receiptStates:C.clone(orphanReceiptStates),
        receiptItemStates:C.clone(orphanReceiptItemStates)
      };
    }

    // Build the live shared state from the selected master only. In particular,
    // do not inherit stale remote tombstones that could delete a current card.
    next.state=C.applyCatalog({ops:[],receiptStates:{},receiptItemStates:{}},selected);
    next.state.ops=C.clone(selected.ops||[]);
    next.state.receiptStates=C.clone(selected.receiptStates||{});
    next.state.receiptItemStates=C.clone(selected.receiptItemStates||{});
    next.state.receiptSeq=Math.max(Number(selected.receiptSeq)||1,...next.state.ops.map(o=>(Number(o.receiptNo)||0)+1));
    C.remap(next.state);
    meta.masterId=device.id;meta.epoch=1;
    meta.devices[device.id].name='Компьютер 1 · Главный';
    meta.devices[device.id].ordinal=1;
    return next;
  }
  if(!meta.masterId)fail('Сначала выберите главный компьютер с правильным списком дилеров и товаров.');
  if(body.action==='transfer'){
    if(meta.masterId!==device.id)fail('Сменить главный компьютер можно только с текущего главного.');
    if(!meta.devices[body.targetId])fail('Сначала подключите выбранный компьютер');
    const oldMaster=meta.masterId;
    meta.masterId=body.targetId;meta.epoch=(meta.epoch||0)+1;
    if(meta.devices[oldMaster])meta.devices[oldMaster].name='Компьютер '+(meta.devices[oldMaster].ordinal||1);
    if(meta.devices[body.targetId])meta.devices[body.targetId].name='Компьютер '+(meta.devices[body.targetId].ordinal||2)+' · Главный';
    return next;
  }
  if(body.action!=='changes')fail('Неизвестная команда синхронизации');
  next.state=C.applyTransaction(current.state,body.changes||[],body.archives);
  if(body.catalog){
    if(device.id!==meta.masterId)fail('Справочники изменяются на главном компьютере.');
    const selected=C.clone(body.catalog);
    for(const p of selected.products||[]){const existing=next.state.products.find(x=>C.id(x.id)===C.id(p.id));if(existing){p.stock=existing.stock;p.receiptArchiveStock=existing.receiptArchiveStock;}}
    next.state=C.applyCatalog(next.state,selected);
  }
  for(const edit of body.stockOverrides||[]){
    if(device.id!==meta.masterId)fail('Остатки вручную изменяются на главном компьютере.');
    const previous=(current.state.products||[]).find(p=>C.id(p.id)===edit.id),p=next.state.products.find(p=>C.id(p.id)===edit.id);
    if(!previous||!p||Number(previous.stock)!==Number(edit.before)||!Number.isFinite(edit.after))fail('Остаток изменён другим компьютером');
    p.stock+=edit.after-Number(previous.stock);
  }
  C.remap(next.state);
  for(const change of body.changes||[]){
    if(!change.after)continue;
    const op=next.state.ops.find(o=>C.id(o.id)===change.id);
    if(!next.state.dealers.some(d=>C.id(d.id)===C.id(op.dealerId)))fail('Дилер операции '+op.id+' отсутствует в главном справочнике. Операция сохранена на рабочем компьютере.');
    if(!['sale','payment','initial_debt'].includes(op.type)||!Number.isFinite(Number(op.total)))fail('Неверная операция '+op.id);
  }
  next.state.receiptSeq=Math.max(Number(next.state.receiptSeq)||1,...next.state.ops.map(o=>(Number(o.receiptNo)||0)+1));
  return next;
}
module.exports={update};
