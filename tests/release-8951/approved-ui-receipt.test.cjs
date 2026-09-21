const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('8.9.51 final UI runtime is wired after 8.9.50 layers',()=>{
  const pkg=JSON.parse(read('app/package.json'));
  const html=read('app/index.html');
  const preload=read('app/preload.js');
  assert.match(pkg.version,/^8\.9\.(51|52|53|54|55|56|57|58|59|60|61|62|63|64|65)$/);
  assert.ok(pkg.build.files.includes('interface-8951.css'));
  assert.ok(pkg.build.files.includes('release-8951.js'));
  assert.match(html,/interface-8950\.css[\s\S]*interface-8951\.css/);
  assert.ok(preload.indexOf("'./release-8951.js'")>preload.indexOf("'./next-8948.js'"));
  assert.match(preload,/runtime=89(51|52|53|54|55|56|57|58|59|60|61|62|63|64|65)/);
  assert.match(preload,/dataset\.uchetRuntime='8\.9\.(51|52|53|54|55|56|57|58|59|60|61|62|63|64|65)'/);
});

test('approved compact interface keeps colored sidebar and dense tables',()=>{
  const css=read('app/interface-8951.css');
  assert.match(css,/button\[data-section="home"\].*#0f6efb/s);
  assert.match(css,/button\[data-section="sales"\].*#e5f7ef/s);
  assert.match(css,/button\[data-section="debts"\].*#ffe9ec/s);
  assert.match(css,/html th,html td\{padding:7px 10px!important/);
  assert.match(css,/debtStats8951/);
  assert.match(css,/debtToolbar8951/);
});

test('receipt is compact numbered and has no article column',()=>{
  const src=read('app/release-8951.js');
  assert.doesNotThrow(()=>new Function(src));
  assert.match(src,/\(n\+1\)/);
  assert.match(src,/<th>№<\/th><th>Наименование<\/th><th>Кол-во<\/th><th>Цена<\/th><th>Сумма<\/th>/);
  assert.doesNotMatch(src,/<th>Артикул<\/th>/);
  assert.match(src,/sendJpeg/);
  assert.match(src,/\.jpg/);
  assert.match(src,/Удалить этот чек/);
  assert.match(src,/openReceiptAdd/);
});

test('WhatsApp JPEG is cropped to the actual receipt sheet',()=>{
  const main=read('app/main-8948.js');
  assert.match(main,/document\.querySelector\('\.sheet'\)\|\|document\.body/);
  assert.match(main,/const height=Math\.max\(180/);
  assert.doesNotMatch(main,/Math\.max\(840/);
});
