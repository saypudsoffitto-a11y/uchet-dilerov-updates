'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const C=require('../../app/sync-core-8962');
const D=require('../../app/permanent-delete-8989');
const P=require('../../server/master-protocol-8962');
const clock=10000;
const devices=[{id:'office-00000000000001',name:'Офис'},{id:'shop-0000000000000002',name:'Цех'},{id:'travel-00000000000003',name:'Другой город'}];
function fixture(v2=false){
 const s={dealers:[{id:1,name:'Дилер с долгом',phone:'79991111111'},{id:2,name:'Другой дилер',phone:'79992222222'}],groups:[],products:[{id:9,name:'Материал',article:'M',stock:93,receiptArchiveStock:{16:2,17:1}}],dealerAliases:{101:'1'},deletedProducts:{},productAliases:{},receiptSeq:20,
 ops:[{id:11,dealerId:1,type:'initial_debt',total:500,ts:100,source:'Тетрадь'},{id:12,dealerId:1,type:'sale',total:400,ts:200,items:[{productId:9,qty:4}]},{id:13,dealerId:1,type:'payment',total:150,ts:300,beforeDebt:900,afterDebt:750},{id:14,dealerId:2,type:'sale',total:300,ts:200,items:[{productId:9,qty:3}]},{id:15,dealerId:2,type:'payment',total:20,ts:300,beforeDebt:300,afterDebt:280}],
 receiptStates:{16:{archived:true,receipt:{id:16,dealerId:1,type:'sale',total:200,ts:150,items:[{productId:9,qty:2}]},stockQuantities:{9:2}},17:{archived:true,receipt:{id:17,dealerId:2,type:'sale',total:100,ts:150,items:[{productId:9,qty:1}]},stockQuantities:{9:1}}},
 receiptItemStates:{'12:line-a':{receiptId:12,dealerId:1,archived:true},'16:line-a':{receiptId:16,dealerId:1,archived:true},'18:orphan':{receiptId:18,dealerId:1,archived:true},'17:line-a':{receiptId:17,dealerId:2,archived:true}}};
 return v2?C.enableInventory(s):s;
}
const command=(target,extra={})=>({requestId:'request-'+target+'-0001',target,dealerId:1,confirmed:true,preserveStock:true,...extra});
const debt=(s,d)=>s.ops.filter(o=>String(o.dealerId)===String(d)).reduce((sum,o)=>sum+(o.type==='payment'?-o.total:o.type==='sale'||o.type==='initial_debt'?o.total:0),0);
const store=s=>({revision:10,state:C.clone(s),computers:{shared:true,masterId:null,devices:{}}});
const put=(s,device,payload)=>P.update(s,{protocol:2,action:'changes',device,...payload});
const purge=(s,device,cmd)=>P.update(s,{protocol:2,action:'purge',device,deletion:cmd});
function others(s){return {dealer:s.dealers.find(d=>d.id===2),ops:s.ops.filter(o=>o.dealerId===2),receipt:s.receiptStates[17],items:s.receiptItemStates['17:line-a']};}
function assertCleared(out,input,removedCard){
 assert.equal(out.dealers.some(d=>d.id===1),!removedCard);
 assert.equal(out.ops.some(o=>o.dealerId===1),false);
 assert.equal(debt(out,1),0);
 assert.equal(out.receiptStates[16],undefined);
 assert.equal(Object.values(out.receiptItemStates).some(e=>e.dealerId===1),false);
 assert.equal(out.products[0].stock,input.products[0].stock,'physical stock must not change');
 assert.deepEqual(others(out),others(input),'other dealer must remain byte-for-byte unchanged');
 assert.equal(out.receiptSeq,input.receiptSeq,'receipt numbers must never be reused');
 assert.equal(out.products[0].receiptArchiveStock[16],undefined);
 assert.equal(out.products[0].receiptArchiveStock[17],1);
}

for(const v2 of [false,true]){
 test(`delete dealer with unpaid debt removes notebook, sales, payments and archives; stock ${v2?'v2':'legacy'} unchanged`,()=>{
  const input=fixture(v2),snapshot=C.clone(input);assert.equal(debt(input,1),750);
  const out=D.apply(input,command('dealer'),clock);assertCleared(out,input,true);
  assert.ok(out.permanentDeletions.dealers[1]);assert.ok(out.permanentDeletions.dealers[101]);
  assert.deepEqual(input,snapshot,'purge must not mutate source snapshot');
 });
 test(`clear history leaves dealer available for new sales and zero debt; stock ${v2?'v2':'legacy'} unchanged`,()=>{
  const input=fixture(v2),out=D.apply(input,command('history'),clock);assertCleared(out,input,false);
  assert.deepEqual(out.dealers,input.dealers);
  assert.equal(out.permanentDeletions.history[1],clock);
  assert.equal(out.permanentDeletions.dealers[1],undefined);
  if(v2){assert.equal(out.products[0].warehouseOpening,96);C.recalcInventory(out);assert.equal(out.products[0].stock,93);}
 });
}

