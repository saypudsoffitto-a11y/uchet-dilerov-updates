'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const appDir=path.resolve(__dirname,'../../app');
const assert89AtLeast=(version,min)=>{const [major,minor,patch]=String(version).split('.').map(Number);assert.equal(major,8);assert.equal(minor,9);assert.ok(Number.isInteger(patch)&&patch>=min,`8.9.x patch must be ${min} or newer`)};

test('8.9.55 records product tombstones and filters them after sync merges',()=>{
  const src=fs.readFileSync(path.join(appDir,'release-8955.js'),'utf8');
  assert.doesNotThrow(()=>new Function(src));
  assert.match(src,/deletedProducts/);
  assert.match(src,/mergeMarks\(remote\.deletedProducts,local\.deletedProducts\)/);
  assert.match(src,/applyMarks\(merged\)/);
  assert.match(src,/__productTombstones8955/);
  assert.match(src,/syncPush\(true\)/);
});

test('8.9.55 permanently removes blank product cards instead of rendering dash rows again',()=>{
  const src=fs.readFileSync(path.join(appDir,'release-8955.js'),'utf8');
  assert.match(src,/cleanEmptyProducts/);
  assert.match(src,/String\(p\.name\?\?''\)\.trim\(\)/);
  assert.match(src,/marks\[String\(p\.id\)\]/);
  assert.match(src,/dataset\.productDeletionFix='8\.9\.55'/);
});

test('8.9.55 deletion fix remains shipped in later 8.9.x packages',()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(appDir,'package.json'),'utf8'));
  const preload=fs.readFileSync(path.join(appDir,'preload.js'),'utf8');
  assert89AtLeast(pkg.version,55);
  assert.ok(pkg.build.files.includes('release-8955.js'));
  assert.match(preload,/release-8955\.js/);
  assert.match(preload,/uchetRuntime='8\.9\.(61|62|63|64|65|66|67|68|68|68|68|68|68)'/);
});

test('sync server persists deletion tombstones and strips blank products',()=>{
  const server=fs.readFileSync(path.resolve(__dirname,'../../server/server.js'),'utf8');
  assert.match(server,/deletedProducts = mergeMarks\(prev\.deletedProducts, state\.deletedProducts\)/);
  assert.match(server,/state\.products = products\.filter/);
  assert.match(server,/isPlaceholderProductName\(p\.name\)/);
});
