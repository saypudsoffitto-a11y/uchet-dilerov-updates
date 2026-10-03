// Real renderer + preload + HTTP IPC, isolated profiles and fictional data only.
'use strict';
const {app,BrowserWindow,session}=require('electron');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const C=require('../app/sync-core-8962'),{update}=require('../server/master-protocol-8962');
const output=path.resolve(process.env.UCHET_QA_DIR||'qa-sync-probe/journal-columns');
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
// The QA runner owns shutdown while all three test windows are restarted.
app.removeAllListeners('window-all-closed');
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
  // QA uses only its fixture, without importing files from the host computer.
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
  for(const win of clients){const value=await evaluate(win,'({debt:debtOf(1),ids:state.ops.map(o=>o.id),status:document.getElementById("syncStatus").dataset.syncState})');assert.equal(value.debt,debt);assert.equal(new Set(value.ids).size,value.ids.length);assert.equal(value.status,'online');}
 }
 await converge(0);
 await evaluate(clients[0],`selectSaleDealer(1);cart=[{productId:1,name:'Тестовый товар',qty:1,price:120,buyPrice:70,total:120,profit:50,unit:'шт'}];saveSale();`);
 await pause(1100);assert.equal(store.state.ops.length,1);await converge(120);progress('Receipt created through saveSale on PC1 arrived on all three native clients');

 const receiptId=store.state.ops.find(o=>o.type==='sale').id;
 assert.equal(store.state.ops[0].journalStatus,undefined);
 await evaluate(clients[0],`go('debts');openDealer(1);document.querySelector('[data-op-id="${receiptId}"]').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:700,clientY:400}));`);
 assert.deepEqual(await evaluate(clients[0],`[...document.querySelectorAll('#finalContextMenu button')].map(b=>b.textContent).filter(s=>s.includes('журнал'))`),['Внесено в журнал','Не внесено в журнал']);
 await evaluate(clients[0],`[...document.querySelectorAll('#finalContextMenu button')].find(b=>b.textContent==='Не внесено в журнал').click()`);
 await pause(1000);await converge(120);
 for(const win of clients)assert.equal(await evaluate(win,`state.ops.find(o=>o.type==='sale').journalStatus`),'unrecorded');
 assert.equal(await evaluate(clients[0],`getComputedStyle(document.querySelector('[data-op-id="${receiptId}"]')).backgroundColor`),'rgb(246, 216, 221)');
 await evaluate(clients[1],`window.receiptJournal.set(${receiptId},'recorded')`);await pause(1000);await converge(120);
 for(const win of clients)assert.equal(await evaluate(win,`state.ops.find(o=>o.type==='sale').journalStatus`),'recorded');
 assert.equal(await evaluate(clients[0],`getComputedStyle(document.querySelector('[data-op-id="${receiptId}"]')).backgroundColor`),'rgb(216, 238, 224)');
 progress('Right-click journal choices update all three real renderers; amounts and debt remain 120');
 await evaluate(clients[0],`go('settings');uiThemeSelect.value='dark';uiThemeSelect.dispatchEvent(new Event('change',{bubbles:true}));showReceiptFromHistory(${receiptId});`);await pause(150);
 const moved=await evaluate(clients[0],`(()=>{const table=document.querySelector('#receiptViewBody .receipt table');const th=[...table.tHead.rows[0].cells],name=th.find(h=>h.textContent.includes('Наименование')),price=th.find(h=>h.textContent==='Цена');const dt=new DataTransfer();name.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt}));price.dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:dt}));return [...table.tHead.rows[0].cells].map(h=>h.textContent)})()`);
 assert.ok(moved.indexOf('Наименование')>moved.indexOf('Цена'));
 await evaluate(clients[0],`(()=>{const table=document.querySelector('#receiptViewBody .receipt table');const name=[...table.tHead.rows[0].cells].find(h=>h.textContent==='Наименование'),handle=name.querySelector('.colResize');handle.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:100}));document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:250}));document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:250}));})()`);
 const layout=await evaluate(clients[0],`(()=>{const t=document.querySelector('#receiptViewBody .receipt table');const cells=[...t.tHead.rows[0].cells];return {headers:cells.map(h=>h.textContent),width:parseFloat(cells.find(h=>h.textContent==='Наименование').style.width),row:[...t.tBodies[0].rows[0].cells].map(c=>c.textContent.trim())}})()`);
 assert.equal(layout.row[layout.headers.indexOf('Наименование')],'Тестовый товар');assert.ok(layout.width>=174);
 await evaluate(clients[0],`closeReceiptView();showReceiptFromHistory(${receiptId})`);await pause(100);
 assert.deepEqual(await evaluate(clients[0],`[...document.querySelector('#receiptViewBody .receipt table').tHead.rows[0].cells].map(h=>h.textContent)`),layout.headers);
 progress('Receipt columns reordered and resized through UI events; reopening retains order, width and item association');
 await evaluate(clients[1],`payDealer.value='1';payAmount.value='25';payMethod.value='Наличные';makePayment();`);
 await pause(1100);assert.equal(store.state.ops.length,2);await converge(95);progress('Payment through makePayment on PC2 arrived everywhere; debt = 95');
 async function restartAll(){
  for(const win of clients){await win.webContents.session.flushStorageData();win.destroy();}
  clients=await Promise.all([1,2,3].map(i=>client(i,false)));
 }
 await restartAll();await converge(95);progress('All three profiles reopened with the same receipt, payment and debt');
 assert.equal(await evaluate(clients[0],`document.documentElement.dataset.uiTheme`),'dark');
 for(const win of clients)assert.equal(await evaluate(win,`state.ops.find(o=>o.type==='sale').journalStatus`),'recorded');
 await evaluate(clients[0],`showReceiptFromHistory(${receiptId})`);await pause(100);
 assert.deepEqual(await evaluate(clients[0],`[...document.querySelector('#receiptViewBody .receipt table').tHead.rows[0].cells].map(h=>h.textContent)`),layout.headers);
 assert.equal(await evaluate(clients[0],`parseFloat([...document.querySelector('#receiptViewBody .receipt table').tHead.rows[0].cells].find(h=>h.textContent==='Наименование').style.width)`),layout.width);
 progress('Journal, dark theme and column layout survived all three profile restarts');

 offline.add('qa-pc3');
 await evaluate(clients[2],`window.receiptJournal.set(${receiptId},'unrecorded')`);
 await evaluate(clients[2],`payDealer.value='1';payAmount.value='10';payMethod.value='Наличные';makePayment();`);await pause(1100);
 assert.equal(await evaluate(clients[2],'debtOf(1)'),85);
 await restartAll();assert.equal(await evaluate(clients[2],'debtOf(1)'),85);
 offline.clear();await converge(85);
 for(const win of clients)assert.equal(await evaluate(win,`state.ops.find(o=>o.type==='sale').journalStatus`),'unrecorded');
 progress('Offline payment survived restart and was delivered exactly once');
 lostAck.add('qa-pc1');
 await evaluate(clients[0],`payDealer.value='1';payAmount.value='5';payMethod.value='Наличные';makePayment();`);
 // Restart only after the server committed the PUT whose acknowledgement is lost.
 // Fixed delays can expire before the save timer on a busy CI runner.
 for(let attempt=0;attempt<40&&store.state.ops.length<4;attempt++){
  await evaluate(clients[0],'window.masterSync8962.push(false)');await pause(250);
 }
 assert.equal(store.state.ops.length,4,'The lost-ack payment must reach the server before restart');await restartAll();lostAck.clear();await converge(80);
 assert.equal(store.state.ops.length,4);progress('Lost PUT acknowledgement followed by restart created no duplicate; debt = 80');
 await evaluate(clients[0],`closeReceiptView();go('debts');openDealer(1)`);await pause(150);
 for(let i=0;i<clients.length;i++)fs.writeFileSync(path.join(output,'pc'+(i+1)+'.png'),(await clients[i].webContents.capturePage()).toPNG());
 fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({ok:true,clientCount:3,realComputers:false,operations:store.state.ops.length,debt:80,events,errors},null,2));
 assert.deepEqual(errors,[]);server.close();app.exit(0);
})().catch(error=>{fs.writeFileSync(path.join(output,'failure.txt'),String(error.stack));console.error(error);server.close();app.exit(1)});
