'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('8.9.41 packages group repair and injects stock catalogue before it runs',()=>{
  const pkg=JSON.parse(read('app/package.json'));
  assert.ok(pkg.build.files.includes('data-fix-8941.js'));
  assert.ok(pkg.build.files.includes('tovar.csv'));
  const loader=read('app/release-8941-main.js');
  assert.match(loader,/stockGroupCatalogue/);
  assert.match(loader,/__stockGroupCatalogue8941/);
  assert.match(loader,/dealer-delete-8941\.js/);
  assert.match(loader,/data-fix-8941\.js/);
  assert.ok(loader.indexOf('__stockGroupCatalogue8941')<loader.lastIndexOf('dataPatch'));
});

test('group repair detects systemic group-id shift and restores catalogue-backed product links first',()=>{
  const src=read('app/data-fix-8941.js');
  assert.match(src,/const systemicShift=matched\.length>=5&&mismatches>=3/);
  assert.match(src,/const target=canonicalForName\(item\.expected\)/);
  assert.match(src,/item\.p\.groupId=target\.id/);
  assert.match(src,/const isOrphan=!item\.current/);
  assert.match(src,/if\(!isOrphan&&!systemicShift\)continue/);
});

test('duplicate groups keep the most-used ID and every duplicate product link is remapped',()=>{
  const src=read('app/data-fix-8941.js');
  assert.match(src,/usage\.get\(String\(b\.id\)\)/);
  assert.match(src,/remap\[String\(duplicate\.id\)\]=canonical\.id/);
  assert.match(src,/p\.groupId=mapped/);
  assert.match(src,/s\.groups=s\.groups\.filter/);
});

test('missing catalogue group can be recreated without guessing from product text',()=>{
  const src=read('app/data-fix-8941.js');
  assert.match(src,/note:'Восстановлено из исходного списка товаров'/);
  assert.match(src,/catalogue\[productKey\(p\)\]/);
  const csv=read('app/tovar.csv');
  assert.match(csv,/СВЕТОДИОДНЫЕ ЛЕНТЫ/);
});

test('group repair prevents same-named duplicates and also runs after multi-PC merge',()=>{
  const src=read('app/data-fix-8941.js');
  assert.match(src,/Группа «'\+\(existing\.name\|\|n\)\+'» уже существует/);
  assert.match(src,/const merged=previousMerge\(remote,local\)/);
  assert.match(src,/repairGroupsInState\(merged\)/);
  assert.match(src,/dataset\.groupFix='8\.9\.41'/);
});
