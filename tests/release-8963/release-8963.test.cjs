'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('8.9.63 keeps the approved 8.9.62 UI fixes and adds protected master sync',()=>{
  const pkg=JSON.parse(read('app/package.json'));
  const html=read('app/index.html');
  const preload=read('app/preload.js');
  assert.equal(pkg.version,'8.9.67');
  assert.ok(pkg.build.files.includes('release-8962.js'));
  assert.ok(pkg.build.files.includes('sync-core-8962.js'));
  assert.ok(pkg.build.files.includes('master-sync-8962.js'));
  assert.ok(!pkg.build.files.includes('newmatros_clients.json'));
  assert.ok(!pkg.build.files.includes('release-8963.js'));
  assert.match(html,/sync-core-8962\.js/);
  assert.match(html,/master-sync-8962\.js/);
  assert.match(html,/if\(window\.masterSync8962\)return window\.masterSync8962\.pull/);
  assert.match(html,/if\(window\.masterSync8962\)return window\.masterSync8962\.push/);
  assert.match(html,/Загрузка старого встроенного списка отключена/);
  assert.match(preload,/\.\/release-8962\.js/);
  assert.match(preload,/runtime=8967/);
  assert.match(preload,/uchetRuntime='8\.9\.(64|65|66|67)'/);
});

test('master sync refuses non-Turso storage and server rejects legacy full-state writes',()=>{
  const master=read('app/master-sync-8962.js');
  const server=read('server/server.js');
  const store=read('server/store.js');
  assert.match(master,/r\.storage!=='turso'/);
  assert.match(server,/body\.protocol !== 2/);
  assert.match(server,/Старые списки не приняты/);
  assert.match(server,/masterProtocol\.update/);
  assert.match(store,/CREATE TABLE IF NOT EXISTS uchet_store/);
  assert.match(store,/store_json/);
  assert.match(store,/store_json/);
  assert.match(server,/computers/);
  assert.match(server,/beforeMaster/);
});

test('computer roles are stable and historical bundled clients are unavailable',()=>{
  const protocol=read('server/master-protocol-8962.js');
  const main=read('app/main.js');
  assert.match(protocol,/Компьютер 1 · Главный/);
  assert.ok(protocol.includes("'Компьютер '+ordinal"));
  assert.match(main,/Старый встроенный список клиентов отключён/);
  assert.ok(!main.includes("path.join(__dirname,'newmatros_clients.json')"));
});

test('8.9.63 automatically moves existing PCs to the Turso sync endpoint without replacing their sync token',()=>{
  const master=read('app/master-sync-8962.js');
  assert.match(master,/OLD_SERVER='https:\/\/uchet-dilerov-sync\.onrender\.com'/);
  assert.match(master,/TURSO_SERVER='https:\/\/uchet-dilerov-sync-8963-test\.onrender\.com'/);
  assert.match(master,/state\.sync\.url=TURSO_SERVER/);
  assert.match(master,/state\.sync\.revision=0/);
  assert.doesNotMatch(master,/state\.sync\.token\s*=/);
});
