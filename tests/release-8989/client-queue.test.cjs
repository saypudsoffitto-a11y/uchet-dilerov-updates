'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../../app/sync-core-8962'),D=require('../../app/permanent-delete-8989'),R=require('../../app/sync-convergence-8988'),P=require('../../server/master-protocol-8962');
const fixture=()=>({dealers:[{id:1,name:'Test'},{id:2,name:'Other'}],products:[{id:9,name:'Item',stock:90,inventoryVersion:2,warehouseOpening:92}],groups:[],ops:[{id:10,ts:100,type:'sale',dealerId:1,total:100,items:[{productId:9,qty:2}]},{id:11,ts:200,type:'payment',dealerId:2,total:5}],receiptStates:{},receiptItemStates:{},sync:{url:'https://qa',enabled:true}});
const cmd=target=>({requestId:'request-'+target+'-00000001',target,dealerId:'1',confirmed:true,preserveStock:true});
function harness(initial,remote,storage=new Map(),fault={}){
 let server=remote,ctx;
 const device={id:'qa-computer-00000001',name:'Test'};
 storage.set('uchet_device_8962',JSON.stringify(device));
 const local=C.clone(initial);
 if(!local._syncBaseline8981)local._syncBaseline8981={url:'https://qa',baseline:{state:C.clone(initial),revision:server.revision}};
 ctx={state:local,KEY:'local',window:{SyncCore8962:C,PermanentDelete8989:D,SyncConvergence8988:R,warehouseInstalled:true},document:{getElementById:()=>null},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},norm:x=>x,render(){},setTimeout:()=>1,crypto:require('node:crypto').webcrypto,syncCfg:()=>ctx.state.sync,
 syncRequest:async(method,body)=>{
  if(fault.offline)throw Error('QA offline');
  if(method==='PUT'){
   if(body.baseRevision!==server.revision)return {conflict:true,...C.clone(server),ok:true,protocol:2,storage:'turso'};
   server=P.update(server,body);server.revision++;
   if(body.action==='purge'&&fault.loseAck){fault.loseAck=false;fault.offline=true;throw Error('QA lost response');}
  }
  return {...C.clone(server),ok:true,protocol:2,storage:'turso',inventoryProtocol:2,productRevisions:true,permanentDeletionProtocol:1};
 }};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(require.resolve('../../app/master-sync-8962'),'utf8'),ctx);
 return {ctx,storage,fault,server:()=>server,setServer:s=>server=s};
}
const store=s=>({state:C.clone(s),revision:20,computers:{shared:true,devices:{}}});
test('queued deletion leaves data visible offline and survives restart; acknowledgement clears exactly one command',async()=>{
 const input=fixture(),h=harness(input,store(input),new Map(),{offline:true});
 assert.equal((await h.ctx.window.masterSync8962.queueDeletion(cmd('dealer'))).ok,false);
 assert.equal(h.ctx.state.dealers.length,2);assert.equal(h.ctx.state._purgeQueue8989.commands.length,1);
 const resumed=harness(JSON.parse(h.storage.get('local')),h.server(),h.storage);
 assert.equal(await resumed.ctx.window.masterSync8962.push(true),true);
 assert.deepEqual(resumed.ctx.state.dealers.map(d=>d.id),[2]);assert.equal(resumed.ctx.state._purgeQueue8989.commands.length,0);
 assert.equal(resumed.ctx.state.products[0].stock,90);assert.equal(resumed.server().state.ops.length,1);
});
test('lost purge acknowledgement retries persisted request without removing a later fresh operation',async()=>{
 const input=fixture(),h=harness(input,store(input),new Map(),{loseAck:true});
 assert.equal((await h.ctx.window.masterSync8962.queueDeletion(cmd('history'))).ok,false);
 const server=h.server(),epoch=server.state.permanentDeletions.history[1];
 server.state.ops.push({id:12,type:'initial_debt',dealerId:1,total:77,ts:0,historyEpoch8989:epoch});server.revision++;
 const resumed=harness(JSON.parse(h.storage.get('local')),server,h.storage);
 assert.equal(await resumed.ctx.window.masterSync8962.push(true),true);
 assert.deepEqual(resumed.ctx.state.ops.filter(o=>o.dealerId===1).map(o=>o.total),[77]);
 assert.equal(resumed.ctx.state._purgeQueue8989.commands.length,0);assert.equal(resumed.ctx.state.products[0].stock,90);
});
test('new generated ID captures history epoch; cached imports and IDs created before clear never inherit the later epoch',()=>{
 const input=fixture(),h=harness(input,store(input));const api=h.ctx.window.masterSync8962;
 api.recordCreatedEntity(40);
 h.ctx.state.permanentDeletions={history:{1:500}};
 api.recordCreatedEntity(41);
 h.ctx.state.ops.push({id:40,dealerId:1,type:'initial_debt',total:10},{id:41,dealerId:1,type:'initial_debt',total:20},{id:42,dealerId:1,type:'initial_debt',total:30});
 api.recordSave();
 assert.equal(h.ctx.state.ops.find(o=>o.id===40).historyEpoch8989,0);
 assert.equal(h.ctx.state.ops.find(o=>o.id===41).historyEpoch8989,500);
 assert.equal(h.ctx.state.ops.find(o=>o.id===42).historyEpoch8989,undefined);
 assert.deepEqual(D.sanitize(h.ctx.state).ops.filter(o=>o.dealerId===1).map(o=>o.id),[41]);
});
test('clearing history rejects older NewMatRos drafts; full deletion also rejects identity-only old drafts',()=>{
 const input=fixture();input.dealers[0].phone='79990000001';const draft={dealerId:1,dealerName:'Test',dealerPhone:'79990000001'};
 const history=D.apply(input,cmd('history'),500);
 assert.equal(D.draftBlocked(history,draft),true);assert.equal(D.draftBlocked(history,{...draft,historyEpoch8989:500}),false);
 const deleted=D.apply(input,cmd('dealer'),500);
 assert.equal(D.draftBlocked(deleted,draft),true);assert.equal(D.draftBlocked(deleted,{...draft,dealerId:null}),true);
});
test('deleting notebook amount uses historical dates when payment snapshots have no timestamp',()=>{
 const input=fixture();input.ops=[{id:100,type:'initial_debt',dealerId:1,date:'01.01.2025',total:200},{id:10,type:'payment',dealerId:1,date:'02.01.2025',total:50},{id:101,type:'initial_debt',dealerId:1,date:'03.01.2025',total:30}];
 const out=D.apply(input,{...cmd('operation'),operationId:'101'},500);
 assert.equal(out.ops.find(o=>o.id===10).beforeDebt,200);assert.equal(out.ops.find(o=>o.id===10).afterDebt,150);
});
