const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('8.9.49 uses approved light-blue interface instead of the old green theme',()=>{
  const pkg=JSON.parse(read('app/package.json'));
  const html=read('app/index.html');
  const css=read('app/interface-8949.css');
  assert.equal(pkg.version,'8.9.49');
  assert.ok(pkg.build.files.includes('interface-8949.css'));
  assert.match(html,/interface-8945\.css[\s\S]*interface-8949\.css/);
  assert.match(css,/background:linear-gradient\(180deg,#e6f3ff/);
  assert.match(css,/html nav button\.active[\s\S]*background:#1f6fd6/);
  assert.match(css,/html nav button:hover[\s\S]*background:#c5e1ff/);
  assert.doesNotMatch(css,/#064d3c|#06392f|#087f57/);
});
