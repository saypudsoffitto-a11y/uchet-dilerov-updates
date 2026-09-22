const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('8.9.50 product table keeps group article and product text in separate columns',()=>{
  const pkg=JSON.parse(read('app/package.json'));
  const html=read('app/index.html');
  const css=read('app/interface-8950.css');
  assert.match(pkg.version,/^8\.9\.(50|51|52|53|54|55|56|57|58|59|60|61|62|63|64|65|66)$/);
  assert.ok(pkg.build.files.includes('interface-8950.css'));
  assert.match(html,/interface-8949\.css[\s\S]*interface-8950\.css/);
  assert.match(css,/data-col-key="Группа_0"/);
  assert.match(css,/data-col-key="Артикул_1"/);
  assert.match(css,/data-col-key="Товар_2"/);
  assert.match(css,/overflow:hidden!important/);
  assert.match(css,/overflow-wrap:anywhere!important/);
  assert.match(css,/min-width:190px!important/);
  assert.match(css,/min-width:380px!important/);
});

test('8.9.50 keeps approved blue theme and JPEG receipt sharing',()=>{
  const theme=read('app/interface-8949.css');
  assert.match(theme,/background:linear-gradient\(180deg,#e6f3ff/);
  for(const file of ['app/next-8948.js','app/pdf-compact-8938.js','app/stable-fix-8938.js','app/renderer-patch.js']){
    const src=read(file),start=src.indexOf('window.sendWhatsApp');
    assert.ok(start>=0,file+' must define sendWhatsApp');
    const next=src.indexOf('window.downloadReceipt',start);
    const block=src.slice(start,next>start?next:start+900);
    assert.match(block,/sendJpeg/);
    assert.match(block,/\.jpg/);
    assert.doesNotMatch(block,/sendPdf\s*\(/);
  }
});