test('delete notebook amount alone recalculates remaining payment balances without touching other dealer or inventory',()=>{
 const input=fixture(true),out=D.apply(input,command('operation',{operationId:11}),clock);
 assert.equal(debt(out,1),250);assert.equal(out.ops.find(o=>o.id===13).beforeDebt,400);assert.equal(out.ops.find(o=>o.id===13).afterDebt,250);
 assert.equal(out.ops.some(o=>o.id===11),false);assert.ok(out.permanentDeletions.operations[11]);
 assert.equal(out.products[0].stock,93);assert.deepEqual(others(out),others(input));assert.deepEqual(out.receiptStates,input.receiptStates);
});

test('deleting through an alias purges the canonical card and all historical aliases',()=>{
 const input=fixture(true);input.dealerAliases[102]='101';input.ops[0].dealerId=102;input.receiptStates[16].receipt.dealerId=101;
 const out=D.apply(input,command('dealer',{dealerId:102}),clock);
 assert.equal(out.dealers.some(d=>d.id===1),false);assert.equal(out.ops.some(o=>[1,101,102].includes(o.dealerId)),false);
 for(const id of [1,101,102])assert.ok(out.permanentDeletions.dealers[id]);
 assert.equal(out.receiptStates[16],undefined);assert.equal(out.products[0].stock,93);
});

test('lost acknowledgement retry cannot purge newer history or alter stock a second time',()=>{
 const input=fixture(true),cmd=command('history'),out=D.apply(input,cmd,clock);
 const newSale={id:19,dealerId:1,type:'sale',total:300,ts:clock+1,historyEpoch8989:clock,items:[{productId:9,qty:3}]};
 const changed=C.applyTransaction(out,[{id:'19',before:null,after:newSale}],{});
 assert.equal(changed.products[0].stock,90);
 const retry=D.apply(changed,cmd,clock+1000);assert.deepEqual(retry,changed);assert.equal(debt(retry,1),300);
 assert.throws(()=>D.apply(changed,{...cmd,target:'dealer'},clock+1000),/уже использован/);
});

test('permanent operation IDs block resurrection even when stale computer edits the document timestamp',()=>{
 const input=fixture(true),out=D.apply(input,command('history'),clock);
 const edited={...input.ops[1],ts:clock+1000,total:999};
 assert.equal(D.filterChanges(out,[{id:'12',before:null,after:edited}]).length,0);
 const stale=C.clone(out);stale.ops.push(edited);stale.receiptStates[16]={...input.receiptStates[16],receipt:{...input.receiptStates[16].receipt,ts:clock+1000}};
 const cleaned=D.sanitize(stale);assert.equal(cleaned.ops.some(o=>o.id===12),false);assert.equal(cleaned.receiptStates[16],undefined);
});

test('history epoch blocks unseen offline documents regardless of clock; allows sales from fresh baseline',()=>{
 const out=D.apply(fixture(true),command('history'),clock);
 const old={id:91,dealerId:1,type:'initial_debt',total:250,ts:clock-1},futureOld={id:93,dealerId:1,type:'sale',total:300,ts:clock+1000000,items:[]},fresh={id:92,dealerId:1,type:'sale',total:80,ts:clock+1,historyEpoch8989:clock,items:[]};
 const safe=D.filterChanges(out,C.diffOps([], [old,futureOld,fresh]));assert.deepEqual(safe.map(ch=>ch.id),['92']);
 const result=put(store(out),devices[1],{changes:safe});assert.equal(debt(result.state,1),80);
});

test('three computers converge after deleting dealer; stale catalog, sale and archives cannot restore him or block unrelated payment',()=>{
 const old=fixture(true),snapshots=[C.clone(old),C.clone(old),C.clone(old)];
 let server=purge(store(old),devices[0],command('dealer'));
 const staleSale={...snapshots[1].ops[1],ts:Date.now()+1000000};
 const staleArchive={...old.receiptStates[16],receipt:{...old.receiptStates[16].receipt,ts:Date.now()+1000000}};
 const payment={id:99,type:'payment',dealerId:2,total:30,ts:clock+1};
 server=put(server,devices[1],{changes:C.diffOps([], [staleSale,payment]),archives:{receiptStates:[{key:'16',before:null,after:staleArchive}],receiptItemStates:[{key:'18:orphan',before:null,after:old.receiptItemStates['18:orphan']}]},catalogPatch:{dealers:[{id:'1',before:null,after:old.dealers[0]}]}});
 const baseline=JSON.parse(JSON.stringify(server));
 server=put(server,devices[2],{changes:C.diffOps([], [old.ops[0]]),archives:{receiptStates:[{key:'16',before:null,after:old.receiptStates[16]}]}});
 assert.deepEqual(server.state,baseline.state);assert.equal(server.state.products[0].stock,93);assert.equal(debt(server.state,2),250);
 for(let i=0;i<3;i++){snapshots[i]=D.sanitize(JSON.parse(JSON.stringify(server.state)));assert.deepEqual(snapshots[i],server.state);assert.equal(debt(snapshots[i],1),0);assert.equal(snapshots[i].dealers.some(d=>d.id===1),false);}
});

