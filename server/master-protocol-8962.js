'use strict';
const C=require('./sync-core-8962');
const {applySharedPatch}=require('./catalog-patch-8975');
const fail=message=>{throw new Error(message);};

const productWire=p=>{
  if(!p)return null;
  const x=C.clone(p);
  delete x.stock;
  delete x.inventoryVersion;
  delete x.warehouseOpening;
  if(p.inventoryVersion===2)delete x.initialStock;
  delete x.receiptArchiveStock;
  return x;
};
const productUser=p=>{
  const x=productWire(p);
  if(!x)return null;
  delete x.catalogRev;
  delete x.catalogUpdatedAt;
  delete x.catalogUpdatedBy;
  return x;
};
const productListView=list=>(list||[])
  .map(productWire)
  .sort((a,b)=>C.id(a.id).localeCompare(C.id(b.id),'en',{numeric:true}));
const nonProductCatalog=s=>({
  dealers:C.clone(s?.dealers||[]),
  groups:C.clone(s?.groups||[]),
  deletedDealers:C.clone(s?.deletedDealers||{}),
  dealerAliases:C.clone(s?.dealerAliases||{})
});
function applyNonProductCatalog(previous,incoming){
  const synthetic=C.catalog(previous);
  const value=nonProductCatalog(incoming||{});
  synthetic.dealers=value.dealers;
  synthetic.groups=value.groups;
  synthetic.deletedDealers=value.deletedDealers;
  synthetic.dealerAliases=value.dealerAliases;
  return C.applyCatalog(previous,synthetic);
}
function applyProductChanges(state,changes,device,inventoryProtocol){
  const out=C.clone(state||{});
  out.products=Array.isArray(out.products)?out.products:[];
  out.deletedProducts=out.deletedProducts&&typeof out.deletedProducts==='object'?out.deletedProducts:{};
  const map=new Map(out.products.map(p=>[C.id(p.id),p]));
  for(const change of changes||[]){
    if(!change||!change.id)fail('Неверное изменение карточки товара');
    const key=C.id(change.id);
    if(change.after&&C.id(change.after.id)!==key)fail('Неверный номер карточки товара');
    const current=map.get(key)||null;
    if(change.after&&out.deletedProducts[key])fail('Товар удалён на другом компьютере');
    const before=change.before?productWire(change.before):null;
    const after=change.after?productWire(change.after):null;
    const currentWire=current?productWire(current):null;

    // Повтор после потерянного подтверждения: сервер уже хранит ровно те
    // пользовательские поля, которые клиент пытался записать.
    if(after&&current&&C.same(productUser(current),productUser(after))&&
       Number(current.catalogRev||0)>=Number(before?.catalogRev||0)+1){
      continue;
    }
    if(!after&&!current)continue;
    if(!after&&current?.inventoryVersion===2&&(out.ops||[]).some(op=>(op.items||[]).some(item=>C.id(item.productId)===key)))fail('Товар есть в документах склада. Архивируйте карточку вместо удаления.');

    // Старый компьютер не может записать карточку поверх более новой.
    if(!C.same(currentWire,before)){
      fail('Карточка товара '+key+' уже изменена на другом компьютере. Сначала получите свежую версию.');
    }

    if(after){
      const next=C.clone(after);
      if(current){
        next.stock=current.stock;
        for(const field of ['inventoryVersion','warehouseOpening','initialStock'])if(current[field]!=null)next[field]=current[field];
        if(Object.prototype.hasOwnProperty.call(current,'receiptArchiveStock')){
          next.receiptArchiveStock=C.clone(current.receiptArchiveStock);
        }
      }else{
        next.stock=Number(next.stock)||0;
        if(inventoryProtocol===2){next.inventoryVersion=2;next.warehouseOpening=0;}
      }
      next.catalogRev=(Number(current?.catalogRev)||0)+1;
      next.catalogUpdatedAt=new Date().toISOString();
      next.catalogUpdatedBy=device?.id||'unknown';
      map.set(key,next);
      delete out.deletedProducts[key];
    }else{
      map.delete(key);
      out.deletedProducts[key]=Date.now();
    }
  }
  out.products=[...map.values()];
  return C.remap(out);
}
function auditProductChanges(next,current,changes,device){
  if(!changes?.length)return;
  const slim=p=>p?{
    id:p.id,
    name:p.name||'',
    article:p.article||'',
    buyPrice:Number(p.buyPrice)||0,
    retailPrice:Number(p.retailPrice)||0,
    wholesalePrice:Number(p.wholesalePrice)||0,
    catalogRev:Number(p.catalogRev)||0
  }:null;
  const rows=changes.map(change=>({
    ts:new Date().toISOString(),
    deviceId:device?.id||'unknown',
    deviceName:String(device?.name||''),
    productId:C.id(change.id),
    before:slim(change.before),
    after:slim((next.state.products||[]).find(p=>C.id(p.id)===C.id(change.id))||null)
  }));
  next.catalogAudit=[...(current.catalogAudit||[]),...rows].slice(-5000);
}

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
    const orphanOps=(selected.ops||[]).filter(op=>!C.warehouseTypes.includes(op.type)&&!dealerIds.has(C.id(op.dealerId)));
    selected.ops=(selected.ops||[]).filter(op=>C.warehouseTypes.includes(op.type)||dealerIds.has(C.id(op.dealerId)));

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
    C.recalcInventory(next.state);C.remap(next.state);
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
  const transactionBase=C.clone(current.state);
  if(body.inventoryProtocol===2)C.enableInventory(transactionBase);
  next.state=C.applyTransaction(transactionBase,body.changes||[],body.archives);

  // 8.9.78: товары изменяются точечно на любом компьютере.
  // Сервер сравнивает "before" с текущей карточкой и сам повышает catalogRev.
  if(Array.isArray(body.productChanges)&&body.productChanges.length){
    next.state=applyProductChanges(next.state,body.productChanges,device,body.inventoryProtocol);
    auditProductChanges(next,current,body.productChanges,device);
  }

  // Дилеры/группы пока остаются под контролем главного компьютера.
  if(body.catalogNonProducts){
    if(device.id!==meta.masterId)fail('Дилеры и группы изменяются на главном компьютере.');
    fail('Полная замена справочника локальной копией запрещена. Обновите программу: изменения отправляются точечно.');
  }

  // Совместимость со старыми клиентами: разрешаем им обновлять дилеров/группы,
  // но не позволяем старому полному catalog вернуть прежнюю цену товара.
  if(body.catalog){
    if(device.id!==meta.masterId)fail('Справочники изменяются на главном компьютере.');
    if(!C.same(productListView(body.catalog.products||[]),productListView(next.state.products||[]))){
      fail('Старая версия программы попыталась заменить каталог товаров. Обновите программу перед изменением цен.');
    }
    fail('Полная замена справочника локальной копией запрещена. Обновите программу: изменения отправляются точечно.');
  }
  if((body.stockOverrides||[]).length&&next.state.products.some(p=>p.inventoryVersion===2))fail('Используйте документ корректировки склада вместо замены остатка');
  if(body.catalogPatch){
    const products=body.catalogPatch.products||[];
    next.state=applyProductChanges(next.state,products,device,body.inventoryProtocol);
    auditProductChanges(next,current,products,device);
    next.state=applySharedPatch(next.state,{...body.catalogPatch,products:[]});
  }
  for(const edit of body.stockOverrides||[]){
    if(device.id!==meta.masterId)fail('Остатки вручную изменяются на главном компьютере.');
    const previous=(current.state.products||[]).find(p=>C.id(p.id)===edit.id),p=next.state.products.find(p=>C.id(p.id)===edit.id);
    if(!previous||!p||Number(previous.stock)!==Number(edit.before)||!Number.isFinite(edit.after))fail('Остаток изменён другим компьютером');
    p.stock+=edit.after-Number(previous.stock);
  }
  if(body.inventoryProtocol===2)C.enableInventory(next.state);
  C.recalcInventory(next.state);
  C.remap(next.state);
  for(const change of body.changes||[]){
    if(!change.after)continue;
    const op=next.state.ops.find(o=>C.id(o.id)===change.id);
    if(C.warehouseTypes.includes(op.type)){
      if(op.type==='stock_opening'){
        for(const item of op.items||[]){
          const count=s=>(s.ops||[]).filter(o=>o.type==='stock_opening'&&o.items?.some(i=>C.id(i.productId)===C.id(item.productId))).length;
          if(count(next.state)>Math.max(1,count(current.state)))fail('Начальный остаток уже введён. Используйте корректировку');
        }
      }
      if(body.inventoryProtocol!==2)fail('Обновите программу для работы со складом');
      if(!Array.isArray(op.items)||!op.items.length||!/^\d{4}-\d{2}-\d{2}$/.test(op.date)||(!Number.isFinite(Date.parse(op.date))||new Date(op.date).toISOString().slice(0,10)!==op.date))fail('Неверный складской документ');
      for(const item of op.items){
        if(item.openingCount!==undefined&&(!Number.isFinite(item.openingCount)||item.openingCount<0))fail('Неверное начальное количество');
        if(!next.state.products.some(p=>C.id(p.id)===C.id(item.productId)))fail('Товар складского документа отсутствует');
        if(!Number.isFinite(item.qty)||(item.qty===0&&op.type!=='stock_opening')||(['stock_receipt','stock_return','stock_expense'].includes(op.type)&&item.qty<=0)||!Number.isFinite(item.buyPrice)||item.buyPrice<0)fail('Неверное количество или закупочная цена');
      }
      continue;
    }
    if(!next.state.dealers.some(d=>C.id(d.id)===C.id(op.dealerId)))fail('Дилер операции '+op.id+' отсутствует в главном справочнике. Операция сохранена на рабочем компьютере.');
    if(!['sale','payment','initial_debt'].includes(op.type)||!Number.isFinite(Number(op.total)))fail('Неверная операция '+op.id);
  }
  next.state.receiptSeq=Math.max(Number(next.state.receiptSeq)||1,...next.state.ops.map(o=>(Number(o.receiptNo)||0)+1));
  return next;
}
module.exports={update};
