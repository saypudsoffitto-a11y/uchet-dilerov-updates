'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const C=require('../../app/sync-core-8962');
const source=fs.readFileSync(require.resolve('../../app/master-sync-8962'),'utf8');
function harness(local,remote,onBackup){
 const data=new Map(),calls=[];
 const s={state:C.clone(local),KEY:'data',crypto:require('node:crypto'),console,
  localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},
  document:{getElementById:()=>null,querySelector:()=>null,createElement:()=>({})},
  syncCfg:()=>s.state.sync,norm:x=>x,render:()=>{},go:()=>{},
  syncRequest:async(method)=>{calls.push(method);return {ok:true,protocol:2,storage:'turso',revision:1,state:C.clone(remote),computers:{masterId:'master',devices:{}}}},
  updateAPI:{saveBackup:async()=>{if(onBackup)onBackup(s);return {ok:true}}},SyncCore8962:C};
 s.window=s;vm.createContext(s);vm.runInContext(source,s);return {s,data,calls};
}
const base=()=>({dealers:[{id:1,name:'A'}],products:[],ops:[],sync:{url:'https://test.invalid',enabled:false}});
test('first connection never replaces a local payment missing on server',async()=>{
 const local=base();local.ops=[{id:1,type:'payment',dealerId:1,total:125}];const before=C.clone(local);
 const {s,data,calls}=harness(local,base());assert.equal(await s.masterSync8962.pull(true),false);
 assert.deepEqual(s.state,before);assert.deepEqual(calls,['GET']);
 assert.equal(JSON.parse(data.get('uchet_before_master_8962:https://test.invalid')).ops[0].total,125);
 assert.equal(data.has('uchet_sync_baseline_8962:https://test.invalid'),false);
});
test('payment entered while backup is saving also prevents first-join replacement',async()=>{
 const {s}=harness(base(),base(),s=>s.state.ops.push({id:2,type:'payment',dealerId:1,total:75}));
 assert.equal(await s.masterSync8962.pull(true),false);assert.equal(s.state.ops[0].total,75);
});
test('connection with matching operations preserves payment total',async()=>{
 const local=base();local.ops=[{id:1,type:'payment',dealerId:1,total:125}];
 const {s}=harness(local,local);assert.equal(await s.masterSync8962.pull(true),true);assert.equal(s.state.ops[0].total,125);
});