test('new-ID import of a permanently removed dealer identity is rejected and cannot recreate its operations',()=>{
 const old=fixture(),server=purge(store(old),devices[0],command('dealer'));
 assert.throws(()=>put(server,devices[2],{catalogPatch:{dealers:[{id:'901',before:null,after:{...old.dealers[0],id:901}}]}}),/удалён/);
 assert.equal(server.state.dealers.some(d=>d.id===901),false);
});

test('legacy deletion with debt requires explicit full-purge confirmation and cannot partially change server state',()=>{
 const old=fixture(true),input=store(old),unchanged=C.clone(input);
 assert.throws(()=>put(input,devices[1],{catalogPatch:{dealers:[{id:'1',before:old.dealers[0],after:null}]}}),/8\.9\.89.*подтвердите/);
 assert.deepEqual(input,unchanged);
 const out=purge(input,devices[1],command('dealer'));assertCleared(out.state,old,true);
 assert.ok(out.state.permanentDeletions.dealers[1]);
 const retry=put(out,devices[2],{catalogPatch:{dealers:[{id:'1',before:old.dealers[0],after:null}]}});
 assert.deepEqual(retry.state,out.state);
});

test('requests without explicit confirmation, stock policy or valid scope are refused atomically',()=>{
 const input=fixture(true),unchanged=C.clone(input);
 for(const changes of [{confirmed:false},{confirmed:undefined},{preserveStock:false},{target:'all'},{requestId:'bad'},{dealerId:999},{target:'operation',operationId:12},{target:'operation',operationId:14},{target:'operation',operationId:999}])assert.throws(()=>D.apply(input,{...command('dealer'),...changes},clock));
 assert.deepEqual(input,unchanged);
 assert.throws(()=>purge(store(input),devices[0],{...command('dealer'),confirmed:false}));
});

test('browser and server apply exactly the same permanent deletion semantics',()=>{
 assert.equal(fs.readFileSync(require.resolve('../../app/permanent-delete-8989'),'utf8'),fs.readFileSync(require.resolve('../../server/permanent-delete-8989'),'utf8'));
});

test('each repeated history clear establishes a new epoch; documents from prior history cannot be recreated',()=>{
 const first=D.apply(fixture(true),command('history'),clock);
 const sale={id:90,dealerId:1,type:'sale',total:20,ts:clock+20,historyEpoch8989:clock,items:[]};
 const changed=C.applyTransaction(first,[{id:'90',before:null,after:sale}],{});
 const second=D.apply(changed,command('history',{requestId:'request-history-0002'}),clock+100);
 const unseenPriorEpoch={id:91,dealerId:1,type:'sale',total:20,ts:clock+20000,historyEpoch8989:clock,items:[]};
 const newEpoch={id:92,dealerId:1,type:'sale',total:20,ts:clock+101,historyEpoch8989:clock+100,items:[]};
 const safe=D.filterChanges(second,C.diffOps([], [sale,unseenPriorEpoch,newEpoch]));
 assert.deepEqual(safe.map(ch=>ch.id),['92']);
});

test('ordinary payment deletion records an immutable operation ID; stale computer cannot add it again',()=>{
 const input=store(fixture()),payment=input.state.ops.find(o=>o.id===13);
 const deleted=put(input,devices[0],{changes:[{id:'13',before:payment,after:null}]});
 assert.ok(deleted.state.permanentDeletions.operations[13]);
 const replay=put(deleted,devices[1],{changes:[{id:'13',before:null,after:{...payment,ts:Date.now()+1000000}}]});
 assert.deepEqual(replay.state,deleted.state);assert.equal(debt(replay.state,1),900);
});

test('archiving remains reversible; archive transition must not be marked as permanent operation deletion',()=>{
 const original=fixture(),input=store(original),sale=original.ops.find(o=>o.id===12);
 const archived=C.clone(original);archived.ops=archived.ops.filter(o=>o.id!==12);
 archived.receiptStates[12]={archived:true,receipt:C.clone(sale),stockQuantities:{9:4}};
 const archive=put(input,devices[0],{changes:C.diffOps(original.ops,archived.ops),archives:C.diffArchives(original,archived)});
 assert.equal(archive.state.permanentDeletions?.operations?.[12],undefined);
 assert.equal(archive.state.products[0].stock,97);
 const restored=C.clone(archive.state);restored.ops.push(C.clone(sale));restored.receiptStates[12]={...restored.receiptStates[12],archived:false};
 const result=put(archive,devices[1],{changes:C.diffOps(archive.state.ops,restored.ops),archives:C.diffArchives(archive.state,restored)});
 assert.deepEqual(result.state.ops.find(o=>o.id===12),sale);assert.equal(result.state.products[0].stock,93);
});
