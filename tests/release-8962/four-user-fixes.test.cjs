'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('8.9.63 preserves all four requested 8.9.62 changes',()=>{
  const pkg=JSON.parse(read('app/package.json'));
  const preload=read('app/preload.js');
  const patch=read('app/release-8962.js');
  assert.equal(pkg.version,'8.9.68');
  assert.ok(pkg.build.files.includes('release-8962.js'));
  assert.match(pkg.scripts['prebuild:mac'],/release-8962/);
  assert.match(pkg.scripts['prebuild:win'],/release-8962/);
  assert.match(preload,/release-8962\.js/);
  assert.match(preload,/runtime=8968/);
  assert.match(preload,/uchetRuntime='8\.9\.(64|65|66|67|68)'/);
  assert.doesNotThrow(()=>new Function(patch));
});

test('WhatsApp JPEG keeps ruble sign with amount',()=>{
  const patch=read('app/release-8962.js');
  assert.match(patch,/&nbsp;₽/);
  assert.match(patch,/money8962/);
  assert.match(patch,/white-space:nowrap/);
  assert.match(patch,/receiptAPI\.sendJpeg/);
});

test('NewMatRos descriptions drop ceiling numbering',()=>{
  const patch=read('app/release-8962.js');
  assert.match(patch,/cleanItemName8962/);
  assert.match(patch,/Потолок\\s\*\\d\+/);
  assert.match(patch,/cleanStateObject8962/);
  assert.match(patch,/wrappedMerge8962/);
});

test('debts table removes duplicate payment column but keeps action',()=>{
  const patch=read('app/release-8962.js');
  assert.match(patch,/fixDebtPaymentDuplicate8962/);
  assert.match(patch,/==='действие'/);
  assert.match(patch,/x\.text==='оплата'/);
});

test('price list is a dedicated section with filters and both sale prices',()=>{
  const patch=read('app/release-8962.js');
  assert.match(patch,/data-section="pricelist"/);
  assert.match(patch,/id='pricelist8962'|section\.id='pricelist8962'/);
  assert.match(patch,/Розничная цена/);
  assert.match(patch,/Оптовая цена/);
  assert.match(patch,/priceSearch8962/);
  assert.match(patch,/priceGroup8962/);
  assert.match(patch,/printPriceList8962/);
});
