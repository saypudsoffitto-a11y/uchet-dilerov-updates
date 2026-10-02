'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const C=require('../../app/sync-core-8962'),{update}=require('../../server/master-protocol-8962');
const device={id:'worker-device-0001',name:'Worker'};
const master={id:'master-device-0001',name:'Master'};
const product=(id=100,stock=50)=>({id,groupId:1,name:'Product '+id,article:'A'+id,retailPrice:180,wholesalePrice:170,buyPrice:90,stock});
const base=()=>({revision:10,state:{dealers:[{id:1,name:'Dealer'}],groups:[{id:1,name:'Полотно'}],products:[product(),product(200,20)],ops:[{id:1,type:'sale',dealerId:1,total:180,items:[{productId:100,qty:1,price:180,total:180}]}]},computers:{masterId:master.id,devices:{[master.id]:master,[device.id]:device}}});
const op=(id,type,items)=>({id,type,date:'2026-10-01',ts:Date.now(),note:'Test',items,total:0});
const item=(productId,qty,buyPrice=90)=>({productId,qty,buyPrice});
function send(store,ops,client=device,extra={}){
  const next=update(store,{protocol:2,action:'changes',device:client,inventoryProtocol:2,changes:C.diffOps(store.state.ops,[...store.state.ops,...ops]),...extra});
  next.revision++;return next;
}
function client(local,baseline,server,inventory=false){
  const data=new Map([['uchet_device_8962',JSON.stringify(device)]]),timers=[];
  if(baseline)data.set('uchet_sync_baseline_8962:https://test',JSON.stringify({state:baseline,revision:10}));
  let remote=C.clone(server);
  const ctx={window:{SyncCore8962:C,warehouseInstalled:inventory},state:C.clone(local),KEY:'local',
    localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},
    document:{getElementById:()=>null,createElement:()=>({}),querySelector:()=>null},
    render:()=>{},norm:x=>x,setTimeout:fn=>{timers.push(fn);return timers.length;},
    syncCfg:()=>({url:'https://test',enabled:true}),
    syncRequest:async(method,body)=>{
      if(method==='PUT'){remote=update(remote,body);remote.revision++;}
      return {...C.clone(remote),ok:true,protocol:2,storage:'turso'};
    }};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../../app/master-sync-8962.js'),'utf8'),ctx);timers.length=0;
  return {ctx,data,timers,server:()=>remote,setServer:s=>{remote=s;}};
}
function newPrice(store,value){const before=C.clone(store.state.products[0]);const after={...before,retailPrice:value};const s=update(store,{protocol:2,action:'changes',device:master,changes:[],productChanges:[{id:'100',before,after}]});s.revision++;return s;}

