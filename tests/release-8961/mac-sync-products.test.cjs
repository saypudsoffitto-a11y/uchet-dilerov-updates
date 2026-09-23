'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('8.9.61 macOS sync and placeholder-product fix stays shipped on later releases',()=>{
  const pkg=JSON.parse(read('app/package.json'));
  const preload=read('app/preload.js');
  const patch=read('app/release-8961.js');
  const releasePatch=Number(String(pkg.version).split('.')[2]||0);
  assert.ok(releasePatch>=61,'expected 8.9.61 or later');
  assert.ok(pkg.build.files.includes('release-8961.js'));
  assert.match(pkg.scripts['prebuild:mac'],/release-8961/);
  assert.match(pkg.scripts['prebuild:win'],/release-8961/);
  assert.match(preload,/release-8961\.js/);
  assert.match(preload,/runtime=89\d{2}/);
  assert.match(preload,/uchetRuntime='8\.9\.\d+'/);
  assert.doesNotThrow(()=>new Function(patch));
});

test('sync requests use Electron network stack and trim copied secret keys',()=>{
  const main=read('app/main.js');
  assert.match(main,/ipcMain, net/);
  assert.match(main,/async function syncFetch/);
  assert.match(main,/net\.fetch\(target,options\)/);
  assert.match(main,/Node fetch:/);
  assert.match(main,/String\(req && req\.token \|\| ''\)\.trim\(\)/);
  assert.match(main,/syncFetch\(u\.toString\(\),options\)/);
});

test('save and connect always performs a pull while auto-sync only controls timer',()=>{
  const html=read('app/index.html');
  const start=html.indexOf('function saveSyncSettings(){');
  const end=html.indexOf('async function checkForUpdate(){',start);
  const block=html.slice(start,end);
  assert.match(block,/restartSyncTimer\(\);renderSyncSettings\(\);syncPull\(true\)/);
  assert.match(block,/if\(manual\|\|rev>/);
  assert.match(block,/hasPendingCleanup/);
  assert.match(block,/clearPendingCleanup/);
});

test('dash-only and punctuation-only product cards are tombstoned and blocked from reimport',()=>{
  const patch=read('app/release-8961.js');
  assert.match(patch,/isPlaceholderProductName/);
  assert.match(patch,/deletedProducts/);
  assert.match(patch,/markPending/);
  assert.match(patch,/importStockProductRows/);
  assert.match(patch,/filter\(r=>!isPlaceholderProductName\(r&&r\[1\]\)\)/);
  assert.match(patch,/dataset\.productCleanup='8\.9\.61'/);
});

test('sync server permanently rejects placeholder product rows and carries tombstones',()=>{
  const server=read('server/server.js');
  assert.match(server,/SERVER_VERSION = '8\.9\.63-sync5'/);
  assert.match(server,/function isPlaceholderProductName/);
  assert.match(server,/state\.deletedProducts\[String\(p\.id\)\]/);
  assert.match(server,/!isPlaceholderProductName\(p\.name\)/);
});
