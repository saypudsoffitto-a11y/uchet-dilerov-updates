'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const C=require('../../app/sync-core-8962'),P=require('../../app/catalog-pending-8972'),protocol=require('../../server/master-protocol-8962');
const code=fs.readFileSync(path.join(__dirname,'../../app/master-sync-8962.js'),'utf8');
function setup(){
 let server={revision:1,state:{products:[{id:1,name:'BAUF',retailPrice:180,wholesalePrice:170,stock:100}],groups:[],dealers:[{id:1,name:'Дилер'}],ops:[]},computers:{masterId:'computer-00000001',devices:{}}};
 let writes=0;
 const clients=[1,2,3].map(n=>{
  const device={id:'computer-0000000'+n,name:'Компьютер '+n},storage=new Map();
  const s={state:{...C.clone(server.state),sync:{enabled:true,url:'https://test.invalid'}},KEY:'db',SyncCore8962:C,CatalogPending8972:P,document:{getElementById:()=>null},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},setTimeout(){},render(){},norm:x=>x};s.window=s;s.syncCfg=()=>s.state.sync;
  storage.set('uchet_device_8962',JSON.stringify(device));storage.set('uchet_sync_baseline_8962:https://test.invalid',JSON.stringify({state:C.clone(server.state),revision:1}));
  s.syncRequest=async(method,body)=>{
   if(method==='PUT'){
    writes++;if(s.failWrite)throw Error('offline');
    if(body.baseRevision!==server.revision)return {...C.clone(server),ok:false,conflict:true,protocol:2,storage:'turso'};
    server=protocol.update(server,body);server.revision++;
    if(s.loseAck){s.loseAck=false;throw Error('ack lost');}
   }
   return {...C.clone(server),ok:true,protocol:2,storage:'turso'};
  };
  vm.createContext(s);vm.runInContext(code,s);return s;
 });
 const edit=(s,price)=>{const before=C.clone(s.state.products[0]);s.state.products[0].retailPrice=price;s.state.products[0].updatedAt=Date.now();P.record(s.state,before,s.state.products[0]);};
 return {clients,edit,server:()=>server,writes:()=>writes};
}
test('PC2 failed price upload automatically retries on poll and reaches PC1 and PC3',async()=>{
 const h=setup(),[a,b,c]=h.clients;h.edit(b,220);b.failWrite=true;assert.equal(await b.masterSync8962.push(false),false);
 b.failWrite=false;assert.equal(await b.masterSync8962.pull(false),true);
 await a.masterSync8962.pull(false);await c.masterSync8962.pull(false);
 for(const s of h.clients)assert.equal(s.state.products[0].retailPrice,220);
 assert.equal(h.server().state.products[0].stock,100);
 h.edit(c,240);await c.masterSync8962.pull(false);await a.masterSync8962.pull(false);await b.masterSync8962.pull(false);
 for(const s of h.clients)assert.equal(s.state.products[0].retailPrice,240);
 const count=h.writes();await a.masterSync8962.pull(false);await b.masterSync8962.pull(false);await c.masterSync8962.pull(false);assert.equal(h.writes(),count,'unchanged polls must not write');
});
test('lost acknowledgement retries a payment without doubling payment or debt',async()=>{
 const h=setup(),b=h.clients[1];b.state.ops.push({id:25,dealerId:1,type:'payment',total:125});b.loseAck=true;
 assert.equal(await b.masterSync8962.push(false),false);await b.masterSync8962.pull(false);
 assert.equal(h.server().state.ops.length,1);assert.equal(b.state.ops.length,1);assert.equal(b.state.ops[0].total,125);
});
test('disabled auto sync and manual download do not unexpectedly upload pending prices',async()=>{
 const h=setup(),b=h.clients[1];h.edit(b,220);b.state.sync.enabled=false;await b.masterSync8962.pull(false);assert.equal(h.writes(),0);
 b.state.sync.enabled=true;await b.masterSync8962.pull(true);assert.equal(h.writes(),0);assert.equal(b.state.products[0].retailPrice,220);
});
test('simultaneous price conflict retains both values and does not overwrite remote',async()=>{
 const h=setup(),[a,b]=h.clients;h.edit(a,200);h.edit(b,220);await a.masterSync8962.push(false);
 assert.equal(await b.masterSync8962.pull(false),false);assert.equal(h.server().state.products[0].retailPrice,200);assert.equal(b.state.products[0].retailPrice,220);
});