test('long-offline second computer receives 200 and never publishes its cached 180; receipts stay 180',async()=>{
  const old=base(),server=newPrice(old,200),h=client(old.state,old.state,server);
  assert.equal(await h.ctx.window.masterSync8962.pull(false),true);
  assert.equal(h.ctx.state.products[0].retailPrice,200);
  assert.equal(await h.ctx.window.masterSync8962.push(false),true);
  assert.equal(h.server().state.products[0].retailPrice,200);
  assert.equal(h.server().state.ops[0].items[0].price,180);
});
test('obsolete queued product edit is quarantined and cannot roll back a newer server card',async()=>{
  const old=base(),local=C.clone(old.state);local.products[0].retailPrice=160;
  const h=client(local,old.state,newPrice(old,200));
  assert.equal(await h.ctx.window.masterSync8962.push(false),true);
  assert.equal(h.ctx.state.products[0].retailPrice,200);
  assert.ok(h.data.get('uchet_stale_products:https://test'));
  assert.equal(h.server().state.products[0].retailPrice,200);
});
test('old local cache cannot overwrite the confirmed baseline price',async()=>{
  const old=base(),fresh=newPrice(old,200),h=client(old.state,fresh.state,fresh);
  assert.equal(await h.ctx.window.masterSync8962.push(false),true);
  assert.equal(h.ctx.state.products[0].retailPrice,200);
});
test('older server revision is refused without modifying localStorage or the visible price',async()=>{
  const old=base(),fresh=newPrice(old,200),h=client(fresh.state,fresh.state,{...old,revision:9});
  assert.equal(await h.ctx.window.masterSync8962.pull(false),false);
  assert.equal(h.ctx.state.products[0].retailPrice,200);
});
test('server card revision rollback is refused even if database revision increased',async()=>{
  const old=base(),fresh=newPrice(old,200),h=client(fresh.state,fresh.state,{...old,revision:30});
  assert.equal(await h.ctx.window.masterSync8962.pull(false),false);
  assert.equal(h.ctx.state.products[0].retailPrice,200);
});
test('inventory migration preserves live quantities and historical sale prices exactly',()=>{
  const store=base(),previous=C.clone(store.state.ops);
  C.enableInventory(store.state);
  assert.equal(store.state.products[0].stock,50);
  assert.equal(store.state.products[0].initialStock,51);
  assert.deepEqual(store.state.ops,previous);
  C.enableInventory(store.state);assert.equal(store.state.products[0].stock,50);
});
test('one receipt with multiple products adds stock once, keeps acquisition prices and retries safely',()=>{
  const old=base(),receipt=op('stock-r1','stock_receipt',[item(100,10,100),item(200,4,80)]);
  const next=send(old,[receipt]);
  assert.equal(next.state.products[0].stock,60);assert.equal(next.state.products[1].stock,24);
  assert.equal(next.state.ops.find(o=>o.id==='stock-r1').items[1].buyPrice,80);
  const retry=update(next,{protocol:2,action:'changes',device,inventoryProtocol:2,changes:[{id:receipt.id,before:null,after:receipt}]});
  assert.equal(retry.state.products[0].stock,60);
  assert.deepEqual(C.inventoryHistory(next.state,100).map(r=>r.type),['initial','sale','stock_receipt']);
});
test('sales, editing quantity, deleting sale and restoring it recalculate without changing other product',()=>{
  let current=send(base(),[]);
  const receipt=op('sale-2','sale',[{productId:100,qty:3,price:200,buyPrice:90,total:600}]);receipt.dealerId=1;receipt.total=600;
  current=send(current,[receipt]);assert.equal(current.state.products[0].stock,47);
  const edited={...receipt,items:[{...receipt.items[0],qty:5,total:1000}],total:1000};
  current=update(current,{protocol:2,action:'changes',device,inventoryProtocol:2,changes:[{id:receipt.id,before:receipt,after:edited}]});
  assert.equal(current.state.products[0].stock,45);
  current=update(current,{protocol:2,action:'changes',device,inventoryProtocol:2,changes:[{id:receipt.id,before:edited,after:null}]});
  assert.equal(current.state.products[0].stock,50);
  current=send(current,[edited]);assert.equal(current.state.products[0].stock,45);
  assert.equal(current.state.products[1].stock,20);
  assert.equal(current.state.ops[0].items[0].price,180);
});
test('return, signed correction and opening quantity are separate journal documents',()=>{
  const next=send(base(),[
    op('stock-return','stock_return',[item(100,2)]),
    op('stock-adjust','stock_adjustment',[item(100,-3)]),
    op('stock-opening','stock_opening',[item(100,10)])
  ]);
  assert.equal(next.state.products[0].stock,59);
  assert.equal(next.state.products[0].initialStock,61);
  assert.deepEqual(C.inventoryHistory(next.state,100).map(r=>r.type),['initial','sale','stock_return','stock_adjustment','stock_opening']);
});
test('concurrent receipts from two computers survive stale snapshots and apply once',()=>{
  const old=base(),a=op('stock-a','stock_receipt',[item(100,10)]),b=op('stock-b','stock_receipt',[item(100,4)]);
  const first=send(old,[a]);
  const second=update(first,{protocol:2,action:'changes',device:master,inventoryProtocol:2,changes:[{id:b.id,before:null,after:b}]});
  assert.equal(second.state.products[0].stock,64);
  const retry=update(second,{protocol:2,action:'changes',device,inventoryProtocol:2,changes:[{id:a.id,before:null,after:a}]});
  assert.equal(retry.state.products[0].stock,64);
});
test('offline warehouse receipt is retained, uploaded, then pulled on the other computer',async()=>{
  const old=base(),local=C.clone(old.state);C.enableInventory(local);
  local.ops.push(op('stock-offline','stock_receipt',[item(100,7)]));C.recalcInventory(local);
  const h=client(local,old.state,old,true);
  assert.equal(await h.ctx.window.masterSync8962.pull(false),true);assert.equal(h.ctx.state.products[0].stock,57);
  assert.equal(await h.ctx.window.masterSync8962.push(false),true);assert.equal(h.server().state.products[0].stock,57);
  const other=client(old.state,old.state,h.server(),true);
  assert.equal(await other.ctx.window.masterSync8962.pull(false),true);assert.equal(other.ctx.state.products[0].stock,57);
});
test('old computer cannot overwrite warehouse stock with a snapshot or revive a deleted sale',()=>{
  const old=base(),fresh=send(old,[op('stock-arrival','stock_receipt',[item(100,7)])]);
  assert.throws(()=>update(fresh,{protocol:2,action:'changes',device:master,changes:[],stockOverrides:[{id:'100',before:57,after:50}]}),/документ корректировки/);
  const receipt=old.state.ops[0];
  const deleted=update(fresh,{protocol:2,action:'changes',device,inventoryProtocol:2,changes:[{id:'1',before:receipt,after:null}]});
  assert.equal(deleted.state.products[0].stock,58);
  assert.throws(()=>update(deleted,{protocol:2,action:'changes',device,changes:[{id:'1',before:receipt,after:{...receipt,total:300}}]}),/изменена на другом/);
});
test('invalid quantity, acquisition price, document date and missing product are refused',()=>{
  for(const invalid of [item(100,0),item(100,-1),item(100,1,-1),item(999,1),item(100,NaN)])assert.throws(()=>send(base(),[op('stock-bad','stock_receipt',[invalid])]));
  assert.throws(()=>send(base(),[{...op('stock-bad','stock_receipt',[item(100,1)]),date:'invalid'}]));
});
test('group matching supports string/numeric IDs, Unicode and duplicate group names on both platforms',()=>{
  const s={groups:[{id:1,name:' Полотно '},{id:2,name:'ПОЛОТНО\u00a0'},{id:'cloth',name:'Фурнитура'}]};
  assert.equal(C.sameGroup(s,'1',1),true);
  assert.equal(C.sameGroup(s,1,'2'),true);
  assert.equal(C.sameGroup(s,'cloth',2),false);
  assert.equal(C.sameGroup(s,1,''),true);
  assert.equal(C.sameGroup(s,99,2),false);
});

