'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('8.9.42 runtime is packaged and loaded deterministically from preload',()=>{
  const pkg=JSON.parse(read('app/package.json'));
  assert.ok(pkg.build.files.includes('runtime-fixes-8942.js'),'runtime-fixes-8942.js missing from build');
  const preload=read('app/preload.js');
  assert.match(preload,/stable-fix-8938\.js/);
  assert.match(preload,/sync-fix-8939\.js/);
  assert.match(preload,/dealer-delete-8941\.js/);
  assert.match(preload,/group-backup-8941\.js/);
  assert.match(preload,/runtime-fixes-8942\.js/);
  assert.match(preload,/uchetRuntime='8\.9\.42'/);
});

test('older dealer patches cannot overwrite the newer handler',()=>{
  for(const file of ['app/dealer-delete-8937.js','app/dealer-delete-8939.js']){
    const src=read(file);
    assert.match(src,/if\(window\.__dealerDelete8941Installed\|\|window\.__runtimeFix8942Installed\)return;/,file);
    assert.match(src,/if\(window\.__dealerDelete8941Installed\|\|window\.__runtimeFix8942Installed\)return true;/,file);
  }
});

test('sale group filter matches normalized group names when IDs differ',()=>{
  const src=read('app/runtime-fixes-8942.js');
  assert.match(src,/String\(productGroupId\)===String\(selectedGroupId\)/);
  assert.match(src,/productName===selectedName/);
  assert.match(src,/replace\(\/ё\/g,'е'\)/);
  assert.match(src,/normalize\('NFKC'\)/);
  assert.match(src,/sameGroup\(state,p\.groupId,gid\)/);
});

test('sale group dropdown deduplicates visually equal group names',()=>{
  const src=read('app/runtime-fixes-8942.js');
  assert.match(src,/const seen=new Set\(\),unique=\[\]/);
  assert.match(src,/if\(!key\|\|seen\.has\(key\)\)continue/);
  assert.match(src,/seen\.add\(key\);unique\.push\(g\)/);
});

test('duplicate groups are relinked and removed from state and merged sync payloads',()=>{
  const src=read('app/runtime-fixes-8942.js');
  assert.match(src,/canonicalizeDuplicateGroups\(state\)/);
  assert.match(src,/p\.groupId=mapped/);
  assert.match(src,/s\.groups=s\.groups\.filter/);
  assert.match(src,/canonicalizeDuplicateGroups\(merged\)/);
});

test('sale product search also accepts article while preserving group filtering',()=>{
  const src=read('app/runtime-fixes-8942.js');
  assert.match(src,/String\(p\.name\|\|''\)\+' '\+String\(p\.article\|\|''\)/);
  assert.match(src,/!p\.archived&&sameGroup/);
});
