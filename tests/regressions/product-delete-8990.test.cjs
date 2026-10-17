'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const C=require('../../app/sync-core-8962');
const {update}=require('../../server/master-protocol-8962');
const source=fs.readFileSync(require.resolve('../../app/product-delete-8990.js'),'utf8');
const copy=value=>JSON.parse(JSON.stringify(value));
function harness(extra={},allow=true){
 const ctx={window:{},Date,confirm:()=>allow,state:{dealers:[],groups:[],products:[{id:1,name:'Полотно',stock:8,inventoryVersion:2,warehouseOpening:10},{id:2,name:'Багет',stock:15}],ops:[],...copy(extra)},cart:[{productId:1,qty:1},{productId:2,qty:1}],saved:0,save(){this.saved++;},delProduct(){}};
 // Global function calls do not bind this in strict code.
 ctx.alert=message=>{ctx.error=message;};ctx.render=()=>{ctx.rendered=(ctx.rendered||0)+1;};ctx.window.masterSync8962={commitState:next=>{ctx.state=next;ctx.saved++;}};vm.createContext(ctx);vm.runInContext(source,ctx);return ctx;
}
test('unused product is removed with tombstone and draft line removed',()=>{
 const h=harness();h.delProduct('1');assert.equal(h.state.products.length,1);assert.ok(h.state.deletedProducts['1']);assert.equal(h.cart.length,1);assert.equal(h.saved,1);assert.equal(h.state.products[0].stock,15);
});
test('used card is archived without changing receipts, debt or inventory; sync preserves archive',()=>{
 const receipt={id:10,type:'sale',dealerId:7,total:200,items:[{productId:1,name:'Полотно',qty:2,price:100,total:200}]};
 const h=harness({ops:[receipt]});const before=copy(h.state),ops=JSON.stringify(h.state.ops);h.delProduct(1);
 assert.equal(h.state.products[0].archived,true);assert.equal(h.state.products[0].stock,8);assert.equal(JSON.stringify(h.state.ops),ops);assert.equal(h.state.deletedProducts,undefined);
 const device={id:'product-delete-test',name:'Test'};
 const store={revision:1,state:before,computers:{shared:true,masterId:null,devices:{[device.id]:device}}};
 const next=update(store,{protocol:2,action:'changes',device,inventoryProtocol:2,changes:[],archives:{},productChanges:[{id:'1',before:before.products[0],after:copy(h.state.products[0])}]});
 assert.equal(next.state.products[0].archived,true);assert.equal(next.state.products[0].stock,8);assert.deepEqual(next.state.ops,[receipt]);
});
test('warehouse movement and archived receipt references retain cards',()=>{
 for(const extra of [
  {ops:[{id:11,type:'stock_receipt',items:[{productId:'1',qty:2}]}]},
  {receiptStates:{old:{archived:true,receipt:{id:10,type:'sale',items:[{productId:1,qty:2}]}}}},
  {receiptItemStates:{line:{archived:true,item:{productId:1,qty:2}}}}
 ]){const h=harness(extra);const snapshot=copy(extra);h.delProduct(1);assert.equal(h.state.products[0].archived,true);for(const key of Object.keys(extra))assert.deepEqual(copy(h.state[key]),snapshot[key]);}
});
test('cancel and missing product do not change state or pending draft',()=>{
 const h=harness({},false),before=JSON.stringify(h.state),draft=JSON.stringify(h.cart);h.delProduct(1);h.delProduct(99);assert.equal(JSON.stringify(h.state),before);assert.equal(JSON.stringify(h.cart),draft);assert.equal(h.saved,0);
});
test('catalog render excludes archived products and sales retain matching rule',()=>{
 const html=fs.readFileSync(require.resolve('../../app/index.html'),'utf8');
 assert.match(html,/function renderProducts\(\)[\s\S]*?return !p\.archived&&window\.SyncCore8962\.sameGroup/);
 assert.match(html,/function renderSaleProducts\(\)[\s\S]*?filter\(p=>!p\.archived&&/);
});
test('unused deletion sync is durable and idempotent with history unchanged',()=>{
 const h=harness(),before=copy(h.state);h.delProduct(1);
 const device={id:'product-delete-test',name:'Test'};
 const change={id:'1',before:before.products[0],after:null};
 const payload={protocol:2,action:'changes',device,changes:[],archives:{},productChanges:[change]};
 const next=update({revision:1,state:before,computers:{shared:true,masterId:null,devices:{[device.id]:device}}},payload);
 assert.ok(next.state.deletedProducts['1']);assert.equal(next.state.products.some(p=>p.id===1),false);
 const retry=update(next,payload);assert.equal(retry.state.products.length,1);assert.deepEqual(retry.state.ops,[]);
});

test('deleting a selected product clears stale selection and quantity dialog',()=>{
 const h=harness({ops:[{id:1,type:'sale',items:[{productId:1,qty:2}]}]});
 const controls={saleProduct:{value:'1'},selectedPhoto:{innerHTML:'photo'},salePrice:{value:'100'}};
 h.document={getElementById:id=>controls[id]};h.closeQtyModal=()=>{h.quantityClosed=true;};
 h.delProduct(1);assert.equal(controls.saleProduct.value,'');assert.equal(controls.selectedPhoto.innerHTML,'');assert.equal(controls.salePrice.value,'');assert.equal(h.quantityClosed,true);
});

test('persistence failure leaves used or unused product, draft and selection unchanged',()=>{
 for(const extra of [{},{ops:[{id:1,type:'sale',items:[{productId:1,qty:2}]}]}]){
  const h=harness(extra),before=JSON.stringify(h.state),draft=JSON.stringify(h.cart);
  const controls={saleProduct:{value:'1'},selectedPhoto:{innerHTML:'photo'},salePrice:{value:'100'}};
  h.document={getElementById:id=>controls[id]};h.closeQtyModal=()=>{h.quantityClosed=true;};
  h.window.masterSync8962.commitState=()=>{throw new Error('QuotaExceededError');};
  assert.equal(h.delProduct(1),false);
  assert.equal(JSON.stringify(h.state),before);assert.equal(JSON.stringify(h.cart),draft);
  assert.equal(controls.saleProduct.value,'1');assert.equal(controls.selectedPhoto.innerHTML,'photo');assert.equal(controls.salePrice.value,'100');
  assert.equal(h.quantityClosed,undefined);assert.equal(h.rendered,undefined);assert.equal(h.saved,0);assert.match(h.error,/QuotaExceededError/);
 }
});
test('successful persistence precedes draft mutation and render; sync is scheduled once',()=>{
 const h=harness({sync:{enabled:true}}),draft=JSON.stringify(h.cart);let saved=false;
 h.window.masterSync8962.commitState=next=>{assert.equal(JSON.stringify(h.cart),draft);h.state=next;saved=true;};
 h.render=()=>{assert.equal(saved,true);assert.equal(h.cart.length,1);};
 h.syncSaveTimer=77;h.clearTimeout=timer=>{assert.equal(timer,77);};h.setTimeout=(fn,delay)=>{assert.equal(saved,true);assert.equal(delay,350);h.scheduled=fn;return 78;};h.syncPush=manual=>{h.pushed=manual;};
 assert.equal(h.delProduct(1),true);assert.equal(h.syncSaveTimer,78);h.scheduled();assert.equal(h.pushed,false);
});

function syncHarness(){
 const device={id:'product-native-vm-0001',name:'Delete QA'};
 let server={revision:20,state:{dealers:[{id:7,name:'Dealer'}],groups:[],products:[{id:1,name:'Used',stock:8,inventoryVersion:2,warehouseOpening:10,catalogRev:4},{id:2,name:'Unused',stock:5,inventoryVersion:2,warehouseOpening:5,catalogRev:3}],ops:[{id:10,type:'sale',dealerId:7,total:200,inventoryTracked:true,items:[{productId:1,name:'Historical name',qty:2,price:100,total:200}]}],sync:{url:'https://delete-qa',enabled:true}},computers:{shared:true,devices:{[device.id]:device}}};
 const data=new Map([['uchet_device_8962',JSON.stringify(device)]]),timers=[];
 const initial=C.clone(server.state);initial._syncBaseline8981={url:initial.sync.url,baseline:{state:C.clone(initial),revision:20}};
 const ctx={state:initial,KEY:'local',window:{SyncCore8962:C,warehouseInstalled:true,PermanentDelete8989:require('../../app/permanent-delete-8989'),SyncConvergence8988:require('../../app/sync-convergence-8988')},document:{getElementById:()=>null},localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},norm:x=>x,delProduct(){},render(){},confirm:()=>true,alert:message=>{throw Error(message);},Date,cart:[{productId:2,qty:1}],setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},syncSaveTimer:null,syncCfg:()=>ctx.state.sync,
 syncRequest:async(method,body)=>{if(method==='PUT'){server=update(server,body);server.revision++;}return {...C.clone(server),ok:true,protocol:2,storage:'turso',inventoryProtocol:2,productRevisions:true};}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(require.resolve('../../app/master-sync-8962'),'utf8'),ctx);vm.runInContext(source,ctx);timers.length=0;
 return {ctx,data,server:()=>server};
}
test('real client sync sends deletion of revisioned card and preserves historical archived card',async()=>{
 const h=syncHarness(),history=JSON.stringify(h.server().state.ops);
 assert.equal(h.ctx.delProduct(2),true);assert.equal(h.ctx.delProduct(1),true);
 assert.equal(await h.ctx.window.masterSync8962.push(false),true);
 assert.ok(h.server().state.deletedProducts['2']);assert.equal(h.server().state.products.some(p=>p.id===2),false);
 assert.equal(h.server().state.products[0].archived,true);assert.equal(h.server().state.products[0].stock,8);
 assert.equal(JSON.stringify(h.server().state.ops),history);
 assert.equal(h.data.has('uchet_stale_products:https://delete-qa'),false);
 assert.equal(await h.ctx.window.masterSync8962.pull(false),true);
 assert.equal(h.ctx.state.products.some(p=>p.id===2),false);assert.equal(h.ctx.state.products[0].archived,true);
});
test('newer remote card still refuses stale deletion and actual cache revision rollback remains blocked',async()=>{
 const h=syncHarness();h.ctx.delProduct(2);
 h.server().state.products[1].catalogRev=4;h.server().state.products[1].name='Remote changed';h.server().revision++;
 assert.equal(await h.ctx.window.masterSync8962.push(false),true);
 assert.equal(h.server().state.products[1].name,'Remote changed');assert.equal(h.ctx.state.products[1].name,'Remote changed');
 assert.ok(h.data.has('uchet_stale_products:https://delete-qa'));
 const next=C.clone(h.ctx.state);next.products[1].catalogRev=1;next.products[1].name='Stale cache';h.ctx.window.masterSync8962.commitState(next);
 assert.equal(await h.ctx.window.masterSync8962.push(false),true);assert.equal(h.server().state.products[1].name,'Remote changed');
});
