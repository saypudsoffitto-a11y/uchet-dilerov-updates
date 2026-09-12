'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('later package preserves the complete 8.9.40 and verified 8.9.39 runtime chain',()=>{
  const pkg=JSON.parse(read('app/package.json'));
  assert.match(pkg.version,/^8\.9\.(40|41|42)$/);
  assert.match(pkg.main,/^main-894(0|1)\.js$/);
  for(const f of [
    'main-8940.js','main-8939.js','release-8939-main.js',
    'dealer-delete-8939.js','sync-fix-8939.js','stable-fix-8938.js','pdf-compact-8938.js'
  ]) assert.ok(pkg.build.files.includes(f),f+' missing from build');
  const wrapper8940=read('app/main-8940.js');
  assert.match(wrapper8940,/main-8939\.js/);
  if(pkg.main==='main-8941.js'){
    const wrapper8941=read('app/main-8941.js');
    assert.match(wrapper8941,/main-8940\.js/);
  }
});
