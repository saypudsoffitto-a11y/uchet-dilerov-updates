'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const pkg=JSON.parse(read('app/package.json'));
const preload=read('app/preload.js');
const r71=read('app/release-8971.js');

test('8.9.71 product hotfix remains packaged before the current runtime layer',()=>{
  const parts=pkg.version.split('.').map(Number);
  assert.equal(parts[0],8);
  assert.equal(parts[1],9);
  assert.ok(parts[2]>=72,`Версия должна быть >= 8.9.72, обнаружена: ${pkg.version}`);
  assert(pkg.build.files.includes('release-8971.js'));
  assert(preload.includes("'./release-8971.js'"));
  assert(preload.indexOf("'./release-8971.js'")>preload.indexOf("'./release-8970.js'"));
  const runtimeMatch=preload.match(/runtime=(\d+)/);
  assert.ok(runtimeMatch,'runtime должен быть указан в preload.js');
  assert.ok(Number(runtimeMatch[1])>=8972,`runtime должен быть >= 8972, обнаружен: ${runtimeMatch&&runtimeMatch[1]}`);
  assert.match(preload,new RegExp(`dataset\\.uchetRuntime='${pkg.version.replace(/\./g,'\\.')}'`));
});

test('new product creation uses explicit form controls and group is optional',()=>{
  for(const id of ['pgroup','pname','particle','pbuy','pretail','pwholesale','punit','pphoto'])assert(r71.includes("byId('"+id+"')"));
  assert(r71.includes("groupId:num(group?.value)"));
  assert(r71.includes('Без группы (необязательно)'));
  assert(!r71.includes("if(!gid)return alert('Выбери группу')"));
  assert(!r71.includes('retail<=0'));
  assert(!r71.includes('wholesale<=0'));
});

test('created card is persisted locally and is made visible immediately',()=>{
  assert(r71.includes('state.products.push(row)'));
  assert(r71.includes("byId('productListSearch')"));
  assert(r71.includes("search.value=''"));
  assert(r71.includes('persist8971()'));
  assert(r71.includes('renderProducts'));
  assert(r71.includes('Товар «'));
});

test('product changes use a durable journal and queued sync, not snapshot restoration',()=>{
  assert(pkg.build.files.includes('catalog-pending-8972.js'));
  assert(r71.includes('CatalogPending8972.record(state,null,row)'));
  assert(r71.includes('CatalogPending8972.record(state,before,snapshot)'));
  assert(!r71.includes('state.products.push(clone(snapshot))'));
});

test('product edits also keep optional group, prices and numeric update timestamp',()=>{
  assert(r71.includes('window.saveProductEdit=function'));
  assert(r71.includes("p.groupId=num(byId('editPgroup')?.value)"));
  assert(r71.includes("p.retailPrice=Math.max(0,num(byId('editPretail')?.value))"));
  assert(r71.includes("p.wholesalePrice=Math.max(0,num(byId('editPwholesale')?.value))"));
  assert(r71.includes('p.updatedAt=Date.now()'));
});
