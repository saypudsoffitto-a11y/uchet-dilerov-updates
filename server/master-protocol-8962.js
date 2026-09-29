'use strict';
const C=require('./sync-core-8962');
const fail=message=>{throw new Error(message);};

const productWire=p=>{
  if(!p)return null;
  const x=C.clone(p);
  delete x.stock;
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
function applyProductChanges(state,changes,device){
  const out=C.clone(state||{});
  out.products=Array.isArray(out.products)?out.products:[];
  out.deletedProducts=out.deletedProducts&&typeof out.deletedProducts==='object'?out.deletedProducts:{};
  const map=new Map(out.products.map(p=>[C.id(p.id),p]));
  for(const change of changes||[]){
    if(!change||!change.id)fail('Неверное изменение карточки товара');
    const key=C.id(change.id);
    if(change.after&&C.id(change.after.id)!==key)fail('Неверный номер карточки товара');
    const current=map.get(key)||null;
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

    // Старый компьютер не может записать карточку поверх более новой.
    if(!C.same(currentWire,before)){
      fail('Карточка товара '+key+' уже изменена на другом компьютере. Сначала получите свежую версию.');
    }

    if(after){
      const next=C.clone(after);
      if(current){
        next.stock=current.stock;
        if(Object.prototype.hasOwnProperty.call(current,'receiptArchiveStock')){
          next.receiptArchiveStock=C.clone(current.receiptArchiveStock);
        }
      }else{
        next.stock=Number(next.stock)||0;
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
    const selected=C.canonicalize(body.state),remote=C.clone(current.state||{});
    selected.ops=C.applyOps(remote,C.diffOps([],selected.ops).filter(change=>!remote.ops?.some(o=>C.id(o.id)===change.id))).ops||[];
    // Equal IDs with unequal contents cannot be silently overwritten at migration.
    for(const op of body.state.ops||[]){const old=(remote.ops||[]).find(x=>C.id(x.id)===C.id(op.id));if(old&&!C.same(old,op))fail('Перед выбором главного компьютера нужно сверить операцию '+op.id);}
    for(const field of ['receiptStates','receiptItemStates']){
      const local=selected[field]||{},other=remote[field]||{};
      for(const key of Object.keys(local))if(other[key]&&!C.same(other[key],local[key]))fail('Архив чека требует сверки перед назначением главного компьютера');
      selected[field]={...other,...local};
    }
    selected.dealerAliases={...(remote.dealerAliases||{}),...(selected.dealerAliases||{})};
    for(const old of remote.dealers||[]){
      if(selected.dealers.some(d=>C.id(d.id)===C.id(old.id)))continue;
      const matches=selected.dealers.filter(d=>C.dealerKey(d)&&C.dealerKey(d)===C.dealerKey(old));
      if(matches.length===1)selected.dealerAliases[C.id(old.id)]=C.id(matches[0].id);
    }
    C.remap(selected);
    if(selected.ops.some(op=>!selected.dealers.some(d=>C.id(d.id)===C.id(op.dealerId))))fail('На сервере есть операции дилеров, которых нет в выбранном списке. Сначала нужно сверить эти карточки.');
    next.state=C.applyCatalog(remote,selected);next.state.ops=selected.ops;next.state.receiptStates=selected.receiptStates;next.state.receiptItemStates=selected.receiptItemStates;C.remap(next.state);
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

  // 8.9.78: товары изменяются точечно на любом компьютере.
  // Сервер сравнивает "before" с текущей карточкой и сам повышает catalogRev.
  if(Array.isArray(body.productChanges)&&body.productChanges.length){
    next.state=applyProductChanges(next.state,body.productChanges,device);
    auditProductChanges(next,current,body.productChanges,device);
  }

  // Дилеры/группы пока остаются под контролем главного компьютера.
  if(body.catalogNonProducts){
    if(device.id!==meta.masterId)fail('Дилеры и группы изменяются на главном компьютере.');
    next.state=applyNonProductCatalog(next.state,body.catalogNonProducts);
  }

  // Совместимость со старыми клиентами: разрешаем им обновлять дилеров/группы,
  // но не позволяем старому полному catalog вернуть прежнюю цену товара.
  if(body.catalog){
    if(device.id!==meta.masterId)fail('Справочники изменяются на главном компьютере.');
    if(!C.same(productListView(body.catalog.products||[]),productListView(next.state.products||[]))){
      fail('Старая версия программы попыталась заменить каталог товаров. Обновите программу перед изменением цен.');
    }
    next.state=applyNonProductCatalog(next.state,body.catalog);
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
