'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const C=require('../../app/sync-core-8962'),{update}=require('../../server/master-protocol-8962');
const source=fs.readFileSync(require.resolve('../../app/master-sync-8962'),'utf8');
const url='https://shared.test';
const device={id:'receipt-device-000001',name:'PC 1'};
const dealer={id:1,name:'Test dealer',phone:'79990000001'};
const initial=()=>({dealers:[{...dealer}],groups:[],products:[],ops:[],sync:{url,enabled:true}});
const operation=(id,type='sale')=>({id,type,dealerId:1,date:'2026-10-02',ts:1,total:type==='sale'?300:75,items:[]});
function harness({first=false,register=false,master=false,identity=device,persisted}={}){
 const device=identity;
 let remote={revision:10,state:initial(),computers:{masterId:master?device.id:'other-device-000001',devices:register?{}:{[device.id]:device}}};
 const data=new Map(persisted||[['uchet_device_8962',JSON.stringify(device)]]),timers=[];
 if(!first&&!persisted)data.set('uchet_sync_baseline_8962:'+url,JSON.stringify({state:remote.state,revision:10}));
 const status={textContent:'',dataset:{}};
 const ctx={window:{SyncCore8962:C},state:data.has('local')?JSON.parse(data.get('local')):initial(),KEY:'local',
 localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},
 document:{getElementById:id=>id==='syncStatus'?status:null,createElement:()=>({}),querySelector:()=>null},
 setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout:()=>{},norm:s=>s,render:()=>{},
 syncCfg:()=>ctx.state.sync,
 syncRequest:async(method,body)=>{
  if(method==='PUT'){
   if(body.baseRevision!==remote.revision)return {conflict:true,ok:false,revision:remote.revision};
   remote=update(remote,body);remote.revision++;
  }
  return {...C.clone(remote),ok:true,protocol:2,storage:'turso'};
 }};
 vm.createContext(ctx);vm.runInContext(source,ctx);timers.length=0;
 return {ctx,data,timers,status,server:()=>remote,changeServer:fn=>{fn(remote);remote.revision++},
 async flush(){let n=0;while(timers.length){assert.ok(n++<12,'retry queue must be bounded');await timers.shift()();}}};
}
function gate(h,phase){
 const request=h.ctx.syncRequest;let release,enter,gated=false;
 const waiting=new Promise(r=>enter=r),paused=new Promise(r=>release=r);
 h.ctx.syncRequest=async(method,body)=>{if(!gated&&method===phase){gated=true;enter();await paused}return request(method,body)};
 return {waiting,release};
}
for(const type of ['sale','payment'])test(`first connection retains and sends ${type} created while GET is pending`,async()=>{
 const h=harness({first:true}),g=gate(h,'GET');
 const pulling=h.ctx.window.masterSync8962.pull(false);await g.waiting;
 h.ctx.state.ops.push(operation('new-'+type,type));
 await h.ctx.window.masterSync8962.push(false); // real save debounce fires during pull
 g.release();assert.equal(await pulling,true);
 assert.equal(h.ctx.state.ops.length,1,'new document must remain visible');
 assert.equal(JSON.parse(h.data.get('local')).ops.length,1,'document must survive restart');
 await h.flush();assert.equal(h.server().state.ops.length,1,'document must reach the shared database');
});
test('save during device registration is automatically delivered after registration',async()=>{
 const h=harness({register:true}),g=gate(h,'PUT');
 const pulling=h.ctx.window.masterSync8962.pull(false);await g.waiting;
 h.ctx.state.ops.push(operation('during-register'));
 await h.ctx.window.masterSync8962.push(false);
 g.release();assert.equal(await pulling,true);await h.flush();
 assert.equal(h.server().state.ops.length,1);
});
test('pending dealer edit on former master does not block automatic receipt delivery',async()=>{
 const h=harness({master:true});h.ctx.state.dealers[0].city='New city';
 h.ctx.state.ops.push(operation('with-dealer-edit'));
 assert.equal(await h.ctx.window.masterSync8962.pull(false),true);await h.flush();
 assert.equal(h.server().state.ops.length,1);
 assert.equal(h.server().state.dealers[0].city,'New city');
});
test('CAS collision retries automatically and preserves another computer payment',async()=>{
 const h=harness(),g=gate(h,'PUT');h.ctx.state.ops.push(operation('pc1-sale'));
 const sending=h.ctx.window.masterSync8962.push(false);await g.waiting;
 h.changeServer(s=>s.state.ops.push(operation('pc2-payment','payment')));
 g.release();await sending;await h.flush();
 assert.equal(h.server().state.ops.length,2);
 assert.equal(h.ctx.state.ops.length,2);
});
test('archive-only edit is delivered after automatic pull without an explicit push',async()=>{
 const h=harness();h.ctx.state.receiptStates={r:{archived:true,receipt:operation('r')}};
 assert.equal(await h.ctx.window.masterSync8962.pull(false),true);await h.flush();
 assert.equal(h.server().state.receiptStates?.r?.archived,true);
});
test('sync status exposes an explicit connection state for the header indicator',async()=>{
 const h=harness();await h.ctx.window.masterSync8962.pull(false);
 assert.equal(h.status.dataset.syncState,'online');
 h.ctx.syncRequest=async()=>({ok:false,code:'SYNC_AUTH_FAILED',message:'Test auth error'});
 await h.ctx.window.masterSync8962.pull(false);
 assert.equal(h.status.dataset.syncState,'offline');
 assert.equal(h.status.textContent,'Test auth error');
});
test('a stale dealer edit cannot roll back a newer server field or block an unrelated receipt',async()=>{
 const h=harness({master:true});h.ctx.state.dealers[0].city='Local city';
 h.ctx.state.ops.push(operation('receipt-with-catalog-conflict'));
 h.changeServer(s=>{s.state.dealers[0].city='Server city';s.state.dealers.push({id:2,name:'Remote dealer',phone:'79990000002'});});
 assert.equal(await h.ctx.window.masterSync8962.pull(false),true);await h.flush();
 assert.equal(h.server().state.dealers[0].city,'Server city');
 assert.equal(h.ctx.state.dealers.length,2,'remote additions must not disappear under a local catalog');
 assert.equal(h.server().state.ops.length,1);
 const recovery=JSON.parse(h.data.get('uchet_catalog_conflicts_8981:'+url));
 assert.equal(recovery[0].changes[0].after.city,'Local city','conflicting work must remain recoverable');
 const restarted=harness({identity:device,persisted:h.data});restarted.ctx.syncRequest=h.ctx.syncRequest;
 assert.equal(await restarted.ctx.window.masterSync8962.pull(false),true);await restarted.flush();
 assert.equal(h.server().state.dealers[0].city,'Server city','restart must not grant stale edits a fresh baseline');
});
test('independent dealer fields rebase and preserve both computers edits',async()=>{
 const h=harness();h.ctx.state.dealers[0].city='Local city';
 h.changeServer(s=>s.state.dealers[0].email='remote@example.test');
 assert.equal(await h.ctx.window.masterSync8962.pull(false),true);await h.flush();
 assert.equal(h.server().state.dealers[0].city,'Local city');
 assert.equal(h.server().state.dealers[0].email,'remote@example.test');
});
test('any computer may add a dealer and its first receipt in one checked transaction',async()=>{
 const h=harness();h.ctx.state.dealers.push({id:2,name:'New dealer',phone:'79990000002'});
 h.ctx.state.ops.push({...operation('new-dealer-receipt'),dealerId:2});
 assert.equal(await h.ctx.window.masterSync8962.push(false),true);
 assert.equal(h.server().state.dealers.length,2);assert.equal(h.server().state.ops[0].dealerId,2);
});
test('an equal peer can synchronize a dealer without a phone as supported by the existing input form',async()=>{
 const h=harness();h.ctx.state.dealers.push({id:2,name:'Dealer without a phone',phone:''});
 h.ctx.state.ops.push({...operation('phone-optional-receipt'),dealerId:2});
 assert.equal(await h.ctx.window.masterSync8962.push(false),true);
 assert.equal(h.server().state.ops[0].dealerId,2);
 h.ctx.state.dealers.push({id:3,name:'Dealer without a phone',phone:''});
 assert.equal(await h.ctx.window.masterSync8962.push(false),false);
 assert.equal(h.server().state.dealers.length,2,'ambiguous duplicate stays local and cannot multiply server cards');
 assert.equal(h.ctx.state.dealers.length,3,'rejected user work remains available');
});
test('dealer edit made while PUT is pending remains queued on an equal peer',async()=>{
 const h=harness(),g=gate(h,'PUT');h.ctx.state.ops.push(operation('inflight-sale'));
 const pushing=h.ctx.window.masterSync8962.push(false);await g.waiting;
 h.ctx.state.dealers[0].city='Edited during PUT';await h.ctx.window.masterSync8962.push(false);
 g.release();assert.equal(await pushing,true);await h.flush();
 assert.equal(h.server().state.dealers[0].city,'Edited during PUT');
 assert.equal(h.server().state.ops.length,1);
});
test('a server which ignores catalog patches cannot silently discard local edits',async()=>{
 const h=harness(),request=h.ctx.syncRequest;h.ctx.state.dealers[0].city='Pending city';
 h.ctx.syncRequest=(method,body)=>request(method,body?{...body,catalogPatch:undefined}:body);
 assert.equal(await h.ctx.window.masterSync8962.push(false),false);
 assert.equal(h.ctx.state.dealers[0].city,'Pending city');
 assert.equal(JSON.parse(h.data.get('uchet_sync_baseline_8962:'+url)).revision,10);
 assert.match(h.status.textContent,/не подтвердил/);
});
test('first-connection offline receipt survives two restarts while an unknown cache remains quarantined',async()=>{
 const old=initial();old.ops=[operation('unverified-old-cache')];
 const data=new Map([['uchet_device_8962',JSON.stringify(device)],['local',JSON.stringify(old)]]);
 let h=harness({first:true,persisted:data}),request=h.ctx.syncRequest;
 h.ctx.state.ops.push(operation('new-offline-receipt'));
 h.ctx.window.masterSync8962.recordSave();h.data.set('local',JSON.stringify(h.ctx.state));h.ctx.window.masterSync8962.markSaved();
 h.ctx.syncRequest=async()=>({ok:false,message:'Offline'});
 assert.equal(await h.ctx.window.masterSync8962.push(false),false);
 h=harness({persisted:h.data});h.ctx.state.ops.find(o=>o.id==='new-offline-receipt').total=350;
 h.ctx.window.masterSync8962.recordSave();h.data.set('local',JSON.stringify(h.ctx.state));h.ctx.window.masterSync8962.markSaved();
 h=harness({persisted:h.data});h.ctx.syncRequest=request;
 assert.equal(await h.ctx.window.masterSync8962.pull(false),true);await h.flush();
 assert.deepEqual(h.ctx.state.ops.map(o=>o.id),['new-offline-receipt']);
 assert.equal(h.ctx.state.ops[0].total,350);
 assert.equal(JSON.parse(h.data.get('uchet_before_master_8962:'+url)).ops.length,2,'unknown cache remains in private backup');
});
test('atomic visible-state baseline prevents an interrupted compatibility write from inventing remote deletions',async()=>{
 const h=harness(),set=h.ctx.localStorage.setItem;
 h.changeServer(s=>s.state.ops.push(operation('new-remote-receipt')));
 h.ctx.localStorage.setItem=(key,value)=>{if(key.startsWith('uchet_sync_baseline_8962:'))throw Error('Simulated crash after visible data persisted');set(key,value)};
 assert.equal(await h.ctx.window.masterSync8962.pull(false),true);
 assert.equal(JSON.parse(h.data.get('uchet_sync_baseline_8962:'+url)).revision,10,'legacy key deliberately remains behind');
 const restarted=harness({persisted:h.data});restarted.ctx.syncRequest=h.ctx.syncRequest;
 assert.equal(await restarted.ctx.window.masterSync8962.pull(false),true);await restarted.flush();
 assert.equal(h.server().state.ops.length,1);
 assert.equal(restarted.ctx.state.ops[0].id,'new-remote-receipt');
});
test('direct receipt archive commit preserves its first-connection outbox through restart',async()=>{
 let h=harness({first:true}),request=h.ctx.syncRequest;
 const receipt=operation('offline-archived-receipt');h.ctx.state.ops.push(receipt);
 h.ctx.window.masterSync8962.recordSave();h.data.set('local',JSON.stringify(h.ctx.state));h.ctx.window.masterSync8962.markSaved();
 const next=C.clone(h.ctx.state);next.ops=[];next.receiptStates={[receipt.id]:{archived:true,receipt,version:1,at:1}};
 h.ctx.window.masterSync8962.commitState(next);
 h=harness({persisted:h.data});h.ctx.syncRequest=request;
 assert.equal(await h.ctx.window.masterSync8962.pull(false),true);await h.flush();
 assert.equal(h.ctx.state.ops.length,0);assert.equal(h.ctx.state.receiptStates[receipt.id].receipt.total,300);
});
test('three independent persistent clients converge on receipt, payment and debt after restarts, offline edits and a lost acknowledgement',async()=>{
 const first=harness({master:true}),shared=first.ctx.syncRequest;
 const identities=[device,{id:'receipt-device-000002',name:'PC 2'},{id:'receipt-device-000003',name:'PC 3'}];
 const connect=(identity,persisted)=>{const h=harness({identity,persisted});h.ctx.syncRequest=shared;return h};
 let clients=[first,connect(identities[1]),connect(identities[2])];
 const debt=h=>h.ctx.state.ops.reduce((n,o)=>n+(o.type==='payment'?-o.total:o.total),0);
 const converge=async expected=>{
  // One poll uploads a reconnecting client's outbox; the next poll receives it
  // on peers which polled before that upload.
  for(let round=0;round<2;round++)for(const h of clients){assert.equal(await h.ctx.window.masterSync8962.pull(false),true);await h.flush();}
  for(const h of clients){assert.equal(debt(h),expected);assert.equal(new Set(h.ctx.state.ops.map(o=>o.id)).size,h.ctx.state.ops.length);}
 };
 clients[0].ctx.state.ops.push(operation('receipt-pc1'));
 assert.equal(await clients[0].ctx.window.masterSync8962.push(false),true);await converge(300);
 clients[1].ctx.state.ops.push(operation('payment-pc2','payment'));
 assert.equal(await clients[1].ctx.window.masterSync8962.push(false),true);await converge(225);
 clients=clients.map((h,i)=>connect(identities[i],h.data));await converge(225);
 // The normal save persists the document before trying the network.
 clients[2].ctx.state.ops.push({...operation('offline-payment-pc3','payment'),total:20});
 clients[2].data.set('local',JSON.stringify(clients[2].ctx.state));
 clients[2].ctx.syncRequest=async()=>({ok:false,message:'Offline'});
 assert.equal(await clients[2].ctx.window.masterSync8962.push(false),false);
 clients[2]=connect(identities[2],clients[2].data);await converge(205);
 // Server commits but the client never receives the successful PUT response.
 clients[0].ctx.state.ops.push({...operation('lost-ack-payment','payment'),total:10});
 clients[0].data.set('local',JSON.stringify(clients[0].ctx.state));
 clients[0].ctx.syncRequest=async(method,body)=>{const result=await shared(method,body);return method==='PUT'?{ok:false,message:'Connection lost after commit'}:result};
 assert.equal(await clients[0].ctx.window.masterSync8962.push(false),false);
 clients=clients.map((h,i)=>connect(identities[i],h.data));await converge(195);
 assert.equal(first.server().state.ops.length,4);
});
