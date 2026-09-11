'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('8.9.38 is wired as the application entrypoint',()=>{
  const pkg=JSON.parse(read('app/package.json'));
  assert.equal(pkg.version,'8.9.38');
  assert.equal(pkg.main,'main-8938.js');
  for(const f of ['main-8938.js','release-8938-main.js','stable-fix-8938.js','pdf-compact-8938.js']) assert.ok(pkg.build.files.includes(f),f+' missing from build.files');
});

test('product table has a real horizontal/vertical scrolling viewport',()=>{
  const src=read('app/stable-fix-8938.js');
  assert.match(src,/productTableScroll8938/);
  assert.match(src,/overflow:auto!important/);
  assert.match(src,/width:max-content!important/);
  assert.match(src,/min-width:1280px!important/);
  assert.match(src,/max-height:calc\(100vh - 300px\)/);
  assert.match(src,/position:sticky/);
});

test('dealer deletion is exact-id, persistent and keeps historical operations',()=>{
  const src=read('app/stable-fix-8938.js');
  assert.match(src,/state\.deletedDealers\[idKey\(id\)\]=Date\.now\(\)/);
  assert.match(src,/state\.dealers=state\.dealers\.filter\(x=>x\.id!=id\)/);
  assert.doesNotMatch(src,/state\.ops=state\.ops\.filter\(o=>o\.dealerId!=id\)/);
  assert.match(src,/related\.forEach\(o=>snapshotDealer\(o,d\)\)/);
  assert.match(src,/addEventListener\('contextmenu'.*true\)/s);
  assert.match(src,/stopImmediatePropagation/);
  assert.match(src,/queueSync\(\)/);
});

test('receipt WhatsApp action uses PDF with the same invoice columns as the visible receipt',()=>{
  const src=read('app/pdf-compact-8938.js');
  assert.match(src,/window\.sendWhatsApp=async function/);
  assert.match(src,/receiptAPI\?\.sendPdf/);
  assert.match(src,/Товарная_накладная_\$\{op\.receiptNo\}\.pdf/);
  for(const label of ['Артикул','Наименование','Кол-во','Цена','Сумма']) assert.match(src,new RegExp(label));
});

test('debt report WhatsApp and download actions produce PDF, not plain text',()=>{
  const src=read('app/pdf-compact-8938.js');
  assert.match(src,/window\.sendDebtReportWhatsApp=async function/);
  assert.match(src,/window\.downloadDebtReport=async function/);
  assert.match(src,/Отчёт_по_долгу_/);
  assert.match(src,/Долг до оплаты/);
  assert.match(src,/Остаток после оплаты/);
  assert.doesNotMatch(src,/text\/plain/);
});

test('receipt and dealer history tables are compact enough for normal screens',()=>{
  const src=read('app/pdf-compact-8938.js');
  assert.match(src,/\.receipt\{max-width:860px!important;padding:14px!important/);
  assert.match(src,/\.receipt th,\.receipt td\{padding:4px 6px!important/);
  assert.match(src,/\.dealerHistoryDetail\{font-size:11\.5px!important/);
  assert.match(src,/max-width:300px!important/);
});
