'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const C=require('../../app/sync-core-8962');
const H=require('../../app/sync-health-8987');
const source=fs.readFileSync(require.resolve('../../app/master-sync-8962'),'utf8');

function harness({warehouse=false}={}){
  const device={id:'status-device-0001',name:'MacBook'};
  const state={dealers:[{id:1,name:'Локальный дилер'}],products:[],groups:[],ops:[],sync:{url:'https://sync.test',enabled:true}};
  const data=new Map([
    ['uchet_device_8962',JSON.stringify(device)],
    ['data',JSON.stringify(state)],
    ['uchet_sync_baseline_8962:https://sync.test',JSON.stringify({state,revision:1})]
  ]);
  const history=[],status={dataset:{},querySelector:()=>null};
  Object.defineProperty(status,'textContent',{get:()=>status.text||'',set:value=>{status.text=value;history.push({state:status.dataset.syncState,text:value});}});
  let initializing=true,requests=0;
  const response={ok:true,protocol:2,storage:'turso',revision:1,state:C.clone(state),computers:{shared:true,devices:{[device.id]:device}}};
  const ctx={state:C.clone(state),KEY:'data',SyncCore8962:C,SyncHealth8987:H,warehouseInstalled:warehouse,
    localStorage:{getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)},
    document:{getElementById:id=>id==='syncStatus'?status:null},
    render(){},norm:x=>x,syncCfg:()=>ctx.state.sync,
    setTimeout:fn=>{if(!initializing)queueMicrotask(fn);return 1;},
    syncRequest:async()=>{requests++;return C.clone(ctx.response);},response};
  ctx.window=ctx;
  vm.createContext(ctx);vm.runInContext(source,ctx);initializing=false;
  return {ctx,status,history,data,response,requests:()=>requests,pull:()=>ctx.masterSync8962.pull(false)};
}

test('unavailable server stays offline throughout retries and preserves the local database',async()=>{
  const h=harness(),saved=h.data.get('data');
  h.ctx.response={ok:false,status:503,code:'SYNC_SERVER_UNAVAILABLE',message:'Сервер временно недоступен (HTTP 503)'};
  assert.equal(await h.pull(),false);
  assert.equal(h.requests(),3);
  assert.equal(h.status.dataset.syncState,'offline');
  assert.equal(h.history.every(entry=>entry.state==='offline'),true);
  assert.equal(h.data.get('data'),saved);
  assert.match(h.status.textContent,/503/);
});

test('known suspended service is immediately offline without futile immediate retries',async()=>{
  const h=harness();
  assert.equal(await h.pull(),true);
  h.history.length=0;
  const requests=h.requests(),saved=h.data.get('data');
  h.ctx.response={ok:false,status:503,code:'SYNC_SERVICE_SUSPENDED',message:'Сервис Render приостановлен (HTTP 503). Локальные данные сохранены.'};
  assert.equal(await h.pull(),false);
  assert.equal(h.requests()-requests,1);
  assert.equal(h.status.dataset.syncState,'offline');
  assert.equal(h.history.some(entry=>entry.state==='online'||entry.state==='degraded'),false);
  assert.equal(h.data.get('data'),saved);
  assert.match(h.status.textContent,/приостановлен/);
});

test('a transient outage after a confirmed connection is degraded and never green',async()=>{
  const h=harness();
  assert.equal(await h.pull(),true);
  assert.equal(h.status.dataset.syncState,'online');
  h.history.length=0;
  h.ctx.response={ok:false,status:503,message:'Service unavailable'};
  assert.equal(await h.pull(),false);
  assert.equal(h.status.dataset.syncState,'degraded');
  assert.equal(h.history.some(entry=>entry.state==='online'),false);
  assert.equal(await h.pull(),false);
  assert.equal(await h.pull(),false);
  assert.equal(h.status.dataset.syncState,'offline');
  h.ctx.response=h.response;
  assert.equal(await h.pull(),true);
  assert.equal(h.status.dataset.syncState,'online');
});

for(const invalid of [
  {protocol:1},
  {storage:'memory'},
  {serverVersion:'8.9.91',inventoryProtocol:1,productRevisions:false}
])test('incompatible successful response cannot establish connection: '+JSON.stringify(invalid),async()=>{
  const h=harness({warehouse:true}),saved=h.data.get('data');
  h.ctx.response={...h.response,...invalid};
  assert.equal(await h.pull(),false);
  assert.equal(h.status.dataset.syncState,'offline');
  assert.equal(h.data.get('data'),saved);
  assert.equal(h.history.some(entry=>entry.state==='online'),false);
});

test('non-JSON errors clear a previously confirmed connection',async()=>{
  const h=harness();
  assert.equal(await h.pull(),true);
  const saved=h.data.get('data');
  h.history.length=0;
  h.ctx.response={ok:false,message:'Сервер вернул не JSON'};
  assert.equal(await h.pull(),false);
  assert.equal(h.status.dataset.syncState,'offline');
  assert.equal(h.history.some(entry=>entry.state==='online'),false);
  assert.equal(h.data.get('data'),saved);
});

test('incompatible replies do not reset the outage failure streak',async()=>{
  const h=harness();
  assert.equal(await h.pull(),true);
  h.ctx.response={ok:false,status:503,message:'Service unavailable'};
  assert.equal(await h.pull(),false);
  h.ctx.response={...h.response,storage:'memory'};
  assert.equal(await h.pull(),false);
  h.ctx.response={ok:false,status:503,message:'Service unavailable'};
  assert.equal(await h.pull(),false);
  assert.equal(h.status.dataset.syncState,'offline');
});

test('header reflects offline, degraded and recovered status without a false green label',()=>{
  const source=fs.readFileSync(require.resolve('../../app/interface-8945'),'utf8');
  const fragment=source.slice(source.indexOf('  const status=document.getElementById(\'syncStatus\')'),source.indexOf("  const DRAFT_KEY="));
  const status={dataset:{syncState:'degraded'},textContent:'Повторяю подключение',querySelector:()=>null};
  const indicator={dataset:{}};
  let update;
  const ctx={state:{sync:{url:'https://sync.test',enabled:true}},document:{getElementById:id=>id==='syncStatus'?status:indicator},
    MutationObserver:class{constructor(fn){update=fn;}observe(){}}};
  vm.runInNewContext(fragment,ctx);
  update();
  assert.equal(indicator.dataset.status,'degraded');
  assert.equal(indicator.textContent,'Переподключение к серверу…');
  status.dataset.syncState='offline';update();
  assert.equal(indicator.dataset.status,'offline');
  assert.equal(indicator.textContent,'Нет связи с сервером');
  status.dataset.syncState='online';update();
  assert.equal(indicator.dataset.status,'online');
  assert.equal(indicator.textContent,'Сервер подключён');
});
