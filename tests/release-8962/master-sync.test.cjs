const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../../app/sync-core-8962');
const P=require('../../server/master-protocol-8962');
const main={id:'main-0000000000000000',name:'Офис'},worker={id:'work-0000000000000000',name:'Склад'};
const state=()=>({dealers:[{id:1,name:'Иван',phone:'+7 999 123 45 67'}],products:[{id:2,name:'Мат',article:'M1',unit:'м²',stock:100}],groups:[],ops:[]});
const store=()=>({revision:1,state:state(),computers:{masterId:main.id,devices:{[main.id]:{name:'Офис'}}}});
const put=(s,device,payload)=>P.update(s,{protocol:2,action:'changes',device,...payload});
test('phone card survives imported name-only copy and histories move to its ID',()=>{
 const s=state();s.dealers.push({id:10,name:'Иван',source:'NewMatRos',phone:''});s.ops=[{id:7,dealerId:10,type:'payment',total:50}];
 const r=C.canonicalize(s);assert.deepEqual(r.dealers.map(d=>d.id),[1]);assert.equal(r.ops[0].dealerId,1);assert.equal(r.dealerAliases[10],'1');assert.equal(r.ops[0].total,50);
});
test('ambiguous same names with different phones remain separate',()=>{
 const s=state();s.dealers.push({id:3,name:'Иван',phone:'79999999999'},{id:10,name:'Иван',phone:'',source:'NewMatRos'});assert.equal(C.canonicalize(s).dealers.length,3);
});
test('worker cannot replace the primary catalog and legacy clients cannot upload',()=>{
 assert.throws(()=>put(store(),worker,{catalog:state()}),/главном/);
 assert.throws(()=>P.update(store(),{state:state()}),/Обновите/);
});
test('worker sale changes stock once; retry does not duplicate sale or debt',()=>{
 const s=store(),op={id:100,type:'sale',dealerId:1,total:80,items:[{productId:2,qty:4,total:80}]};
 const changes=C.diffOps([], [op]);const a=put(s,worker,{changes});const b=put(a,worker,{changes});
 assert.equal(b.state.ops.length,1);assert.equal(a.state.products[0].stock,96);assert.equal(b.state.products[0].stock,96);
});
test('independent payments from two computers survive concurrent snapshots',()=>{
 const s=store(),a={id:10,type:'payment',dealerId:1,total:20},b={id:11,type:'payment',dealerId:1,total:30};
 const r=put(put(s,main,{changes:C.diffOps([], [a])}),worker,{changes:C.diffOps([], [b])});assert.equal(r.state.ops.reduce((n,o)=>n+o.total,0),50);
});
test('conflicting edits are rejected, not silently overwritten',()=>{
 const s=store(),op={id:10,type:'payment',dealerId:1,total:20};s.state.ops=[op];
 const a=put(s,main,{changes:C.diffOps([op],[{...op,total:40}])});assert.throws(()=>put(a,worker,{changes:C.diffOps([op],[{...op,total:50}])}),/изменена/);
});
test('deletion cannot be undone by stale snapshots or new imported IDs',()=>{
 const s=store(),deleted=state();deleted.dealers=[];const a=put(s,main,{catalog:deleted});
 assert.equal(a.state.dealers.length,0);assert.throws(()=>put(a,worker,{catalog:state()}),/главном/);
 const imported=state();imported.dealers[0].id=123;const b=put(a,main,{catalog:imported});assert.equal(b.state.dealers.length,0);
});
test('dedupe deletion markers never remove the surviving card with the same identity',()=>{
 const s=state();s.dealers.push({...s.dealers[0],id:10});const next=C.applyCatalog(s,C.canonicalize(s));assert.equal(next.dealers.length,1);
});
test('archive sync preserves recoverable receipt and returns stock once',()=>{
 const s=store(),op={id:10,type:'sale',dealerId:1,total:80,items:[{productId:2,qty:4,total:80}]};s.state.ops=[op];s.state.products[0].stock=96;
 const after=C.clone(s.state);after.ops=[];after.receiptStates={10:{archived:true,receipt:op,stockQuantities:{2:4}}};
 const payload={changes:C.diffOps(s.state.ops,after.ops),archives:C.diffArchives(s.state,after)};
 const a=put(s,worker,payload),b=put(a,worker,payload);assert.equal(b.state.products[0].stock,100);assert.equal(b.state.receiptStates[10].receipt.total,80);assert.equal(b.state.products[0].receiptArchiveStock[10],4);
});
test('role transfer requires current master and preserves all data',()=>{
 const s=store();s.computers.devices[worker.id]={name:worker.name};assert.throws(()=>P.update(s,{protocol:2,action:'transfer',device:worker,targetId:worker.id}),/текущего главного/);
 const result=P.update(s,{protocol:2,action:'transfer',device:main,targetId:worker.id});assert.equal(result.computers.masterId,worker.id);assert.deepEqual(result.state,s.state);
});
test('first master selection keeps server payments',()=>{
 const s={revision:1,state:state()};s.state.ops=[{id:50,type:'payment',dealerId:1,total:20}];const r=P.update(s,{protocol:2,action:'claim',device:main,state:state()});assert.equal(r.state.ops.length,1);assert.equal(r.computers.masterId,main.id);
});
test('server and browser run identical sync rules',()=>assert.equal(require('node:fs').readFileSync(require.resolve('../../server/sync-core-8962'),'utf8'),require('node:fs').readFileSync(require.resolve('../../app/sync-core-8962'),'utf8')));

test('first master keeps server payment and master sale without duplicate IDs',()=>{
 const s={revision:1,state:state()};s.state.ops=[{id:50,type:'payment',dealerId:1,total:20}];
 const selected=state();selected.ops=[{id:60,type:'sale',dealerId:1,total:80,items:[{productId:2,qty:4,total:80}]}];
 const r=P.update(s,{protocol:2,action:'claim',device:main,state:selected});
 assert.deepEqual(r.state.ops.map(o=>o.id).sort((a,b)=>a-b),[50,60]);
 assert.equal(new Set(r.state.ops.map(o=>String(o.id))).size,r.state.ops.length);
});
test('first master quarantines pre-master operation for unknown dealer',()=>{
 const s={revision:1,state:state()};s.state.ops=[{id:70,type:'payment',dealerId:999,total:30}];
 const r=P.update(s,{protocol:2,action:'claim',device:main,state:state()});
 assert.equal(r.state.ops.some(o=>o.id===70),false);
 assert.equal(r.claimQuarantine.operations.length,1);
 assert.equal(r.claimQuarantine.operations[0].reason,'unknown_dealer');
});
test('first master does not auto-apply pre-master sales to canonical stock',()=>{
 const s={revision:1,state:state()};s.state.ops=[{id:80,type:'sale',dealerId:1,total:80,items:[{productId:2,qty:4,total:80}]}];
 const selected=state();
 const r=P.update(s,{protocol:2,action:'claim',device:main,state:selected});
 assert.equal(r.state.ops.some(o=>o.id===80),false);
 assert.equal(r.state.products[0].stock,100);
 assert.equal(r.claimQuarantine.operations[0].reason,'pre_master_non_financial');
});
