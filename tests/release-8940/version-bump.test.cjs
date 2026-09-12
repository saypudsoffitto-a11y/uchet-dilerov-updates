'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('8.9.40 is a real newer package that preserves the verified 8.9.39 runtime',()=>{
  const pkg=JSON.parse(read('app/package.json'));
  assert.equal(pkg.version,'8.9.40');
  assert.equal(pkg.main,'main-8940.js');
  for(const f of [
    'main-8940.js','main-8939.js','release-8939-main.js',
    'dealer-delete-8939.js','sync-fix-8939.js','stable-fix-8938.js','pdf-compact-8938.js'
  ]) assert.ok(pkg.build.files.includes(f),f+' missing from build');
  const wrapper=read('app/main-8940.js');
  assert.match(wrapper,/main-8939\.js/);
  const notes=read('RELEASE_NOTES.md');
  assert.match(notes,/Учёт дилеров 8\.9\.40/);
});
