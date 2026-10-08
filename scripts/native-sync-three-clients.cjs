// Real renderer + preload + HTTP IPC, isolated profiles and fictional data only.
'use strict';
const {app,BrowserWindow,session}=require('electron');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const C=require('../app/sync-core-8962'),{update}=require('../server/master-protocol-8962');
const output=path.resolve(process.env.UCHET_QA_DIR||'qa-sync-probe/native-three');
fs.mkdirSync(output,{recursive:true});app.setPath('userData',path.join(output,'profile'));
const fixture={dealers:[{id:1,name:'Тестовый дилер',phone:'79990000001'}],groups:[{id:1,name:'Тестовая группа'}],products:[{id:1,groupId:1,name:'Тестовый товар',article:'QA',unit:'шт',buyPrice:70,retailPrice:120,wholesalePrice:120,stock:100,inventoryVersion:2,warehouseOpening:100,catalogRev:1}],ops:[]};
let store={revision:10,state:C.clone(fixture),computers:{masterId:'qa-owner-00000001',devices:{}}};
const offline=new Set(),lostAck=new Set(),events=[],errors=[];
const server=http.createServer(async(req,res)=>{
 const token=String(req.headers.authorization||'').replace('Bearer ','');
 if(!/^qa-pc[123]$/.test(token)){res.writeHead(401);res.end('{}');return;}
 if(offline.has(token)){res.writeHead(503);res.end(JSON.stringify({message:'QA offline'}));return;}
 let body='';for await(const chunk of req)body+=chunk;
 try{
  if(req.method==='PUT'){
   const payload=JSON.parse(body);
   if(payload.baseRevision!==store.revision){res.writeHead(409);res.end(JSON.stringify({revision:store.revision}));return;}
   store=update(store,payload);store.revision++;
   events.push({pc:token,action:payload.action,revision:store.revision,operations:store.state.ops.length});
   if(lostAck.has(token)){req.socket.destroy();return;}
  }
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({...store,ok:true,protocol:2,storage:'turso',inventoryProtocol:2,productRevisions:true,serverVersion:'8.9.79-sync6'}));
 }catch(error){res.writeHead(400);res.end(JSON.stringify({message:error.message}));}
});
app.on('browser-window-created',(_e,win)=>win.webContents.on('preload-error',(_e,_p,error)=>errors.push(String(error))));
app.whenReady().then(()=>session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(request,done)=>done({cancel:!request.url.startsWith('http://127.0.0.1:')})));
require('../app/main-8948');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const evaluate=(win,code)=>win.webContents.executeJavaScript(code);
const progress=message=>{events.push({check:message});console.log(message)};
(async()=>{
 await app.whenReady();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port;
 async function client(index,initial){
  const win=new BrowserWindow({show:false,width:1400,height:900,webPreferences:{partition:'persist:sync-pc'+index,preload:path.resolve('app/preload.js'),contextIsolation:true,nodeIntegration:false}});
  win.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(request,done)=>done({cancel:!request.url.startsWith(url+'/')}));
  await win.loadFile(path.resolve('app/index.html'));await pause(700);
  if(initial)await evaluate(win,`state=norm(${JSON.stringify(fixture)});state.sync={url:${JSON.stringify(url)},token:'qa-pc${index}',enabled:true,interval:3,revision:0};render();localStorage.setItem(KEY,JSON.stringify(state));window.masterSync8962.markSaved();`);
  return win;
 }
 let clients=await Promise.all([1,2,3].map(i=>client(i,true)));
 async function converge(debt){
  for(let round=0;round<2;round++)for(const win of clients){
   let received=false;
   for(let attempt=0;attempt<20&&!received;attempt++){received=await evaluate(win,'window.masterSync8962.pull(false)');if(!received)await pause(200);}
   assert.equal(received,true,await evaluate(win,'document.getElementById("syncStatus").textContent'));await pause(450);
  }
  for(const win of clients){const value=await evaluate(win,'({debt:debtOf(1),ids:state.ops.map(o=>o.id),status:document.getElementById("syncStatus").dataset.syncState})');assert.equal(value.debt,debt);assert.equal(new Set(value.ids).size,value.ids.length);assert.equal(value.status,'online');}
 }
 await converge(0);
 await evaluate(clients[0],`selectSaleDealer(1);cart=[{productId:1,name:'Тестовый товар',qty:1,price:120,buyPrice:70,total:120,profit:50,unit:'шт'}];saveSale();`);
 await pause(1100);assert.equal(store.state.ops.length,1);await converge(120);progress('Receipt created through saveSale on PC1 arrived on all three native clients');
 await evaluate(clients[1],`selectPayDealer(1);payAmount.value='25';payMethod.value='Наличные';makePayment();`);
 await pause(1100);assert.equal(store.state.ops.length,2);await converge(95);progress('Payment through makePayment on PC2 arrived everywhere; debt = 95');
 async function restartAll(){
  for(const win of clients){await win.webContents.session.flushStorageData();win.destroy();}
  clients=await Promise.all([1,2,3].map(i=>client(i,false)));
 }
 await restartAll();await converge(95);progress('All three profiles reopened with the same receipt, payment and debt');
 offline.add('qa-pc3');
 await evaluate(clients[2],`selectPayDealer(1);payAmount.value='10';payMethod.value='Наличные';makePayment();`);await pause(1100);
 assert.equal(await evaluate(clients[2],'debtOf(1)'),85);
 await restartAll();assert.equal(await evaluate(clients[2],'debtOf(1)'),85);
 offline.clear();await converge(85);progress('Offline payment survived restart and was delivered exactly once');
 lostAck.add('qa-pc1');
 await evaluate(clients[0],`selectPayDealer(1);payAmount.value='5';payMethod.value='Наличные';makePayment();`);await pause(1400);
 assert.equal(store.state.ops.length,4);await restartAll();lostAck.clear();await converge(80);
 assert.equal(store.state.ops.length,4);progress('Lost PUT acknowledgement followed by restart created no duplicate; debt = 80');

 // 8.9.88 regression: one PC has a stale local financial edit while the server
 // already contains a different edit of the same payment. The stale edit must
 // be quarantined and every client must converge to the server total.
 const target=store.state.ops.find(op=>op.type==='payment'&&Number(op.total)===25);
 assert.ok(target,'QA payment for convergence scenario is missing');
 const targetId=String(target.id);
 await evaluate(clients[2],`(()=>{const op=state.ops.find(x=>String(x.id)===${JSON.stringify(targetId)});op.total=30;localStorage.setItem(KEY,JSON.stringify(state));render();return debtOf(1)})()`);
 const serverTarget=store.state.ops.find(op=>String(op.id)===targetId);
 serverTarget.total=28;store.revision++;
 await converge(77);
 const conflictSaved=await evaluate(clients[2],`!!localStorage.getItem('uchet_operation_conflicts_8988:'+state.sync.url)`);
 assert.equal(conflictSaved,true);
 progress('Conflicting stale payment was quarantined; all three clients converged to server debt = 77');

 for(let i=0;i<clients.length;i++)fs.writeFileSync(path.join(output,'pc'+(i+1)+'.png'),(await clients[i].webContents.capturePage()).toPNG());
 fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({ok:true,clientCount:3,realComputers:false,operations:store.state.ops.length,debt:77,events,errors},null,2));
 assert.deepEqual(errors,[]);server.close();app.exit(0);
})().catch(error=>{fs.writeFileSync(path.join(output,'failure.txt'),String(error.stack));console.error(error);server.close();app.exit(1)});
