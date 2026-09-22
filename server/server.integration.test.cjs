'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const port = s.address().port;
      s.close(() => resolve(port));
    });
  });
}
async function api(base, method, body, token='test-sync-key') {
  const r = await fetch(base + '/api/state', {
    method,
    headers: {'Authorization':'Bearer '+token,'Content-Type':'application/json','Accept':'application/json'},
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status:r.status, data:await r.json() };
}
async function waitHealth(base, child) {
  for(let i=0;i<80;i++){
    if(child.exitCode!=null)throw new Error('server exited '+child.exitCode);
    try{const r=await fetch(base+'/health');if(r.ok)return await r.json();}catch(_){}
    await new Promise(r=>setTimeout(r,75));
  }
  throw new Error('health timeout');
}
const main={id:'main-device-00000001',name:'Компьютер abcd'};
const worker={id:'worker-device-000001',name:'Компьютер efgh'};
const localState=()=>({
  dealers:[{id:1,name:'Иван',phone:'89991234567'}],
  products:[{id:2,name:'Мат',article:'M1',unit:'м²',stock:100}],
  groups:[],ops:[],receiptStates:{},receiptItemStates:{}
});

test('8.9.63 server blocks legacy uploads and keeps master/device metadata', async t=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'uchet-server-'));
  const port=await freePort(),base='http://127.0.0.1:'+port;
  const env={...process.env,PORT:String(port),HOST:'127.0.0.1',DATA_DIR:tmp,SYNC_TOKEN:'test-sync-key'};
  delete env.TURSO_DATABASE_URL;delete env.TURSO_AUTH_TOKEN;
  const child=spawn(process.execPath,['server.js'],{cwd:__dirname,env,stdio:'ignore'});
  t.after(()=>{try{child.kill()}catch(_){};fs.rmSync(tmp,{recursive:true,force:true});});
  const h=await waitHealth(base,child);
  assert.equal(h.protocol,2);
  assert.equal(h.storage,'file');

  const legacy=await api(base,'PUT',{baseRevision:0,state:localState()});
  assert.equal(legacy.status,422);
  assert.match(legacy.data.message,/8\.9\.63/);

  const claim=await api(base,'PUT',{protocol:2,action:'claim',device:main,baseRevision:0,state:localState()});
  assert.equal(claim.status,200);
  assert.equal(claim.data.revision,1);
  assert.equal(claim.data.computers.masterId,main.id);
  assert.equal(claim.data.computers.devices[main.id].name,'Компьютер 1 · Главный');

  const reg=await api(base,'PUT',{protocol:2,action:'register',device:worker,baseRevision:1});
  assert.equal(reg.status,200);
  assert.equal(reg.data.revision,2);
  assert.equal(reg.data.computers.devices[worker.id].name,'Компьютер 2');

  const stale=await api(base,'PUT',{protocol:2,action:'register',device:worker,baseRevision:1});
  assert.equal(stale.status,409);

  const loaded=await api(base,'GET');
  assert.equal(loaded.status,200);
  assert.equal(loaded.data.state.dealers.length,1);
  assert.equal(loaded.data.computers.masterId,main.id);
  assert.equal(loaded.data.computers.devices[worker.id].ordinal,2);
});


test('server accepts legacy client key through SHA-256 verifier without storing raw secret', async t=>{
  const crypto=require('node:crypto');
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'uchet-server-hash-'));
  const port=await freePort(),base='http://127.0.0.1:'+port;
  const legacy='legacy-test-key';
  const env={...process.env,PORT:String(port),HOST:'127.0.0.1',DATA_DIR:tmp,SYNC_TOKEN:'different-current-key',SYNC_TOKEN_SHA256:crypto.createHash('sha256').update(legacy).digest('hex')};
  delete env.TURSO_DATABASE_URL;delete env.TURSO_AUTH_TOKEN;
  const child=spawn(process.execPath,['server.js'],{cwd:__dirname,env,stdio:'ignore'});
  t.after(()=>{try{child.kill()}catch(_){};fs.rmSync(tmp,{recursive:true,force:true});});
  await waitHealth(base,child);
  const ok=await api(base,'GET',undefined,legacy);
  assert.equal(ok.status,200);
  const bad=await api(base,'GET',undefined,'wrong-key');
  assert.equal(bad.status,401);
});


test('first master is authoritative and orphan dealer operations are quarantined', async t=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'uchet-server-claim-quarantine-'));
  const port=await freePort(),base='http://127.0.0.1:'+port;
  const env={...process.env,PORT:String(port),HOST:'127.0.0.1',DATA_DIR:tmp,SYNC_TOKEN:'test-sync-key'};
  delete env.TURSO_DATABASE_URL;delete env.TURSO_AUTH_TOKEN;
  const child=spawn(process.execPath,['server.js'],{cwd:__dirname,env,stdio:'ignore'});
  t.after(()=>{try{child.kill()}catch(_){};fs.rmSync(tmp,{recursive:true,force:true});});
  await waitHealth(base,child);
  const state=localState();
  state.ops=[
    {id:10,type:'initial_debt',dealerId:1,dealer:'Иван',total:100},
    {id:11,type:'sale',dealerId:999,dealer:'Удалённый дубль',total:50,receiptNo:7,items:[]}
  ];
  const claim=await api(base,'PUT',{protocol:2,action:'claim',device:main,baseRevision:0,state});
  assert.equal(claim.status,200);
  assert.equal(claim.data.computers.masterId,main.id);
  assert.deepEqual(claim.data.state.ops.map(x=>x.id),[10]);
  const disk=JSON.parse(fs.readFileSync(path.join(tmp,'state.json'),'utf8'));
  assert.equal(disk.claimQuarantine.orphanOps.length,1);
  assert.equal(disk.claimQuarantine.orphanOps[0].id,11);
});
