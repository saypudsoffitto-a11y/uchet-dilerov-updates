'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'), os=require('node:os'), path=require('node:path');
const {spawn}=require('node:child_process');
const M=require('./mobile-api'), {createStore}=require('./store');
const initial=()=>({revision:0,computers:{masterId:'main-device-00000001',devices:{}},state:{dealers:[{id:1,name:'Тестовый дилер',phone:'+79991234567'}],products:[],ops:[{id:2,dealerId:1,type:'initial_debt',total:1000}],groups:[]}});
const payment=(extra={})=>({requestId:'request-payment-0001',action:'payment',dealerId:1,amountKopecks:12345,method:'Наличные',note:'',...extra});
test('payment uses desktop schema and retry never charges twice, even after deletion',()=>{
 const one=M.apply(initial(),payment()); assert.equal(one.next.state.ops.length,2);
 assert.equal(one.next.state.ops[1].total,123.45);assert.equal(M.balance(one.next.state,1),87655);
 assert.equal(M.apply(one.next,payment()).replay,true);
 one.next.state.ops.pop();assert.equal(M.apply(one.next,payment()).replay,true);
 assert.throws(()=>M.apply(one.next,payment({amountKopecks:999})),/уже использован/);
});
test('invalid amounts, unknown dealers and blank phone are rejected',()=>{
 for(const n of [0,-1,NaN,Infinity,1.1,'100',100000000001])assert.throws(()=>M.apply(initial(),payment({amountKopecks:n})));
 assert.throws(()=>M.apply(initial(),payment({dealerId:999})),/Дилер/);
 assert.throws(()=>M.apply(initial(),{requestId:'request-dealer-000001',action:'dealer',name:'Имя',phone:''}),/Телефон/);
});
test('phone dedupe, numeric IDs, alias payments, catalog omission guard',()=>{
 const dealer={requestId:'request-dealer-000001',action:'dealer',name:'Новый',phone:'8 999 000 11 22'};
 const result=M.apply(initial(),dealer), d=result.next.state.dealers.at(-1);
 assert.ok(Number.isSafeInteger(d.id)); assert.equal(d.phone,'+79990001122');
 assert.throws(()=>M.apply(result.next,{...dealer,requestId:'request-dealer-000002',phone:'+7 (999) 000-11-22'}),/уже есть/);
 assert.throws(()=>M.protectCatalog(result.next,{catalog:{dealers:initial().state.dealers}}),/свежую базу/);
 assert.doesNotThrow(()=>M.protectCatalog(result.next,{catalog:{dealers:result.next.state.dealers}}));
 result.next.state.dealerAliases={88:1};const pay=M.apply(result.next,payment({dealerId:88}));assert.equal(pay.next.state.ops.at(-1).dealerId,1);
});
test('file store compare-and-swap admits exactly one simultaneous writer',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mobile-cas-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const store=createStore({dataFile:path.join(dir,'state.json')});
 const results=await Promise.all(Array.from({length:20},(_,n)=>store.writeIfRevision(0,{state:{n}})));
 assert.equal(results.filter(r=>r.ok).length,1);assert.equal((await store.read()).revision,1);
});
test('HTTP mobile flow shares desktop state, concurrent payments survive, mobile key cannot read sync secrets',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mobile-http-'));fs.writeFileSync(path.join(dir,'state.json'),JSON.stringify(initial()));
 const net=require('node:net'), probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 const server=spawn(process.execPath,['server.js'],{cwd:__dirname,env:{...process.env,HOST:'127.0.0.1',PORT:String(port),DATA_DIR:dir,SYNC_TOKEN:'desktop-secret',MOBILE_TOKEN:'mobile-secret',TURSO_DATABASE_URL:'',TURSO_AUTH_TOKEN:''},stdio:'ignore'});
 t.after(async()=>{server.kill();await new Promise(r=>server.once('exit',r));fs.rmSync(dir,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+port;
 for(let n=0;n<80;n++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,30));}
 const api=async(route,body,key='mobile-secret')=>{const r=await fetch(base+route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};};
 assert.equal((await api('/api/mobile/snapshot',null,'wrong')).status,401);
 assert.equal((await api('/api/state')).status,401);
 assert.equal((await api('/api/mobile/snapshot')).data.dealers.length,1);
 const outcomes=await Promise.all(Array.from({length:6},(_,n)=>api('/api/mobile/commands',payment({requestId:'concurrent-payment-'+n}))));
 assert.ok(outcomes.every(r=>r.status===200),JSON.stringify(outcomes));
 const retry=await api('/api/mobile/commands',payment({requestId:'concurrent-payment-0'}));assert.equal(retry.data.replay,true);
 const desktop=await api('/api/state',null,'desktop-secret');assert.equal(desktop.data.state.ops.length,7);
 assert.equal(M.balance(desktop.data.state,1),100000-6*12345);
 const html=await fetch(base+'/mobile/');assert.equal(html.status,200);assert.match(html.headers.get('content-security-policy'),/frame-ancestors 'none'/);
 assert.equal((await fetch(base+'/mobile/..%2fstore.js')).status,404);
});
