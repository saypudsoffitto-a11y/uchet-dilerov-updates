'use strict';
const C=require('./sync-core-8962');
const definition=p=>p?Object.fromEntries(Object.entries(p).filter(([k])=>!['stock','receiptArchiveStock'].includes(k))):null;
function applyCatalogPatch(state,patch){
 if(!patch||!Array.isArray(patch.products))throw Error('Неверные изменения карточек товаров');
 const next=C.clone(state);next.products=next.products||[];next.groups=next.groups||[];
 for(const ch of patch.products){
  if(!ch||!ch.id||ch.after&&C.id(ch.after.id)!==C.id(ch.id))throw Error('Неверный номер карточки товара');
  const i=next.products.findIndex(p=>C.id(p.id)===C.id(ch.id)),current=i<0?null:next.products[i];
  if(ch.after&&next.deletedProducts?.[C.id(ch.id)])throw Error('Товар удалён на другом компьютере');
  if(C.same(definition(current),definition(ch.after)))continue;
  if(!C.same(definition(current),definition(ch.before)))throw Error('Карточка товара '+ch.id+' изменена на другом компьютере. Локальная правка сохранена.');
  if(ch.after){
   const row=C.clone(ch.after);
   if(!String(row.name||'').trim())throw Error('Укажите название товара');
   if(current){row.stock=current.stock;row.receiptArchiveStock=current.receiptArchiveStock;next.products[i]=row;}
   else {row.stock=0;delete row.receiptArchiveStock;next.products.push(row);}
  }else if(i>=0){next.products.splice(i,1);next.deletedProducts={...next.deletedProducts,[C.id(ch.id)]:Date.now()};}
 }
 // Workers may add a referenced group; existing group definitions stay authoritative.
 for(const group of patch.groups||[]){
  if(!group||group.id==null)throw Error('Неверная группа товара');
  const current=next.groups.find(g=>C.id(g.id)===C.id(group.id));
  if(!current)next.groups.push(C.clone(group));
  else if(!C.same(current,group))throw Error('Группа изменена на другом компьютере');
 }
 return C.canonicalize(next);
}
module.exports={applyCatalogPatch};

// Checked row deltas are accepted from every registered computer.
module.exports.applySharedPatch=function(state,patch){
 let next=applyCatalogPatch(state,{products:patch.products||[],groups:patch.groups||[]});
 for(const field of ['dealers','groups']){
  const changes=field==='groups'?patch.groupChanges:patch.dealers;
  for(const ch of changes||[]){
   if(!ch?.id||ch.after&&C.id(ch.after.id)!==C.id(ch.id))throw Error('Неверная карточка '+field);
   const i=(next[field]||[]).findIndex(row=>C.id(row.id)===C.id(ch.id)),current=i<0?null:next[field][i];
   if(C.same(current,ch.after))continue;
   if(!C.same(current,ch.before))throw Error('Карточка '+field+' '+ch.id+' изменена на другом компьютере');
   if(ch.after){
    if(field==='dealers'&&next.deletedDealers?.[ch.id])throw Error('Дилер удалён на другом компьютере');
    if(field==='dealers'&&!current){
     const phone=C.phone(ch.after.phone);
     if(!phone)throw Error('Укажите телефон нового дилера');
     if(next.dealers.some(d=>C.phone(d.phone)===phone))throw Error('Дилер с этим телефоном уже есть в общей базе. Откройте его карточку.');
    }
    if(i<0)next[field].push(C.clone(ch.after));else next[field][i]=C.clone(ch.after);
   }else if(i>=0){
    if(field==='dealers'&&(next.ops||[]).some(o=>C.id(o.dealerId)===C.id(ch.id)))throw Error('У дилера остались документы. Удаление не выполнено.');
    next[field].splice(i,1);
    if(field==='dealers')next.deletedDealers={...next.deletedDealers,[ch.id]:Date.now()};
   }
  }
 }
 for(const field of ['deletedProducts','deletedDealers','productAliases','dealerAliases','catalogDeletedKeys']){
  for(const ch of patch.mapChanges?.[field]||[]){
   const map=next[field]||(next[field]={}),current=map[ch.key]??null;
   if(C.same(current,ch.after))continue;
   // Locally generated deletion timestamps may differ; keep the server tombstone.
   if(field.startsWith('deleted')&&current&&ch.after)continue;
   if(!C.same(current,ch.before??null))throw Error('Справочник изменён на другом компьютере');
   if(ch.after==null){if(field.startsWith('deleted'))throw Error('Нельзя отменить удаление старой копией');delete map[ch.key];}
   else map[ch.key]=C.clone(ch.after);
  }
 }
 return C.canonicalize(next);
};
