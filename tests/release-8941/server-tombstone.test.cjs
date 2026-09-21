'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawn}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const serverPath=path.join(root,'server','server.js');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function waitForHealth(base){
  let last;
  for(let i=0;i<60;i++){
    try{
      const r=await fetch(base+'/health');
      if(r.ok)return await r.json();
      last=new Error('HTTP '+r.status);
    }catch(e){last=e}
    await sleep(100);
  }
  throw last||new Error('Server did not become healthy');
}

async function json(base,method,body){
  const r=await fetch(base+'/api/state',{
    method,
    headers:{'Content-Type':'application/json'},
    body:body===undefined?undefined:JSON.stringify(body)
  });
  const data=await r.json();
  return {status:r.status,data};
}

test('8.9.63 server blocks legacy full-state resurrection',async t=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'uchet-8941-server-'));
  const port=20000+Math.floor(Math.random()*20000);
  const base='http://127.0.0.1:'+port;
  const child=spawn(process.execPath,[serverPath],{
    env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DATA_DIR:tmp,SYNC_TOKEN:''},
    stdio:['ignore','pipe','pipe']
  });
  let out='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>out+=d);
  t.after(()=>{try{child.kill()}catch(_){};try{fs.rmSync(tmp,{recursive:true,force:true})}catch(_){}});

  const health=await waitForHealth(base);
  assert.equal(health.serverVersion,'8.9.63-sync5',out);
  assert.equal(health.protocol,2);

  const keepId=101,deleteId=102;
  const history={id:201,dealerId:deleteId,type:'sale',total:100,date:'test',items:[]};
  const staleLegacyState={dealers:[{id:keepId,name:'Keep'},{id:deleteId,name:'Delete from stale PC'}],ops:[history],deletedDealers:{},deletedDealerKeys:{}};
  const r=await json(base,'PUT',{baseRevision:0,state:staleLegacyState});
  assert.equal(r.status,422);
  assert.equal(r.data.protocol,2);
  assert.match(String(r.data.message||''),/Старые списки не приняты/);

  const current=await json(base,'GET');
  assert.equal(current.status,200);
  assert.equal(current.data.serverVersion,'8.9.63-sync5');
  assert.equal(current.data.revision,0);
  assert.equal((current.data.state.dealers||[]).length,0,'legacy PC changed the protected server catalog');
});
