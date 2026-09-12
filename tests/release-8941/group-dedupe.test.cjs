'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('8.9.41 packages the group repair runtime after the dealer runtime',()=>{
  const pkg=JSON.parse(read('app/package.json'));
  assert.ok(pkg.build.files.includes('data-fix-8941.js'));
  const loader=read('app/release-8941-main.js');
  assert.match(loader,/dealer-delete-8941\.js/);
  assert.match(loader,/data-fix-8941\.js/);
  assert.ok(loader.indexOf('dealerPatch')<loader.indexOf('dataPatch'));
});

test('group repair merges by normalized name and remaps product groupId',()=>{
  const src=read('app/data-fix-8941.js');
  assert.match(src,/trim\(\)\.replace\(\/\\s\+\/g,' '\)\.toLocaleLowerCase\('ru-RU'\)/);
  assert.match(src,/remap\[String\(g\.id\)\]=current\.id/);
  assert.match(src,/p\.groupId=mapped/);
  assert.match(src,/state\.groups\|\|\[\]/);
});

test('group repair prevents creating same-named group again',()=>{
  const src=read('app/data-fix-8941.js');
  assert.match(src,/Группа «'\+\(existing\.name\|\|n\)\+'» уже существует/);
  assert.match(src,/window\.addGroup=addGroup8941/);
});

test('sync merge is wrapped so same-named groups do not return from another PC',()=>{
  const src=read('app/data-fix-8941.js');
  assert.match(src,/const merged=previousMerge\(remote,local\)/);
  assert.match(src,/dedupeGroupsInState\(merged\)/);
  assert.match(src,/dataset\.groupFix='8\.9\.41'/);
});