test('new product plus initial quantity are one transaction and preserve the opening journal',()=>{
  const old=base(),p=product(300,0),opening=op('stock-new-opening','stock_opening',[item(300,12)]);
  const next=update(old,{protocol:2,action:'changes',device,inventoryProtocol:2,changes:[{id:opening.id,before:null,after:opening}],productChanges:[{id:'300',before:null,after:p}]});
  const saved=next.state.products.find(p=>p.id===300);
  assert.equal(saved.stock,12);assert.equal(saved.initialStock,12);assert.equal(saved.warehouseOpening,0);
  C.recalcInventory(next.state);assert.equal(saved.stock,12);
});
test('unrelated newer server field does not discard a pending local price',async()=>{
  const old=base(),remote=update(old,{protocol:2,action:'changes',device:master,changes:[],productChanges:[{id:'100',before:old.state.products[0],after:{...old.state.products[0],name:'New name'}}]});remote.revision++;
  const local=C.clone(old.state);local.products[0].retailPrice=200;
  const h=client(local,old.state,remote);
  assert.equal(await h.ctx.window.masterSync8962.push(false),true);
  assert.equal(h.ctx.state.products[0].name,'New name');assert.equal(h.ctx.state.products[0].retailPrice,200);
  assert.equal(h.server().state.products[0].retailPrice,200);
});
test('offline warehouse document survives the first connection without an existing baseline',async()=>{
  const old=base(),local=C.clone(old.state);C.enableInventory(local);
  local.ops.push(op('stock-first-connect','stock_receipt',[item(100,3)]));C.recalcInventory(local);
  const h=client(local,null,old,true);
  assert.equal(await h.ctx.window.masterSync8962.pull(false),true);assert.equal(h.ctx.state.products[0].stock,53);
  assert.equal(await h.ctx.window.masterSync8962.push(false),true);assert.equal(h.server().state.products[0].stock,53);
});
test('archive and restoration of a sale change warehouse stock once and preserve cancelled history',()=>{
  const A=require('../../app/receipt-archive-core');
  const initial=base().state;C.enableInventory(initial);
  const archived=A.transition(initial,1,true,Date.now());C.recalcInventory(archived);
  assert.equal(archived.products[0].stock,51);
  assert.ok(C.inventoryHistory(archived,100).find(row=>row.cancelled));
  const restored=A.transition(archived,1,false,Date.now()+1);C.recalcInventory(restored);
  assert.equal(restored.products[0].stock,50);
  A.apply(restored);C.recalcInventory(restored);assert.equal(restored.products[0].stock,50);
});

