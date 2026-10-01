const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const C = require('../../app/sync-core-8962');
const { update } = require('../../server/master-protocol-8962');
const source = fs.readFileSync(path.join(__dirname, '../../app/master-sync-8962.js'), 'utf8');

function harness(phase) {
  const device = { id: 'worker-device-0001', name: 'Worker' };
  let store = {revision:10, state:{dealers:[],groups:[{id:1,name:'Group'}],products:[{
    id:100,groupId:1,name:'Product',article:'A',buyPrice:100,retailPrice:140,
    wholesalePrice:180,unit:'м',photo:'old',archived:false,stock:50
  }],ops:[]},computers:{masterId:'master-device-0001',devices:{[device.id]:device}}};
  const initial = C.clone(store.state);
  const data = new Map([
    ['uchet_device_8962',JSON.stringify(device)],
    ['uchet_sync_baseline_8962:https://example.test',JSON.stringify({state:initial,revision:10})]
  ]);
  const timers = [];
  let release, entered;
  const gate = new Promise(resolve => { release = resolve; });
  const waiting = new Promise(resolve => { entered = resolve; });
  let gated = false;
  const response = () => ({...C.clone(store),ok:true,protocol:2,storage:'turso'});
  const ctx = {
    window:{SyncCore8962:C},state:C.clone(initial),KEY:'local',
    localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},
    document:{getElementById:()=>null,createElement:()=>({}),querySelector:()=>null},
    setTimeout:fn=>{timers.push(fn);return timers.length;},render:()=>{},norm:x=>x,
    syncCfg:()=>({url:'https://example.test',enabled:true}),
    syncRequest:async(method,body)=>{
      if (!gated && method===phase) { gated=true; entered(); await gate; }
      if(method==='PUT')store=update(store,body);
      return response();
    }
  };
  vm.createContext(ctx);
  vm.runInContext(source,ctx);
  timers.length=0; // discard startup pull
  return {ctx,data,timers,waiting,release,server:()=>store};
}

const edits = {
  retailPrice:200,wholesalePrice:190,buyPrice:110,name:'Updated product',
  article:'B',groupId:2,unit:'шт',photo:'new-photo',archived:true,
  initialStock:60,extraInfo:'New info',updatedAt:'New date'
};
for(const phase of ['GET','PUT']) {
  for(const [field,value] of Object.entries(edits)) {
    test(`retains ${field} edited during ${phase} and sends it to another computer`,async()=>{
      const h=harness(phase);
      h.ctx.state.products[0].retailPrice=180;
      const syncing=h.ctx.window.masterSync8962.push(false);
      await h.waiting;
      h.ctx.state.products[0][field]=value;
      h.data.set('local',JSON.stringify(h.ctx.state));
      h.release();
      assert.equal(await syncing,true);
      assert.equal(h.ctx.state.products[0][field],value);
      assert.equal(JSON.parse(h.data.get('local')).products[0][field],value);
      assert.notEqual(h.server().state.products[0][field],value);
      assert.equal(h.timers.length,1,'retained edits must schedule another push');
      await h.timers.shift()();
      assert.equal(h.server().state.products[0][field],value);
      assert.equal(h.ctx.state.products[0][field],value);
      // A second computer pulls the exact real server snapshot.
      const other=harness('NONE');
      other.ctx.syncRequest=async()=>({...C.clone(h.server()),ok:true,protocol:2,storage:'turso'});
      assert.equal(await other.ctx.window.masterSync8962.pull(false),true);
      assert.equal(other.ctx.state.products[0][field],value);
    });
  }
}
