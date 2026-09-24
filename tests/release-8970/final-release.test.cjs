'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const pkg=JSON.parse(read('app/package.json'));
const preload=read('app/preload.js');
const r69=read('app/release-8969.js');
const r70=read('app/release-8970.js');
const master=read('app/master-sync-8962.js');
const protocol=read('server/master-protocol-8962.js');

test('8.9.70 fixes remain packaged and loaded on later releases',()=>{
  const parts=String(pkg.version||'').split('.').map(Number);
  assert.equal(parts[0],8);
  assert.equal(parts[1],9);
  assert(parts[2]>=70,'current release must be 8.9.70 or newer');
  assert.equal(pkg.main,'main-8948.js');
  assert(pkg.build.files.includes('release-8969.js'));
  assert(pkg.build.files.includes('release-8970.js'));
  const p69=preload.indexOf("'./release-8969.js'");
  const p70=preload.indexOf("'./release-8970.js'");
  assert(p69>=0&&p70>p69,'8.9.69 and 8.9.70 runtime layers must remain loaded in order');
});

test('approved 8.9.67 JPEG handler loads after legacy 8.9.68 and stays final',()=>{
  const p68=preload.indexOf("'./release-8968.js'");
  const p67=preload.indexOf("'./release-8967.js'");
  const p69=preload.indexOf("'./release-8969.js'");
  assert(p68>=0&&p67>p68&&p69>p67);
  assert(!r70.includes('window.sendWhatsApp='));
  assert(!r70.includes('window.renderReceiptHtml='));
});

test('NewMatRos BAUF price comes from the matching product card',()=>{
  assert(r69.includes('priceSource=\'Карточка товара\''));
  assert(r69.includes('/BAUF|БАУФ|ГЕРМАН/'));
  assert(r69.includes('m.price=price'));
  assert(r69.includes('Карточка BAUF для этой ширины не найдена'));
});

test('products can be created/edited without mandatory group and keep prices',()=>{
  assert(r69.includes('groupId:gid'));
  assert(r69.includes('Number(editPretail?.value)'));
  assert(r69.includes('Number(editPwholesale?.value)'));
  assert(!r69.includes("if(!gid)return alert('Выбери группу')"));
  assert(r69.includes('renderProducts?.()'));
  assert(r69.includes('pushCatalog()'));
});

test('receipt item name is editable without replacing the approved receipt/JPEG renderer',()=>{
  assert(r70.includes("field!=='name'"));
  assert(r70.includes("item.name=next"));
  assert(r70.includes('receiptName8970'));
  assert(r70.includes('enhanceReceiptNames8970'));
  assert(r70.includes("e.key==='Enter'"));
  assert(r70.includes("e.key==='Escape'"));
  assert(r70.includes('Изменить название'));
  assert(!r70.includes('Остаток долга:</b>'));
});

test('Price Group column is moved together with body cells',()=>{
  assert(r70.includes('priceGroupRight8970'));
  assert(r70.includes('row.appendChild(cells[groupIndex])'));
});

test('sync uses stable device/product IDs and separates display client name',()=>{
  assert(master.includes('device.id'));
  assert(master.includes('productPatch'));
  assert(protocol.includes('clientName:incomingName'));
  assert(protocol.includes('C.id(ch.id)'));
  assert(protocol.includes('updatedAt'));
});

test('manual server upload/download has visible status feedback',()=>{
  assert(r70.includes('Загрузка с сервера'));
  assert(r70.includes('Отправка на сервер'));
  assert(master.includes('Успешно загружено'));
  assert(master.includes('Успешно отправлено'));
});
