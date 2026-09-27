const {test}=require('node:test');const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');const http=require('node:http');const {command,debt,createMobileHandler}=require('./mobile-api');
function fixture(){return {revision:1,computers:{masterId:'desktop-master-0001',devices:{}},state:{dealers:[{id:1,name:'Тестовый дилер',phone:'79990000001'}],products:[],groups:[],ops:[{id:2,type:'initial_debt',dealerId:1,total:1000}]}};}
const payment=()=>({kind:'payment',requestId:randomUUID(),dealerId:1,amount:250.35,method:'Наличные',ts:Date.now(),note:'Тест'});
test('payment uses desktop operation schema and reduces shared debt',()=>{const out=command(fixture(),payment());assert.equal(debt(out.next.state,1),749.65);assert.equal(out.next.state.ops.length,2);assert.equal(out.next.state.ops[1].source,'mobile');});
test('retry after lost response does not duplicate payment',()=>{const body=payment(),first=command(fixture(),body),retry=command(first.next,body);assert.equal(retry.duplicate,true);assert.deepEqual(retry.result,first.result);assert.throws(()=>command(first.next,{...body,amount:400}),/уже использован/);});
test('invalid amounts and missing dealer cannot create operations',()=>{for(const amount of [0,-1,NaN,Infinity,1.234,1e10])assert.throws(()=>command(fixture(),{...payment(),amount}));assert.throws(()=>command(fixture(),{...payment(),dealerId:999}));});
test('new dealer is shared and normalized duplicate phone rejected',()=>{const current=fixture(),out=command(current,{kind:'dealer',requestId:randomUUID(),name:'Новый',phone:'8 999 000 00 02',city:'Махачкала'});assert.equal(out.next.state.dealers.length,2);assert.throws(()=>command(out.next,{kind:'dealer',requestId:randomUUID(),name:'Другой',phone:'+7 999 000 00 02'}),/уже есть/);});
test('mobile requests survive later desktop updates',()=>{const out=command(fixture(),payment());const next=require('./master-protocol-8962').update(out.next,{protocol:2,action:'changes',device:{id:'desktop-master-0001',name:'ПК'},changes:[]});assert.deepEqual(next.mobileRequests,out.next.mobileRequests);});
test('HTTP authentication, origin, CAS retries and command confirmation',async t=>{
 let current=fixture(),conflict=true;const origin='https://example.test';
 const handler=createMobileHandler({password:'long-test-password-123',origin,readStore:async()=>structuredClone(current),writeStore:async(rev,next)=>{if(conflict){conflict=false;current.revision++;return {conflict:true};}assert.equal(rev,current.revision);current={...next,revision:rev+1};return {ok:true,revision:current.revision};}});
 const server=http.createServer((req,res)=>handler(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const base='http://127.0.0.1:'+server.address().port;
 let r=await fetch(base+'/mobile/api/summary');assert.equal(r.status,401);
 r=await fetch(base+'/mobile/api/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({password:'long-test-password-123'})});assert.equal(r.status,200);const cookie=r.headers.get('set-cookie').split(';')[0];assert.match(r.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
 const body=payment(),headers={'Content-Type':'application/json',Origin:origin,Cookie:cookie};
 r=await fetch(base+'/mobile/api/commands',{method:'POST',headers:{...headers,Origin:'https://evil.test'},body:JSON.stringify(body)});assert.equal(r.status,403);
 for(let i=0;i<2;i++){r=await fetch(base+'/mobile/api/commands',{method:'POST',headers,body:JSON.stringify(body)});assert.equal(r.status,200);assert.equal((await r.json()).ok,true);}
 assert.equal(current.state.ops.length,2);
 r=await fetch(base+'/mobile/api/summary',{headers:{Cookie:cookie}});assert.equal((await r.json()).dealers[0].debt,749.65);
 r=await fetch(base+'/mobile/');assert.equal(r.status,200);assert.match(await r.text(),/Внести оплату/);
});
