'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('8.9.63 is built directly on top of 8.9.62 and loads the Turso patch last',()=>{
  const pkg=JSON.parse(read('app/package.json'));
  const preload=read('app/preload.js');
  assert.equal(pkg.version,'8.9.63');
  assert.ok(pkg.build.files.includes('release-8962.js'));
  assert.ok(pkg.build.files.includes('release-8963.js'));
  assert.ok(preload.indexOf("'./release-8963.js'")>preload.indexOf("'./release-8962.js'"));
  assert.match(preload,/runtime=8963/);
  assert.match(preload,/uchetRuntime='8\.9\.63'/);
});

test('primary-computer bootstrap is guarded by Turso storage and 8.9.63 server',()=>{
  const patch=read('app/release-8963.js');
  assert.match(patch,/uchet_device_id_v1/);
  assert.match(patch,/initializeCentralBase8963/);
  assert.match(patch,/check\.storage!=='turso'/);
  assert.match(patch,/8\\\.9\\\.63/);
  assert.match(patch,/initialize:true/);
  assert.match(patch,/Сделать этот компьютер главным и загрузить базу/);
  assert.match(patch,/Главная база уже назначена/);
});

test('server persists through Turso and allows initialization only once',()=>{
  const store=read('server/store.js');
  const server=read('server/server.js');
  const pkg=JSON.parse(read('server/package.json'));
  assert.equal(pkg.dependencies['@libsql/client'],'^0.18.0');
  assert.match(store,/TURSO_DATABASE_URL/);
  assert.match(store,/TURSO_AUTH_TOKEN/);
  assert.match(store,/CREATE TABLE IF NOT EXISTS uchet_state/);
  assert.match(server,/body\.initialize === true/);
  assert.match(server,/initializationBlocked: true/);
  assert.match(server,/primaryDeviceId/);
  assert.match(server,/primaryDeviceName/);
  assert.match(server,/Повторная первичная загрузка запрещена/);
});
