'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const net=require('node:net');
const {spawn}=require('node:child_process');

function freePort(){
  return new Promise((resolve,reject)=>{
    const server=net.createServer();
    server.once('error',reject);
    server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});
  });
}

async function fixture(t,initial){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uchet-conditional-'));
  if(initial)fs.writeFileSync(path.join(dir,'state.json'),JSON.stringify(initial));
  const port=await freePort(),base='http://127.0.0.1:'+port;
  const env={...process.env,PORT:String(port),HOST:'127.0.0.1',DATA_DIR:dir,SYNC_TOKEN:'conditional-fixture-key'};
  delete env.TURSO_DATABASE_URL;delete env.TURSO_AUTH_TOKEN;delete env.SYNC_TOKEN_SHA256;
  const child=spawn(process.execPath,['server.js'],{cwd:__dirname,env,stdio:'ignore'});
  t.after(async()=>{
    if(child.exitCode===null){const exited=new Promise(resolve=>child.once('exit',resolve));child.kill();await exited;}
    fs.rmSync(dir,{recursive:true,force:true});
  });
  for(let attempt=0;attempt<80;attempt++){
    if(child.exitCode!==null)throw new Error('fixture server exited '+child.exitCode);
    try{if((await fetch(base+'/health')).ok)break;}catch(_){}
    if(attempt===79)throw new Error('fixture server health timeout');
    await new Promise(resolve=>setTimeout(resolve,25));
  }
  return async function request(query='',options={}){
    const response=await fetch(base+'/api/state'+query,{
      method:options.method||'GET',
      headers:{Authorization:'Bearer '+(options.token??'conditional-fixture-key'),'Content-Type':'application/json'},
      body:options.body===undefined?undefined:JSON.stringify(options.body)
    });
    const text=await response.text();
    return {status:response.status,body:JSON.parse(text),bytes:Buffer.byteLength(text),headers:response.headers};
  };
}

test('unchanged authenticated state reads omit the payload and retain metadata and capabilities',async t=>{
  const state={dealers:Array.from({length:600},(_,i)=>({id:i+1,name:'Дилер '+i,note:'Карточка дилера '.repeat(12)})),products:[],ops:[]};
  const request=await fixture(t,{revision:7,state,computers:{devices:{existing:{id:'existing',name:'Офис'}}}});
  const full=await request();
  assert.equal(full.status,200);
  assert.deepEqual(full.body.state,state);
  assert.equal(Object.hasOwn(full.body,'notModified'),false);
  const unchanged=await request('?knownRevision=7');
  assert.equal(unchanged.status,200);
  assert.equal(unchanged.body.ok,true);
  assert.equal(unchanged.body.notModified,true);
  assert.equal(unchanged.body.revision,7);
  assert.equal(Object.hasOwn(unchanged.body,'state'),false);
  for(const key of ['computers','protocol','serverVersion','storage','inventoryProtocol','productRevisions','permanentDeletionProtocol']){
    assert.deepEqual(unchanged.body[key],full.body[key],key);
  }
  assert.equal(unchanged.headers.get('cache-control'),'no-store');
  assert.ok(unchanged.bytes<full.bytes/100,`conditional ${unchanged.bytes} bytes versus full ${full.bytes}`);
  for(const token of ['', 'incorrect-key']){
    const unauthorized=await request('?knownRevision=7',{token});
    assert.equal(unauthorized.status,401);
    assert.equal(unauthorized.body.ok,false);
    for(const key of ['state','notModified','revision','computers'])assert.equal(Object.hasOwn(unauthorized.body,key),false,key);
  }
});

test('only one canonical safe matching integer can suppress the state',async t=>{
  const request=await fixture(t,{revision:7,state:{dealers:[{id:1,name:'Сохранённый дилер'}]}});
  const queries=['','?other=7','?knownRevision=','?knownRevision=07','?knownRevision=-7','?knownRevision=-0','?knownRevision=%2B7',
    '?knownRevision=7.0','?knownRevision=7e0','?knownRevision=%207','?knownRevision=7%20','?knownRevision=NaN',
    '?knownRevision=Infinity','?knownRevision=9007199254740992','?knownRevision=7&knownRevision=7',
    '?knownRevision=7&knownRevision=8','?knownRevision=6','?knownRevision=8','?knownRevision=0','?knownRevision=%zz'];
  for(const query of queries){
    const response=await request(query);
    assert.equal(response.status,200,query);
    assert.equal(response.body.revision,7,query);
    assert.equal(response.body.state.dealers.length,1,query);
    assert.equal(Object.hasOwn(response.body,'notModified'),false,query);
  }
  assert.equal((await request('?knownRevision=7&unrelated=value')).body.notModified,true);
});

test('revision zero and maximum safe revision are valid conditional reads',async t=>{
  const empty=await fixture(t);
  const zero=await empty('?knownRevision=0');
  assert.equal(zero.body.notModified,true);
  assert.equal(zero.body.revision,0);
  assert.equal(Object.hasOwn(zero.body,'state'),false);
  assert.deepEqual((await empty()).body.state,{});
  const maximum=await fixture(t,{revision:Number.MAX_SAFE_INTEGER,state:{dealers:[]}});
  assert.equal((await maximum('?knownRevision='+Number.MAX_SAFE_INTEGER)).body.notModified,true);
});

test('device registration and business writes invalidate the conditional revision',async t=>{
  const request=await fixture(t);
  const device={id:'conditional-device-001',name:'Офисный Mac'};
  assert.equal((await request('?knownRevision=0')).body.notModified,true);
  const registered=await request('',{method:'PUT',body:{protocol:2,action:'register',device,baseRevision:0}});
  assert.equal(registered.status,200);
  assert.equal(registered.body.revision,1);
  const changedMetadata=await request('?knownRevision=0');
  assert.equal(Object.hasOwn(changedMetadata.body,'state'),true);
  assert.equal(changedMetadata.body.revision,1);
  assert.equal(changedMetadata.body.computers.devices[device.id].name,device.name);
  const metadataCurrent=await request('?knownRevision=1');
  assert.equal(metadataCurrent.body.notModified,true);
  assert.equal(metadataCurrent.body.computers.devices[device.id].name,device.name);
  const dealer={id:1,name:'Новый дилер',phone:'79991234567'};
  const saved=await request('',{method:'PUT',body:{protocol:2,action:'changes',device,baseRevision:1,changes:[],catalogPatch:{dealers:[{id:'1',before:null,after:dealer}]}}});
  assert.equal(saved.status,200);
  assert.equal(saved.body.revision,2);
  const changedState=await request('?knownRevision=1');
  assert.equal(changedState.body.revision,2);
  assert.equal(changedState.body.state.dealers[0].name,dealer.name);
  assert.equal(Object.hasOwn(changedState.body,'notModified'),false);
  assert.equal((await request('?knownRevision=2')).body.notModified,true);
});
