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
  for(let i=0;i<80;i++){
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
  return {status:r.status,data:await r.json()};
}

test('8.9.48 sync keeps one dealer for the same normalized name and phone across three PCs',async t=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'uchet-8948-dedupe-'));
  const port=22000+Math.floor(Math.random()*18000);
  const base='http://127.0.0.1:'+port;
  const child=spawn(process.execPath,[serverPath],{
    env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DATA_DIR:tmp,SYNC_TOKEN:''},
    stdio:['ignore','pipe','pipe']
  });
  let out='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>out+=d);
  t.after(()=>{try{child.kill()}catch(_){};try{fs.rmSync(tmp,{recursive:true,force:true})}catch(_){}});

  const health=await waitForHealth(base);
  assert.equal(health.serverVersion,'8.9.62-sync4',out);

  const state={
    dealers:[
      {id:101,name:'Магомед Алиев',phone:'+7 (928) 111-22-33',city:'Махачкала'},
      {id:102,name:' магомед   алиев ',phone:'8 928 111 22 33',company:'ИП Алиев'},
      {id:103,name:'МАГОМЕД АЛИЕВ',phone:'9281112233',note:'третий компьютер'}
    ],
    ops:[
      {id:201,dealerId:101,type:'sale',total:100,date:'test 1',items:[]},
      {id:202,dealerId:102,type:'payment',total:20,date:'test 2'},
      {id:203,dealerId:103,type:'initial_debt',total:50,date:'test 3'}
    ],
    deletedDealers:{},
    deletedDealerKeys:{},
    sync:{revision:0}
  };

  let r=await json(base,'PUT',{baseRevision:0,state});
  assert.equal(r.status,200,JSON.stringify(r.data));
  assert.equal(r.data.revision,1);

  r=await json(base,'GET');
  assert.equal(r.status,200);
  const saved=r.data.state;
  assert.equal(saved.dealers.length,1,JSON.stringify(saved.dealers));
  const canonicalId=String(saved.dealers[0].id);
  assert.equal(saved.ops.length,3);
  assert.equal(saved.ops.every(o=>String(o.dealerId)===canonicalId),true,JSON.stringify(saved.ops));
  assert.equal(Object.keys(saved.dealerAliases||{}).length,2);
  assert.equal(Object.values(saved.dealerAliases||{}).every(v=>String(v)===canonicalId),true);
  assert.equal(Object.keys(saved.deletedDealers||{}).filter(id=>id!==canonicalId).length>=2,true);
  assert.equal(saved.dealers[0].city,'Махачкала');
  assert.equal(saved.dealers[0].company,'ИП Алиев');
  assert.equal(saved.dealers[0].note,'третий компьютер');

  // Older client tries to send only one obsolete duplicate. The server must keep
  // the canonical card and relink the stale operation instead of resurrecting a
  // second contact or erasing the canonical one.
  const obsoleteId=Object.keys(saved.dealerAliases)[0];
  const stale={
    dealers:[{id:Number(obsoleteId),name:'Магомед Алиев',phone:'8 (928) 111-22-33'}],
    ops:[{id:204,dealerId:Number(obsoleteId),type:'sale',total:10,date:'stale',items:[]}],
    deletedDealers:{},
    deletedDealerKeys:{},
    sync:{revision:1}
  };
  r=await json(base,'PUT',{baseRevision:1,state:stale});
  assert.equal(r.status,200,JSON.stringify(r.data));

  r=await json(base,'GET');
  assert.equal(r.status,200);
  assert.equal(r.data.state.dealers.length,1,JSON.stringify(r.data.state.dealers));
  assert.equal(String(r.data.state.dealers[0].id),canonicalId);
  assert.equal(r.data.state.ops.every(o=>String(o.dealerId)===canonicalId),true,JSON.stringify(r.data.state.ops));
});