for(const phase of ['GET','PUT'])test('warehouse document created during '+phase+' stays local and is automatically sent next',async()=>{
  const old=base(),local=C.clone(old.state);C.enableInventory(local);
  const h=client(local,old.state,old,true),request=h.ctx.syncRequest;
  let release,entered;
  const gate=new Promise(r=>release=r),waiting=new Promise(r=>entered=r);let paused=false;
  h.ctx.syncRequest=async(method,body)=>{
    if(!paused&&method===phase){paused=true;entered();await gate;}
    return request(method,body);
  };
  const sending=h.ctx.window.masterSync8962.push(false);await waiting;
  h.ctx.state.ops.push(op('stock-inflight-'+phase,'stock_receipt',[item(100,5)]));C.recalcInventory(h.ctx.state);
  release();assert.equal(await sending,true);
  assert.equal(h.ctx.state.products[0].stock,55);
  assert.equal(JSON.parse(h.data.get('local')).products[0].stock,55);
  assert.equal(h.server().state.products[0].stock,50);
  assert.equal(h.timers.length,1);
  await h.timers.shift()();assert.equal(h.server().state.products[0].stock,55);
});
test('group list renders all 210 products without window named element globals',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../../app/index.html'),'utf8');
  const render=html.slice(html.indexOf('function renderSaleProducts(){'),html.indexOf('function selectSaleProduct('));
  const ctx={window:{SyncCore8962:C},document:{getElementById:()=>({value:'1'})},
    state:{groups:[{id:1,name:'Полотно'},{id:'2',name:'полотно'}],products:Array.from({length:210},(_,i)=>({...product(i+1),groupId:'2'}))},
    saleProductSearch:{value:''},saleProductList:{innerHTML:''},saleProductCursor:0,priceType:{value:'retail'},esc:s=>String(s),money:String};
  vm.createContext(ctx);vm.runInContext(render+';renderSaleProducts()',ctx);
  assert.equal((ctx.saleProductList.innerHTML.match(/class="choiceRow /g)||[]).length,210);
});
test('price edited during first connection is preserved even without a baseline',async()=>{
  const old=base(),h=client(old.state,null,old),request=h.ctx.syncRequest;
  let release,entered;const gate=new Promise(r=>release=r),waiting=new Promise(r=>entered=r);
  let paused=false;
  h.ctx.syncRequest=async(method,body)=>{if(!paused&&method==='GET'){paused=true;entered();await gate;}return request(method,body);};
  const pulling=h.ctx.window.masterSync8962.pull(false);await waiting;
  h.ctx.state.products[0].retailPrice=200;release();assert.equal(await pulling,true);
  assert.equal(h.ctx.state.products[0].retailPrice,200);
  assert.equal(await h.ctx.window.masterSync8962.push(false),true);
  assert.equal(h.server().state.products[0].retailPrice,200);
});
test('initial master selection accepts opening documents without inventing a dealer',()=>{
  const store=base();store.computers={masterId:null,devices:{}};
  const chosen=C.clone(store.state);C.enableInventory(chosen);
  chosen.ops.push(op('stock-claim','stock_opening',[item(100,3)]));C.recalcInventory(chosen);
  const next=update(store,{protocol:2,action:'claim',device:master,state:chosen});
  assert.equal(next.state.products[0].stock,53);
  assert.equal(next.state.ops[0].items[0].price,180);
});
test('CSV reimport cannot restore old prices or quantities; new products use an opening document',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../../app/index.html'),'utf8');
  const start=html.indexOf('function importStockProductRows(rows){'),end=html.indexOf('async function getCsvPayload',start);
  const state={groups:[{id:1,name:'Полотно'}],products:[{...product(),name:'Old',article:'OLD',inventoryVersion:2,warehouseOpening:50}],ops:[]};
  const ctx={state,window:{nextEntityId:require('../../app/entity-id-8981')(require('node:crypto').webcrypto,{getItem:()=>null,setItem:()=>{}},()=>state),warehouseInstalled:true,warehouseImportOpening:items=>{
    state.ops.push(op('stock-csv','stock_opening',items));C.recalcInventory(state);
  }},csvNum:Number,ensureGroupByName:()=>state.groups[0],save:()=>C.recalcInventory(state)};
  vm.createContext(ctx);vm.runInContext(html.slice(start,end),ctx);
  ctx.importStockProductRows([['OLD','Old','',0,'Полотно',1,'шт',120],['NEW','New','',0,'Полотно',8,'шт',150]]);
  assert.equal(state.products[0].retailPrice,180);assert.equal(state.products[0].stock,50);
  assert.equal(state.products[1].stock,8);assert.equal(state.products[1].warehouseOpening,0);
  assert.equal(state.ops[0].type,'stock_opening');
});
test('an older server that silently ignores new productChanges cannot reset a local price',async()=>{const old=base(),local=C.clone(old.state);local.products[0].retailPrice=200;const h=client(local,old.state,old,true),request=h.ctx.syncRequest;let writes=0;h.ctx.syncRequest=async(method,body)=>{if(method==='PUT')writes++;return {...await request(method,body),serverVersion:'8.9.76-sync6'}};assert.equal(await h.ctx.window.masterSync8962.push(false),false);assert.equal(h.ctx.state.products[0].retailPrice,200);assert.equal(writes,0);assert.equal(h.server().state.products[0].retailPrice,180)});
