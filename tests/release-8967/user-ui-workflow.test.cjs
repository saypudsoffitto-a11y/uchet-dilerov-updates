'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('8.9.67 runtime is wired after approved 8.9.51/8.9.62 layers',()=>{
  const pkg=JSON.parse(read('app/package.json'));
  const preload=read('app/preload.js');
  const html=read('app/index.html');
  assert.equal(pkg.version,'8.9.67');
  assert.ok(pkg.build.files.includes('release-8967.js'));
  assert.ok(pkg.build.files.includes('interface-8967.css'));
  assert.match(preload,/release-8962\.js[\s\S]*release-8967\.js/);
  assert.match(preload,/runtime=8967/);
  assert.match(preload,/uchetRuntime='8\.9\.67'/);
  assert.match(html,/interface-8951\.css[\s\S]*interface-8967\.css/);
});

test('history is hierarchical: dealers then receipts',()=>{
  const src=read('app/release-8967.js');
  assert.doesNotThrow(()=>new Function(src));
  assert.match(src,/renderHistoryDealers8967/);
  assert.match(src,/openHistoryDealer8967/);
  assert.match(src,/renderHistoryDealerReceipts8967/);
  assert.match(src,/ondblclick="openHistoryDealer8967/);
  assert.match(src,/ondblclick="showReceiptFromHistory/);
});

test('debts and product list are compact and product rows are not bold',()=>{
  const css=read('app/interface-8967.css');
  assert.match(css,/#products #productRows b[\s\S]*font-weight:400!important/);
  assert.match(css,/#debts \.debtTable8951 th[\s\S]*padding:4px 8px!important/);
  assert.match(css,/#dealerModalBody \.dealerHistoryDetail th[\s\S]*padding:3px 6px!important/);
});

test('dealer operation context menu covers payments, receipts and initial debt',()=>{
  const src=read('app/release-8967.js');
  for(const label of ['Изменить оплату','Удалить оплату','Открыть чек','Изменить чек','Удалить чек','Изменить начальный долг'])assert.ok(src.includes(label),label);
  assert.ok(src.includes('＋ Внести оплату'));
  assert.match(src,/recalcPaymentSnapshots8967/);
});

test('saving a sale opens the newly created ready receipt',()=>{
  const src=read('app/release-8967.js');
  assert.match(src,/priorSaveSale8967/);
  assert.match(src,/showReceiptFromHistory\(created\.id\)/);
  assert.ok(src.includes('Готовая накладная'));
});

test('WhatsApp JPEG has no remaining-debt line and keeps ruble with amount',()=>{
  const src=read('app/release-8967.js');
  const a=src.indexOf('function whatsappReceipt8967');
  const b=src.indexOf('window.sendWhatsApp=',a);
  const segment=src.slice(a,b);
  assert.ok(a>=0&&b>a);
  assert.doesNotMatch(segment,/Остаток долга/);
  assert.match(segment,/&nbsp;₽/);
  assert.match(src,/receiptAPI\.sendJpeg/);
  assert.ok(src.includes('Отправить текущий долг'));
});

test('approved navigation interface remains present',()=>{
  const css=read('app/interface-8951.css');
  assert.match(css,/button\[data-section="home"\].*#0f6efb/s);
  assert.match(css,/button\[data-section="sales"\].*#e5f7ef/s);
  assert.match(css,/button\[data-section="debts"\].*#ffe9ec/s);
});