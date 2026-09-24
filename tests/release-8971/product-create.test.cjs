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

test('8.9.71 product hotfix is packaged and loaded last',()=>{
  assert.equal(pkg.version,'8.9.71');
  assert(pkg.build.files.includes('release-8971.js'));
  assert(preload.includes("'./release-8971.js'"));
  assert(preload.indexOf("'./release-8971.js'")>preload.indexOf("'./release-8970.js'"));
  assert(preload.includes("?runtime=8971"));
  assert(preload.includes("dataset.uchetRuntime='8.9.71'"));
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

test('first sync pull cannot silently erase a newly created product',()=>{
  assert(r71.includes('const first=await window.masterSync8962.push(true)'));
  assert(r71.includes('if(!current||JSON.stringify(current)!==JSON.stringify(snapshot))'));
  assert(r71.includes('state.products.push(clone(snapshot))'));
  assert(r71.includes('const second=await window.masterSync8962.push(true)'));
});

test('product edits also keep optional group, prices and numeric update timestamp',()=>{
  assert(r71.includes('window.saveProductEdit=function'));
  assert(r71.includes("p.groupId=num(byId('editPgroup')?.value)"));
  assert(r71.includes("p.retailPrice=Math.max(0,num(byId('editPretail')?.value))"));
  assert(r71.includes("p.wholesalePrice=Math.max(0,num(byId('editPwholesale')?.value))"));
  assert(r71.includes('p.updatedAt=Date.now()'));
});
