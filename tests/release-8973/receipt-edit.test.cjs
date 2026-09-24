const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const repo=path.resolve(__dirname,'../..');
const ui=fs.readFileSync(path.join(repo,'app/interface-8945.js'),'utf8');
const runtime=fs.readFileSync(path.join(repo,'app/release-8973.js'),'utf8');
const preload=fs.readFileSync(path.join(repo,'app/preload.js'),'utf8');
const compactReceipt=fs.readFileSync(path.join(repo,'app/release-8951.js'),'utf8');
const index=fs.readFileSync(path.join(repo,'app/index.html'),'utf8');
const catalog=fs.readFileSync(path.join(repo,'app/catalog-pending-8972.js'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(repo,'app/package.json'),'utf8'));

test('8.9.73 interface and final runtime have valid JavaScript syntax',()=>{
  assert.doesNotThrow(()=>new vm.Script(ui,{filename:'interface-8945.js'}));
  assert.doesNotThrow(()=>new vm.Script(runtime,{filename:'release-8973.js'}));
});

test('ready receipt supports editable item names on the actual compact name column',()=>{
  assert.match(ui,/editReceiptItemName8973/);
  assert.match(ui,/receiptNameInput8973/);
  assert.match(runtime,/findColumn8973/);
  assert.match(runtime,/наименование/);
  assert.match(runtime,/receiptNameGuard8973/,'old six-column decorator must be prevented from overwriting quantity');
  assert.match(compactReceipt,/<th>№<\/th><th>Наименование<\/th><th>Кол-во<\/th><th>Цена<\/th><th>Сумма<\/th>/);
  assert.match(index,/function receiptText\(op\)/,'WhatsApp/export text must read the saved operation items');
});

test('ready receipt supports a free-form manual line',()=>{
  assert.match(ui,/openReceiptManualAdd8973/);
  assert.match(ui,/Своя позиция/);
  assert.match(ui,/manualEntry:true/);
  assert.match(ui,/recalcReceipt8973\(op\)/);
  assert.match(ui,/refreshReceiptViews/);
  assert.match(runtime,/openReceiptManualAdd8973/);
});

test('product list uses compact group and article columns',()=>{
  assert.match(ui,/compactGroup8973/);
  assert.match(ui,/compactArticle8973/);
  assert.match(runtime,/\['Группа','78px'\]/);
  assert.match(runtime,/\['Артикул','82px'\]/);
});

test('8.9.73 runtime is packaged and preload reports the same version',()=>{
  assert.equal(pkg.version,'8.9.73');
  assert.ok(pkg.build.files.includes('release-8973.js'));
  assert.match(preload,/release-8973\.js/);
  assert.match(preload,/runtime=8973/);
  assert.match(preload,/uchetRuntime='8\.9\.73'/);
});

test('8.9.72 product sync protection remains present',()=>{
  assert.match(catalog,/pendingProducts8972/);
  assert.match(catalog,/Конфликт карточки/);
  assert.match(index,/catalog-pending-8972\.js/);
});
