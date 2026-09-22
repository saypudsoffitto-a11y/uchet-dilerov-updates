const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('8.9.68 is wired into package and preload',()=>{
  const pkg=JSON.parse(read('app/package.json'));
  assert.equal(pkg.version,'8.9.68');
  assert.ok(pkg.build.files.includes('interface-8968.css'));
  assert.ok(pkg.build.files.includes('release-8968.js'));
  const preload=read('app/preload.js');
  assert.match(preload,/release-8968\.js/);
  assert.match(preload,/runtime=8968/);
});

test('all working tables are compact and navigation keeps approved button UI',()=>{
  const css=read('app/interface-8968.css');
  assert.match(css,/main table th,[\s\S]*main table td/);
  assert.match(css,/font-size:11px!important/);
  assert.match(css,/padding:4px 6px!important/);
  assert.match(css,/nav button\[data-section="sales"\]/);
  assert.match(css,/background:#e5f7ef!important/);
  assert.match(css,/nav button\[data-section="debts"\]/);
  assert.match(css,/background:#ffe9ec!important/);
});

test('receipt WhatsApp path is JPEG-only',()=>{
  const js=read('app/release-8968.js');
  const start=js.indexOf('async function sendReceiptJpeg8968');
  const end=js.indexOf('window.buildReceiptImage8968');
  const body=js.slice(start,end);
  assert.match(body,/receiptAPI\?\.sendJpeg/);
  assert.match(body,/\.jpg'/);
  assert.doesNotMatch(body,/sendPdf|\.pdf/i);
  assert.match(js,/dataset\.sendFormat='jpeg'/);
});
