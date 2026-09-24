'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const C=require('../../app/sync-core-8962');
const source=fs.readFileSync(require.resolve('../../app/master-sync-8962'),'utf8');
function harness(local,remote,onBackup){
 const data=new Map(),calls=[];
 const s={state:C.clone(local),KEY:'data',crypto:require('node:crypto'),console,setTimeout,clearTimeout,
  localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},
  document:{getElementById:()=>null,querySelector:()=>null,createElement:()=>({})},
  syncCfg:()=>s.state.sync,norm:x=>x,render:()=>{},go:()=>{},
  syncRequest:async(method)=>{calls.push(method);return {ok:true,protocol:2,storage:'turso',revision:1,state:C.clone(remote),computers:{masterId:'master',devices:{}}}},
  updateAPI:{saveBackup:async()=>{if(onBackup)onBackup(s);return {ok:true}}},SyncCore8962:C,CatalogPending8972:require('../../app/catalog-pending-8972')};
 s.window=s;vm.createContext(s);vm.runInContext(source,s);return {s,data,calls};
}
const base=()=>({dealers:[{id:1,name:'A'}],products:[],ops:[],sync:{url:'https://test.invalid',enabled:false}});

test('first worker connection mirrors master exactly and quarantines old local payment',async()=>{
 const local=base();local.ops=[{id:1,ts:1,type:'payment',dealerId:1,total:125}];
 const remote=base();remote.ops=[{id:10,ts:10,type:'sale',dealerId:1,total:300,items:[]}];
 const {s,data,calls}=harness(local,remote);
 assert.equal(await s.masterSync8962.pull(true),true);
 assert.equal(s.state.ops.some(o=>o.id===1),false);
 assert.equal(s.state.ops.some(o=>o.id===10&&o.total===300),true);
 assert.deepEqual(calls,['GET','PUT']);
 const recovery=JSON.parse(data.get('uchet_before_master_8962:https://test.invalid'));
 assert.equal(recovery.ops[0].total,125);
 assert.equal(data.has('uchet_sync_baseline_8962:https://test.invalid'),true);
});

test('payment entered while backup is saving is kept in recovery but cannot alter master debt',async()=>{
 const remote=base();remote.ops=[{id:10,ts:10,type:'sale',dealerId:1,total:300,items:[]}];
 const {s,data}=harness(base(),remote,s=>s.state.ops.push({id:2,ts:2,type:'payment',dealerId:1,total:75}));
 assert.equal(await s.masterSync8962.pull(true),true);
 assert.equal(s.state.ops.some(o=>o.id===2),false);
 assert.equal(s.state.ops.some(o=>o.id===10&&o.total===300),true);
 const recovery=JSON.parse(data.get('uchet_before_master_8962:https://test.invalid'));
 assert.equal(recovery.ops.some(o=>o.id===2&&o.total===75),true);
});

test('same operation copied under another id stays only in recovery on first join',async()=>{
 const remote=base();remote.ops=[{id:10,ts:10,type:'payment',date:'21.09.2026',dealerId:1,dealer:'A',total:125,method:'Наличные',note:''}];
 const local=base();local.ops=[{...remote.ops[0],id:99}];
 const {s,data}=harness(local,remote);
 assert.equal(await s.masterSync8962.pull(true),true);
 assert.equal(s.state.ops.length,1);
 assert.equal(s.state.ops[0].id,10);
 assert.equal(JSON.parse(data.get('uchet_before_master_8962:https://test.invalid')).ops[0].id,99);
});

test('same operation id with different local content cannot override master on first join',async()=>{
 const remote=base();remote.ops=[{id:1,ts:1,type:'payment',dealerId:1,total:100}];
 const local=base();local.ops=[{id:1,ts:1,type:'payment',dealerId:1,total:125}];
 const {s,data,calls}=harness(local,remote);
 assert.equal(await s.masterSync8962.pull(true),true);
 assert.equal(s.state.ops[0].total,100);
 assert.deepEqual(calls,['GET','PUT']);
 assert.equal(JSON.parse(data.get('uchet_before_master_8962:https://test.invalid')).ops[0].total,125);
 assert.equal(data.has('uchet_sync_baseline_8962:https://test.invalid'),true);
});

test('connection with matching operations preserves payment total',async()=>{
 const local=base();local.ops=[{id:1,ts:1,type:'payment',dealerId:1,total:125}];
 const {s}=harness(local,local);assert.equal(await s.masterSync8962.pull(true),true);assert.equal(s.state.ops[0].total,125);
});
