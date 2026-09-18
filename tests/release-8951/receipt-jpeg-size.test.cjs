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
