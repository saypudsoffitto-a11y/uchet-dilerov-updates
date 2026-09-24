const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const repo=path.resolve(__dirname,'../..');
const ui=fs.readFileSync(path.join(repo,'app/interface-8945.js'),'utf8');
const index=fs.readFileSync(path.join(repo,'app/index.html'),'utf8');
const catalog=fs.readFileSync(path.join(repo,'app/catalog-pending-8972.js'),'utf8');

test('8.9.73 interface patch has valid JavaScript syntax',()=>{
  assert.doesNotThrow(()=>new vm.Script(ui,{filename:'interface-8945.js'}));
});

test('ready receipt supports editable item names',()=>{
  assert.match(ui,/editReceiptItemName8973/);
  assert.match(ui,/receiptNameInput8973/);
  assert.match(ui,/Название, количество и цену можно изменить прямо в накладной/);
  assert.match(index,/function receiptText\(op\)/,'WhatsApp/export text must read the saved operation items');
});

test('ready receipt supports a free-form manual line',()=>{
  assert.match(ui,/openReceiptManualAdd8973/);
  assert.match(ui,/Своя позиция/);
  assert.match(ui,/manualEntry:true/);
  assert.match(ui,/recalcReceipt8973\(op\)/);
  assert.match(ui,/refreshReceiptViews/);
});

test('product list uses compact group and article columns',()=>{
  assert.match(ui,/compactGroup8973/);
  assert.match(ui,/compactArticle8973/);
  assert.match(ui,/78px/);
  assert.match(ui,/82px/);
});

test('8.9.72 product sync protection remains present',()=>{
  assert.match(catalog,/pendingProducts8972/);
  assert.match(catalog,/Конфликт карточки/);
  assert.match(index,/catalog-pending-8972\.js/);
});
