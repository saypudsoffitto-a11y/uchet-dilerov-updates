// Electron integration: real renderer, preload and HTTP IPC; fictional data only.
// Run from the repository root with app/node_modules/.bin/electron and set
// UCHET_QA_DIR to an empty scratch directory. No production app/profile is used.
'use strict';
const {app,BrowserWindow,session,ipcMain}=require('electron');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const C=require('../app/sync-core-8962'),{update}=require('../server/master-protocol-8962');
const root=path.resolve(__dirname,'..');
const output=path.resolve(process.env.UCHET_QA_DIR||path.join(root,'qa-sync-probe/native-permanent-delete'));
fs.mkdirSync(output,{recursive:true});
assert.equal(fs.existsSync(path.join(output,'profile')),false,'Use a fresh isolated QA directory');
app.setPath('userData',path.join(output,'profile'));
const old=Date.now()-86400000;
const sale=(id,dealerId,qty,ts=old+id)=>({id,ts,type:'sale',date:'QA',dealerId,dealer:dealerId===1?'QA Удаляемый дилер':'QA Другой дилер',receiptNo:id,total:qty*120,profit:qty*50,items:[{productId:1,name:'QA Товар',qty,price:120,buyPrice:70,total:qty*120,profit:qty*50,unit:'шт'}]});
const fixture={dealers:[{id:1,name:'QA Удаляемый дилер',phone:'79990000001'},{id:2,name:'QA Другой дилер',phone:'79990000002'}],groups:[{id:1,name:'QA Группа'}],products:[{id:1,groupId:1,name:'QA Товар',article:'QA',unit:'шт',buyPrice:70,retailPrice:120,wholesalePrice:120,stock:97,inventoryVersion:2,warehouseOpening:100,catalogRev:1}],ops:[
 {id:101,ts:old+101,type:'initial_debt',dealerId:1,dealer:'QA Удаляемый дилер',date:'QA',total:100,note:'Из тетради'},sale(102,1,2),
 {id:103,ts:old+103,type:'payment',dealerId:1,dealer:'QA Удаляемый дилер',date:'QA',total:20,beforeDebt:340,afterDebt:320,method:'Наличные'},
 {id:201,ts:old+201,type:'initial_debt',dealerId:2,dealer:'QA Другой дилер',date:'QA',total:90},sale(202,2,1),
 {id:203,ts:old+203,type:'payment',dealerId:2,dealer:'QA Другой дилер',date:'QA',total:10,beforeDebt:210,afterDebt:200,method:'Наличные'}
],receiptStates:{104:{receipt:sale(104,1,4),archived:true,at:old+105}},receiptItemStates:{'104:0':{receiptId:104,dealerId:1,index:0,archived:true,at:old+105}}};
let store={revision:10,state:C.clone(fixture),computers:{masterId:'qa-owner-00000001',devices:{}}};
const untouched=C.clone({dealer:fixture.dealers[1],ops:fixture.ops.filter(o=>o.dealerId===2)});
const offline=new Set(),losePurgeAck=new Set(),events=[],errors=[];
let backupCount=0;
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
   events.push({pc:token,action:payload.action,target:payload.deletion?.target,requestId:payload.deletion?.requestId,revision:store.revision,operations:store.state.ops.length});
   if(payload.action==='purge'&&losePurgeAck.delete(token)){offline.add(token);req.socket.destroy();return;}
  }
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({...store,ok:true,protocol:2,storage:'turso',inventoryProtocol:2,productRevisions:true,permanentDeletionProtocol:1,serverVersion:'8.9.89-sync9'}));
 }catch(error){events.push({pc:token,error:error.message});res.writeHead(400);res.end(JSON.stringify({message:error.message}));}
});
app.on('browser-window-created',(_e,win)=>win.webContents.on('preload-error',(_e,_p,error)=>errors.push(String(error))));
app.whenReady().then(()=>session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(request,done)=>done({cancel:!request.url.startsWith('http://127.0.0.1:')})));
require('../app/main-8948');
// The actual contextBridge method and IPC channel remain in use, while this
// harmless handler replaces the save dialog and disk backup for fixture data.
ipcMain.removeHandler('update:saveBackup');
ipcMain.handle('update:saveBackup',async(_event,text)=>{assert.ok(JSON.parse(text).dealers.every(d=>d.name.startsWith('QA ')));backupCount++;return {ok:true,path:path.join(output,'fictional-backup.json')};});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,message,timeout=15000){
 const started=Date.now();while(Date.now()-started<timeout){if(await check())return;await pause(100);}
 throw Error(message+'; recent events: '+JSON.stringify(events.slice(-12)));
}
const evaluate=(win,code)=>win.webContents.executeJavaScript(code);
const progress=message=>{events.push({check:message});console.log(message);};
(async()=>{
 await app.whenReady();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port;
 async function client(index,initial){
  const win=new BrowserWindow({show:false,width:1400,height:900,webPreferences:{partition:'persist:permanent-delete-pc'+index,preload:path.join(root,'app/preload.js'),contextIsolation:true,nodeIntegration:false}});
  win.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(request,done)=>done({cancel:!request.url.startsWith(url+'/')}));
  await win.loadFile(path.join(root,'app/index.html'));
  await until(()=>evaluate(win,'!!window.permanentDeleteUI8989&&!!window.masterSync8962?.queueDeletion&&document.documentElement.dataset.uchetRuntime==="8.9.68"'),'Deletion UI not loaded');
  await evaluate(win,`window.__qaConfirm=true;window.__qaPrompts=[];window.__qaAlerts=[];window.confirm=text=>(window.__qaPrompts.push(String(text)),window.__qaConfirm);window.alert=text=>window.__qaAlerts.push(String(text));`);
  if(initial)await evaluate(win,`state=norm(${JSON.stringify(fixture)});state.sync={url:${JSON.stringify(url)},token:'qa-pc${index}',enabled:true,interval:60,revision:0};render();localStorage.setItem(KEY,JSON.stringify(state));window.masterSync8962.markSaved();`);
  return win;
 }
 let clients=await Promise.all([1,2,3].map(i=>client(i,true)));
 async function restart(index){const previous=clients[index];await previous.webContents.session.flushStorageData();previous.destroy();clients[index]=await client(index+1,false);}
 async function converge(debt,exists=true){
  for(let round=0;round<2;round++)for(const win of clients){
   await until(()=>evaluate(win,'window.masterSync8962.pull(false)'),'Native pull did not complete');
   await pause(150);
  }
  for(const win of clients){
   const actual=await evaluate(win,'({debt:debtOf(1),exists:state.dealers.some(d=>d.id==1),other:{dealer:state.dealers.find(d=>d.id==2),ops:state.ops.filter(o=>o.dealerId==2)},stock:state.products.find(p=>p.id==1).stock})');
   assert.equal(actual.debt,debt);assert.equal(actual.exists,exists);assert.equal(actual.stock,97);assert.deepEqual(actual.other,untouched);
  }
 }
 async function click(index,text,confirm=true){
  await evaluate(clients[index],`window.__qaConfirm=${confirm};openDealer(1);(()=>{const b=[...document.querySelectorAll('#dealerModalBody button')].find(b=>b.textContent===${JSON.stringify(text)});if(!b)throw Error('QA button missing: '+${JSON.stringify(text)});b.click();})()`);
 }
 async function addNotebook(index,amount){
  await evaluate(clients[index],`addInitialDebt(1);initialDebtAmount.value=${JSON.stringify(String(amount))};initialDebtNote.value='QA после очистки';confirmInitialDebt();`);
  await until(()=>store.state.ops.some(o=>o.dealerId===1&&o.type==='initial_debt'&&o.total===amount),'New notebook operation did not reach server');
 }
 await converge(320);
 // Exercise the exact lists shown in the supplied dark-theme regression video.
 await evaluate(clients[0],`uiThemeSelect.value='dark';uiThemeSelect.dispatchEvent(new Event('change',{bubbles:true}));show('sales',document.querySelector('nav button[data-section="sales"]'));renderSaleDealers();renderSaleProducts();`);
 const palette=await evaluate(clients[0],`(()=>{const selectors=['#saleDealerSearch','#saleDealerList','#saleProductList','.selectedBox','#saleDealerList .choiceRow.active','#saleProductList .choiceRow','#sales h2'];return selectors.map(selector=>{const el=document.querySelector(selector);if(!el)throw Error('Missing theme target '+selector);const style=getComputedStyle(el);return {selector,background:style.backgroundColor,color:style.color}})})()`);
 function luminance(color){const channels=color.match(/\d+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*channels[0]+.7152*channels[1]+.0722*channels[2];}
 for(const entry of palette){if(entry.background==='rgba(0, 0, 0, 0)')continue;assert.notEqual(entry.background,'rgb(255, 255, 255)',entry.selector+' must not remain white in dark mode');const fg=luminance(entry.color),bg=luminance(entry.background);assert.ok((Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05)>=4.5,'Unreadable dark-theme text: '+JSON.stringify(entry));}
 fs.writeFileSync(path.join(output,'theme-sales.png'),(await clients[0].webContents.capturePage()).toPNG());
 await evaluate(clients[0],'openDealer(1)');
 fs.writeFileSync(path.join(output,'theme-dealer.png'),(await clients[0].webContents.capturePage()).toPNG());
 fs.writeFileSync(path.join(output,'theme-palette.json'),JSON.stringify(palette,null,2));
 progress('Graphite theme has readable dealer/product lists, selected rows and inputs with no white panels');
 const beforeCancel=JSON.stringify(store.state),beforeCancelRevision=store.revision;
 await click(0,'Удалить сумму из тетради',false);await pause(500);
 assert.equal(JSON.stringify(store.state),beforeCancel);assert.equal(store.revision,beforeCancelRevision);assert.equal(backupCount,3,'Cancel must not save deletion backup');
 assert.equal(await evaluate(clients[0],'debtOf(1)'),320);
 await click(0,'Удалить сумму из тетради');
 await until(()=>!store.state.ops.some(o=>o.id===101),'Notebook delete did not reach server');
 await converge(220);assert.ok(store.state.permanentDeletions.operations['101']);
 progress('Notebook button cancellation changed nothing; confirmation deleted exactly the notebook amount across three clients');

 // An offline client contains additional old, never-sent documents as well as
 // the now-stale notebook and archive. None may restore cleared history.
 offline.add('qa-pc3');
 await evaluate(clients[2],`state.ops.push(${JSON.stringify(sale(501,1,1))});state.receiptStates['502']={receipt:${JSON.stringify(sale(502,1,1))},archived:true,at:${old+503}};state.receiptItemStates['502:0']={receiptId:502,dealerId:1,index:0,archived:true,at:${old+503}};localStorage.setItem(KEY,JSON.stringify(state));render();`);
 await click(0,'Очистить всю историю');
 await until(()=>!store.state.ops.some(o=>o.dealerId===1),'History deletion did not reach server');
 assert.ok(store.state.dealers.some(d=>d.id===1));assert.deepEqual(store.state.receiptStates,{});assert.deepEqual(store.state.receiptItemStates,{});assert.equal(store.state.products[0].stock,97);
 await addNotebook(1,77);await restart(2);offline.delete('qa-pc3');await converge(77);
 assert.equal(store.state.ops.filter(o=>o.dealerId===1).length,1);assert.deepEqual(store.state.receiptStates,{});assert.deepEqual(store.state.receiptItemStates,{});
 progress('Clear history kept dealer and warehouse stock; stale offline sales and archives were discarded after restart');

 // The server commits purge, but its response is lost. A second PC creates a
 // later document while PC1 remains disconnected. Persisted request retry must
 // acknowledge the original result, never clear this new document again.
 losePurgeAck.add('qa-pc1');
 await click(0,'Очистить всю историю');
 await until(()=>offline.has('qa-pc1'),'Lost acknowledgement scenario never committed');
 const lostRequest=events.filter(e=>e.pc==='qa-pc1'&&e.action==='purge').at(-1).requestId;
 assert.ok(await evaluate(clients[0],`state._purgeQueue8989.commands.some(c=>c.requestId===${JSON.stringify(lostRequest)})`));
 await until(()=>evaluate(clients[1],'window.masterSync8962.pull(false)'),'PC2 pull after lost acknowledgement failed');
 await addNotebook(1,33);await restart(0);offline.delete('qa-pc1');
 await until(()=>evaluate(clients[0],'window.masterSync8962.push(true)'),'Retry after restart failed');
 await converge(33);
 assert.equal(store.state.ops.filter(o=>o.dealerId===1).length,1);
 assert.ok(events.filter(e=>e.action==='purge'&&e.requestId===lostRequest).length>=2,'The same persisted request must be retried');
 progress('Lost purge acknowledgement survived restart; replay did not delete a later notebook entry');

 offline.add('qa-pc3');
 await evaluate(clients[2],`state.ops.push(${JSON.stringify(sale(601,1,1))});state.receiptStates['602']={receipt:${JSON.stringify(sale(602,1,1))},archived:true,at:${old+603}};localStorage.setItem(KEY,JSON.stringify(state));render();`);
 await click(0,'Удалить дилера полностью');
 await until(()=>!store.state.dealers.some(d=>d.id===1),'Dealer with debt was not removed');
 await restart(2);offline.delete('qa-pc3');await converge(0,false);
 assert.ok(store.state.permanentDeletions.dealers['1']);assert.equal(store.state.ops.some(o=>o.dealerId===1),false);assert.deepEqual(store.state.receiptStates,{});assert.deepEqual(store.state.receiptItemStates,{});
 progress('Full dealer deletion accepted nonzero debt and could not be resurrected by another computer; unrelated dealer stayed byte-identical');
 for(let index=0;index<clients.length;index++){
  await restart(index);
  fs.writeFileSync(path.join(output,'pc'+(index+1)+'.png'),(await clients[index].webContents.capturePage()).toPNG());
 }
 await converge(0,false);
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({ok:true,clientCount:3,realComputers:false,stock:97,deletedDealer:1,otherDealerDebt:200,backupCount,events,errors},null,2));
 server.close();app.exit(0);
})().catch(error=>{fs.writeFileSync(path.join(output,'failure.txt'),String(error.stack));console.error(error);server.close();app.exit(1);});
