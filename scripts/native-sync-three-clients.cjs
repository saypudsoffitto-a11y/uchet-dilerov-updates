// Real renderer + preload + HTTP IPC, isolated profiles and fictional data only.
'use strict';
const {app,BrowserWindow,session}=require('electron');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const C=require('../app/sync-core-8962'),{update}=require('../server/master-protocol-8962');
const output=path.resolve(process.env.UCHET_QA_DIR||'qa-sync-probe/native-three');
fs.mkdirSync(output,{recursive:true});app.setPath('userData',path.join(output,'profile'));
const fixture={dealers:[{id:1,name:'Тестовый дилер',phone:'79990000001'}],groups:[{id:1,name:'Тестовая группа'}],products:[{id:1,groupId:1,name:'Тестовый товар',article:'QA',unit:'шт',buyPrice:70,retailPrice:120,wholesalePrice:120,stock:100,inventoryVersion:2,warehouseOpening:100,catalogRev:1}],ops:[]};
let store={revision:10,state:C.clone(fixture),computers:{masterId:'qa-owner-00000001',devices:{}}};
const offline=new Set(),lostAck=new Set(),events=[],errors=[],getRequests=[],clientStarts=[];
const generations=new Map();
const responseSnapshot=()=>({...store,ok:true,protocol:2,storage:'turso',inventoryProtocol:2,productRevisions:true,permanentDeletionProtocol:1,serverVersion:'native-conditional-fixture'});
const server=http.createServer(async(req,res)=>{
 const token=String(req.headers.authorization||'').replace('Bearer ','');
 if(!/^qa-pc[123]$/.test(token)){res.writeHead(401);res.end('{}');return;}
 const requestUrl=new URL(req.url,'http://127.0.0.1');
 const knownValues=requestUrl.searchParams.getAll('knownRevision');
 const known=knownValues.length===1&&/^(0|[1-9][0-9]*)$/.test(knownValues[0])&&Number.isSafeInteger(Number(knownValues[0]))?Number(knownValues[0]):null;
 function respond(status,payload,responseType){
  const json=JSON.stringify(payload);
  if(req.method==='GET')getRequests.push({pc:token,generation:generations.get(token),url:req.url,knownRevision:knownValues.length?knownValues:null,status,responseType,revision:store.revision,hasState:Object.hasOwn(payload,'state'),bytes:Buffer.byteLength(json),fullEquivalentBytes:Buffer.byteLength(JSON.stringify(responseSnapshot()))});
  res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(json);
 }
 if(requestUrl.pathname!=='/api/state'){respond(404,{ok:false,message:'Unknown fixture route'},'not-found');return;}
 if(offline.has(token)){respond(503,{ok:false,message:'QA offline'},'unavailable');return;}
 let body='';for await(const chunk of req)body+=chunk;
 try{
  if(req.method==='PUT'){
   const payload=JSON.parse(body);
   if(payload.baseRevision!==store.revision){respond(409,{...responseSnapshot(),ok:false,conflict:true},'conflict');return;}
   store=update(store,payload);store.revision++;
   events.push({pc:token,action:payload.action,revision:store.revision,operations:store.state.ops.length,productChanges:payload.productChanges});
   assert.deepEqual(store.state.products.map(p=>String(p.id)),['1'],'Unexpected non-fixture catalog write: '+JSON.stringify(payload.productChanges));
   if(lostAck.has(token)){req.socket.destroy();return;}
  }
  const snapshot=responseSnapshot();
  if(req.method==='GET'&&known===store.revision){
   const {state,...metadata}=snapshot;
   respond(200,{...metadata,notModified:true},'conditional');
  }else respond(200,snapshot,'full');
 }catch(error){events.push({error:String(error),body});respond(400,{ok:false,message:error.message},'error');}
});
app.on('browser-window-created',(_e,win)=>win.webContents.on('preload-error',(_e,_p,error)=>errors.push(String(error))));
app.whenReady().then(()=>session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(request,done)=>done({cancel:!request.url.startsWith('http://127.0.0.1:')})));
require('../app/main-8948');
require('./isolate-native-fixtures.cjs')();
app.removeAllListeners('window-all-closed');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitUntil(check,timeoutMs=10000,stepMs=100){
 const started=Date.now();
 while(Date.now()-started<timeoutMs){if(await check())return true;await pause(stepMs);}
 return false;
}
const evaluate=(win,code)=>win.webContents.executeJavaScript(code);
const progress=message=>{events.push({check:message});console.log(message)};
(async()=>{
 await app.whenReady();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port;
 async function client(index,initial){
  const pc='qa-pc'+index,generation=(generations.get(pc)||0)+1;generations.set(pc,generation);
  clientStarts.push({pc,generation});
  const win=new BrowserWindow({show:false,width:1400,height:900,webPreferences:{partition:'persist:sync-pc'+index,preload:path.resolve('app/preload.js'),contextIsolation:true,nodeIntegration:false}});
  win.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(request,done)=>done({cancel:!request.url.startsWith(url+'/')}));
  await win.loadFile(path.resolve('app/index.html'));await pause(700);
  await evaluate(win,'newmatrosAPI.setWatch(false)');
  await evaluate(win,`window.__pinLock8948.isConfigured()?window.__pinLock8948.unlock('1234'):window.__pinLock8948.setInitialPin('1234')`);
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
  assert.deepEqual(store.state.products.map(p=>String(p.id)),['1']);
  for(const win of clients){assert.deepEqual(await evaluate(win,'state.products.map(p=>String(p.id))'),['1'],'Non-fixture products leaked into isolated renderer');const value=await evaluate(win,'({debt:debtOf(1),ids:state.ops.map(o=>o.id),status:document.getElementById("syncStatus").dataset.syncState})');assert.equal(value.debt,debt);assert.equal(new Set(value.ids).size,value.ids.length);assert.equal(value.status,'online');}
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
 await evaluate(clients[0],`selectPayDealer(1);payAmount.value='5';payMethod.value='Наличные';makePayment();`);
 // Hidden Windows renderers throttle timers during long CI runs. Drive the
 // existing sync API explicitly and still require the server commit before restart.
 const lostAckReachedServer=await waitUntil(async()=>{if(store.state.ops.length===4)return true;await evaluate(clients[0],'window.masterSync8962.push(false)');return store.state.ops.length===4;},10000,100);
 const lostAckClient=await evaluate(clients[0],`({debt:debtOf(1),status:document.getElementById('syncStatus').textContent,pending:!!window.masterSync8962})`);
 assert.equal(lostAckReachedServer,true,'Lost-ack payment never reached server within 10s: '+JSON.stringify({ops:store.state.ops.length,client:lostAckClient,events:events.slice(-8)}));
 await restartAll();lostAck.clear();await converge(80);
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

 // Drive the public renderer sync API through the unchanged preload and real
 // main-process IPC. The fixture inspects the URL actually received over HTTP.
 const manualStart=getRequests.length;
 assert.equal(await waitUntil(()=>evaluate(clients[0],'window.masterSync8962.pull(true)')),true);
 const manualReads=getRequests.slice(manualStart).filter(request=>request.pc==='qa-pc1'&&request.status===200);
 assert.ok(manualReads.some(request=>request.responseType==='full'&&request.knownRevision===null),'Manual refresh must request a full snapshot');
 const idleStart=getRequests.length,idleRevision=store.revision,idleWrites=events.filter(event=>event.action).length;
 for(let poll=0;poll<10;poll++)for(const win of clients){
  assert.equal(await waitUntil(()=>evaluate(win,'window.masterSync8962.pull(false)')),true,'Native idle poll failed');
 }
 const idleReads=getRequests.slice(idleStart).filter(request=>request.status===200);
 assert.equal(store.revision,idleRevision,'Idle conditional reads changed server revision');
 assert.equal(events.filter(event=>event.action).length,idleWrites,'Idle reads unexpectedly wrote state');
 const trafficByClient={};
 for(let index=1;index<=3;index++){
  const pc='qa-pc'+index,reads=idleReads.filter(request=>request.pc===pc);
  assert.ok(reads.length>=10,pc+' did not complete ten real HTTP polls');
  for(const read of reads){
   assert.equal(read.responseType,'conditional',pc+' idle poll downloaded the full state: '+read.url);
   assert.deepEqual(read.knownRevision,[String(idleRevision)],pc+' knownRevision did not reach the HTTP URL');
   assert.equal(read.hasState,false,pc+' conditional response included state');
   assert.ok(read.bytes<read.fullEquivalentBytes,pc+' conditional response saved no bytes');
  }
  const bytes=reads.reduce((sum,read)=>sum+read.bytes,0),fullEquivalentBytes=reads.reduce((sum,read)=>sum+read.fullEquivalentBytes,0);
  const allReads=getRequests.filter(request=>request.pc===pc);
  trafficByClient[pc]={totalGets:allReads.length,fullResponses:allReads.filter(read=>read.responseType==='full').length,
   conditionalResponses:allReads.filter(read=>read.responseType==='conditional').length,responseBytes:allReads.reduce((sum,read)=>sum+read.bytes,0),
   idle:{polls:reads.length,bytes,fullEquivalentBytes,savedBytes:fullEquivalentBytes-bytes}};
  assert.equal(await evaluate(clients[index-1],'debtOf(1)'),77,pc+' conditional read altered financial data');
 }
 for(const start of clientStarts){
  const firstRead=getRequests.find(read=>read.pc===start.pc&&read.generation===start.generation);
  assert.ok(firstRead,'Missing startup HTTP read for '+JSON.stringify(start));
  assert.equal(firstRead.knownRevision,null,'Startup must validate persisted baseline with a full HTTP request: '+JSON.stringify(firstRead));
  if(firstRead.status===200)assert.equal(firstRead.hasState,true,'Startup read omitted state');
 }
 progress('Ten idle native polls per client used knownRevision in HTTP URLs, omitted state and reduced bytes; startup and manual refresh stayed full');

 for(let i=0;i<clients.length;i++){
  await evaluate(clients[i],`document.querySelector('nav button[data-section=home]').click();`);
  fs.writeFileSync(path.join(output,'pc'+(i+1)+'.png'),(await clients[i].webContents.capturePage()).toPNG());
 }
 for(const theme of ['standard','colorful','multicolor','dark']){
  await evaluate(clients[0],`(()=>{document.querySelector('nav button[data-section=settings]').click();const select=document.getElementById('uiThemeSelect');if(!select)throw Error('Theme selector missing');select.value=${JSON.stringify(theme)};select.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('nav button[data-section=home]').click();document.querySelector('.statusPill').textContent='Предпросмотр SOFFITTO';})()`);
  await pause(100);
  const icons=await evaluate(clients[0],`[...document.querySelectorAll('.soffittoMetricIcon')].map(el=>({svg:!!el.querySelector('svg'),width:el.getBoundingClientRect().width,visible:getComputedStyle(el).display!=='none'}))`);
  assert.equal(icons.length,4);assert.ok(icons.every(icon=>icon.svg&&icon.visible&&icon.width>=30),'Summary icons must remain visible in '+theme);
  fs.writeFileSync(path.join(output,'appearance-'+theme+'.png'),(await clients[0].webContents.capturePage()).toPNG());
 }
 fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({ok:true,clientCount:3,realComputers:false,operations:store.state.ops.length,debt:77,trafficByClient,getRequests,events,errors},null,2));
 assert.deepEqual(errors,[]);server.close();app.exit(0);
})().catch(error=>{fs.writeFileSync(path.join(output,'failure.txt'),String(error.stack));fs.writeFileSync(path.join(output,'failure-traffic.json'),JSON.stringify({getRequests,events,errors},null,2));console.error(error);server.close();app.exit(1)});
