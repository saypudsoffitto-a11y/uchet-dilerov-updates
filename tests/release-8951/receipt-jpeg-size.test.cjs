const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('8.9.51 receipt JPEG uses content height instead of fixed screen-sized canvas',()=>{
  const pkg=JSON.parse(read('app/package.json'));
  const main=read('app/main-8948.js');
  assert.equal(pkg.version,'8.9.51');
  assert.match(main,/getBoundingClientRect/);
  assert.match(main,/height:260/);
  assert.match(main,/Math\.max\(180/);
  assert.doesNotMatch(main,/height:1400/);
  assert.doesNotMatch(main,/Math\.max\(900/);
  assert.match(main,/capturePage\(\{x:0,y:0,width,height\}\)/);
});


test('8.9.51 JPEG receipt matches approved compact columns and sidebar items are visible buttons',()=>{
  const receipt=read('app/receipt-jpeg-8951.js');
  const css=read('app/interface-8951.css');
  const preload=read('app/preload.js');
  const pkg=JSON.parse(read('app/package.json'));
  assert.ok(pkg.build.files.includes('receipt-jpeg-8951.js'));
  assert.ok(pkg.build.files.includes('interface-8951.css'));
  assert.match(preload,/\.\/receipt-jpeg-8951\.js/);
  assert.match(receipt,/<th>№<\/th><th>Наименование<\/th><th>Цена<\/th><th>Кол-во<\/th><th>Сумма<\/th>/);
  assert.doesNotMatch(receipt,/<th>Артикул<\/th>/);
  assert.match(receipt,/padding:4px 6px/);
  assert.match(receipt,/Сумма прописью:/);
  assert.match(css,/html nav button\{/);
  assert.match(css,/background:#edf6ff!important/);
  assert.match(css,/border:1px solid #c9def4!important/);
  assert.match(css,/html nav button\.active/);
});
