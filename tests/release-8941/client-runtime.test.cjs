'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('8.9.41 wrapper keeps the full 8.9.40/8.9.39 runtime chain',()=>{
  const main=read('app/main-8941.js');
  assert.match(main,/release-8941-main\.js/);
  assert.match(main,/main-8940\.js/);
  const previous=read('app/main-8940.js');
  assert.match(previous,/main-8939\.js/);
});

test('8.9.41 explicitly removes the older 8.9.39 window capture handler',()=>{
  const src=read('app/dealer-delete-8941.js');
  assert.match(src,/__dealerDelete8939\?\.finalContextMenuCapture/);
  assert.match(src,/removeEventListener\('contextmenu',old,true\)/);
  assert.match(src,/addEventListener\('contextmenu',finalCapture,true\)/);
  assert.match(src,/dealerContextMenu8941/);
});

test('right-click locks exact dealer ID and name before menu action can move selection',()=>{
  const src=read('app/dealer-delete-8941.js');
  assert.match(src,/let lockedSelection=null/);
  assert.match(src,/lockedSelection=\{id:lockedId,name:String\(d\.name\|\|''\),phone:String\(d\.phone\|\|''\)\}/);
  assert.match(src,/dealerDeleteSelected8941/);
  assert.match(src,/Удалить именно «'\+locked\.name\+'»/);
  assert.match(src,/const target=\{\.\.\.locked\}/);
  assert.match(src,/removeDealerNow8941\(target\.id,target\.name\)/);
});

test('8.9.41 deletion persists exact-ID tombstone and preserves historical operations',()=>{
  const src=read('app/dealer-delete-8941.js');
  assert.match(src,/state\.deletedDealers\[idKey\(lockedId\)\]=Date\.now\(\)/);
  assert.match(src,/state\.dealers=\(state\.dealers\|\|\[\]\)\.filter\(x=>String\(x\.id\)!==lockedId\)/);
  assert.match(src,/related\.forEach\(o=>snapshotDealer\(o,d\)\)/);
  assert.doesNotMatch(src,/state\.ops\s*=\s*state\.ops\.filter/);
  assert.match(src,/verifyAfterSync\(lockedId\)/);
});

test('8.9.41 refuses to delete another dealer if locked name no longer matches',()=>{
  const src=read('app/dealer-delete-8941.js');
  assert.match(src,/expectedName!=null&&String\(d\.name\|\|''\)!==String\(expectedName\|\|''\)/);
  assert.match(src,/Удаление отменено, чтобы не удалить другого дилера/);
});

test('8.9.41 merge guard filters any remotely resurrected tombstoned dealer',()=>{
  const src=read('app/dealer-delete-8941.js');
  assert.match(src,/const marks=mergeMarks\(remote\.deletedDealers,local\.deletedDealers\)/);
  assert.match(src,/merged\.dealers=\(merged\.dealers\|\|\[\]\)\.filter\(d=>!isDeleted\(d\.id,marks\)\)/);
  assert.match(src,/document\.documentElement\.dataset\.dealerFix='8\.9\.41'/);
});
