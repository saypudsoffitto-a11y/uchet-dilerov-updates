'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const C=require('../../app/sync-core-8962'),P=require('../../app/catalog-pending-8972'),serverProtocol=require('../../server/master-protocol-8962');
const read=f=>fs.readFileSync(path.join(__dirname,'../../app',f),'utf8');
const tick=()=>new Promise(setImmediate);
const device={id:'test-device-000000001',name:'Test'};
const sample=()=>({products:[{id:1,name:'МАТ BAUF 500см',retailPrice:180,wholesalePrice:180,stock:100}],dealers:[],groups:[],ops:[],sync:{url:'https://test.invalid',enabled:true}});
function harness({baseline=true,worker=false}={}){
 const data=new Map(),nodes=new Map();
 for(const id of ['pname','particle','pbuy','pretail','pwholesale','punit','productListSearch','productGroupFilter','editProductId','editPname','editPgroup','editParticle','editPbuy','editPretail','editPwholesale','editPunit'])nodes.set(id,{value:'',focus(){}});
 const ctx={console,state:sample(),KEY:'db',CatalogPending8972:P,SyncCore8962:C,document:{getElementById:id=>nodes.get(id)||null,documentElement:{dataset:{}}},localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)},render(){},renderProducts(){},norm:x=>x,setTimeout(){},alert:m=>{ctx.alert=m},syncCfg:()=>ctx.state.sync};ctx.window=ctx;
 let server={state:sample(),revision:1,computers:{masterId:worker?'main-device-00000001':device.id,devices:{[device.id]:{name:device.name}}}};
 data.set('uchet_device_8962',JSON.stringify(device));if(baseline)data.set('uchet_sync_baseline_8962:https://test.invalid',JSON.stringify({state:server.state,revision:1}));
 ctx.syncRequest=async(method,body)=>{
  if(ctx.hook)await ctx.hook(method,body);
  if(method==='PUT'&&!ctx.ignorePut){server=serverProtocol.update(server,body);server.revision++;}
  return {...C.clone(server),ok:true,protocol:2,storage:'turso'};
 };
 vm.createContext(ctx);for(const f of ['master-sync-8962.js','release-8971.js'])vm.runInContext(read(f),ctx,{filename:f});
 return {ctx,nodes,data,server:()=>server,create:async(name='ПРИЩЕПКА ДЛЯ МОНТАЖА')=>{nodes.get('pname').value=name;nodes.get('pretail').value='85';nodes.get('pwholesale').value='85';return ctx.addProduct();},edit:(price=85)=>{for(const [k,v]of Object.entries({editProductId:1,editPname:'МАТ BAUF 500см',editPretail:price,editPwholesale:price}))nodes.get(k).value=String(v);return ctx.saveProductEdit();}};
}
for(const baseline of [true,false])test('create during in-flight pull remains visible and queued push reaches server; baseline='+baseline,async()=>{
 const h=harness({baseline});let resume,entered;
 const started=new Promise(r=>entered=r);let first=true;
 h.ctx.hook=async method=>{if(method==='GET'&&first){first=false;entered();await new Promise(r=>resume=r)}};
 const pulling=h.ctx.masterSync8962.pull(true);await started;
 const created=await h.create();assert.equal(h.ctx.state.products.some(p=>p.id===created.id),true);
 resume();await pulling;await h.ctx.masterSync8962.push(true);
 assert.equal(h.ctx.state.products.some(p=>p.id===created.id),true);
 assert.equal(h.server().state.products.some(p=>p.id===created.id),true);
 assert.equal(JSON.parse(h.data.get('db')).products.some(p=>p.id===created.id),true);
});
test('180 -> 85 save survives a stale server pull, reopening and persistence',async()=>{
 const h=harness();h.ctx.state.sync.enabled=false;h.edit();
 assert.equal(h.ctx.state.products[0].retailPrice,85);
 assert.equal(await h.ctx.masterSync8962.pull(true),true);
 assert.equal(h.ctx.state.products[0].retailPrice,85);
 assert.equal(JSON.parse(h.data.get('db')).products[0].retailPrice,85);
 assert.equal(await h.ctx.masterSync8962.push(true),true);
 assert.equal(h.server().state.products[0].retailPrice,85);
});
test('edits made during PUT are retained and sent by the next queued request',async()=>{
 const h=harness();h.ctx.state.sync.enabled=false;h.edit(120);let resume,entered;const started=new Promise(r=>entered=r);let first=true;
 h.ctx.hook=async method=>{if(method==='PUT'&&first){first=false;entered();await new Promise(r=>resume=r)}};
 const pushing=h.ctx.masterSync8962.push(true);await started;h.edit(85);resume();assert.equal(await pushing,true);
 assert.equal(h.ctx.state.products[0].retailPrice,85);assert.equal(h.server().state.products[0].retailPrice,120);
 assert.equal(await h.ctx.masterSync8962.push(true),true);assert.equal(h.server().state.products[0].retailPrice,85);
});
test('a worker sends updated price and preserves remote stock',async()=>{
 const h=harness({worker:true});h.ctx.state.sync.enabled=false;h.edit();h.server().state.products[0].stock=96;
 assert.equal(await h.ctx.masterSync8962.push(true),true);assert.equal(h.server().state.products[0].retailPrice,85);assert.equal(h.ctx.state.products[0].stock,96);
});
test('server ignoring a write cannot silently remove local product or report success',async()=>{
 const h=harness();h.ctx.state.sync.enabled=false;const row=await h.create();h.ctx.ignorePut=true;
 assert.equal(await h.ctx.masterSync8962.push(true),false);assert(h.ctx.state.products.some(p=>p.id===row.id));
 assert(JSON.parse(h.data.get('db')).products.some(p=>p.id===row.id));
});
test('concurrent price conflict preserves local edit and does not overwrite server',async()=>{
 const h=harness();h.ctx.state.sync.enabled=false;h.edit();h.server().state.products[0].retailPrice=200;
 assert.equal(await h.ctx.masterSync8962.pull(true),false);assert.equal(await h.ctx.masterSync8962.push(true),false);
 assert.equal(h.ctx.state.products[0].retailPrice,85);assert.equal(h.server().state.products[0].retailPrice,200);
});
test('offline edit survives restart before first sync',async()=>{
 const h=harness({baseline:false});h.ctx.state.sync.enabled=false;h.edit();h.ctx.state=JSON.parse(h.data.get('db'));
 assert.equal(await h.ctx.masterSync8962.pull(true),true);assert.equal(h.ctx.state.products[0].retailPrice,85);
 assert.equal(await h.ctx.masterSync8962.push(true),true);assert.equal(h.server().state.products[0].retailPrice,85);
});
test('a tombstone conflict never resurrects a remotely deleted product',async()=>{
 const h=harness();h.ctx.state.sync.enabled=false;h.edit();h.server().state.products=[];h.server().state.deletedProducts={'1':1000};
 assert.equal(await h.ctx.masterSync8962.push(true),false);assert.equal(h.server().state.products.length,0);assert.equal(h.ctx.state.products[0].retailPrice,85);
});
test('storage failure keeps form and old saved price, without false success',()=>{
 const h=harness();h.ctx.state.sync.enabled=false;h.ctx.localStorage.setItem=()=>{throw Error('Disk full')};h.edit();assert.equal(h.ctx.state.products[0].retailPrice,180);assert.match(h.ctx.alert,/не сохранена/);
});
