// Real renderer + preload + HTTP IPC, isolated profiles and fictional data only.
'use strict';
const {app,BrowserWindow,session}=require('electron');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const C=require('../app/sync-core-8962'),{update}=require('../server/master-protocol-8962');
const output=path.resolve(process.env.UCHET_QA_DIR||'qa-product-delete-8990');
fs.mkdirSync(output,{recursive:true});app.setPath('userData',path.join(output,'profile'));
const fixture={dealers:[{id:1,name:'Тестовый дилер',phone:'79990000001'}],groups:[{id:1,name:'Тестовая группа'}],products:[{id:1,groupId:1,name:'Тестовый товар',article:'QA',unit:'шт',buyPrice:70,retailPrice:120,wholesalePrice:120,stock:98,inventoryVersion:2,warehouseOpening:100,catalogRev:1},{id:2,groupId:1,name:'Ненужный товар',stock:5,inventoryVersion:2,warehouseOpening:5,catalogRev:1},{id:3,groupId:1,name:'Оставляем',stock:7,inventoryVersion:2,warehouseOpening:7,catalogRev:1}],ops:[{id:77,type:'sale',dealerId:1,total:240,inventoryTracked:true,items:[{productId:1,name:'Историческое имя',qty:2,price:120,buyPrice:70,total:240,profit:100}]}]};
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
   events.push({pc:token,action:payload.action,revision:store.revision,operations:store.state.ops.length,productChanges:payload.productChanges});
   if(lostAck.has(token)){req.socket.destroy();return;}
  }
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({...store,ok:true,protocol:2,storage:'turso',inventoryProtocol:2,productRevisions:true,serverVersion:'8.9.79-sync6'}));
 }catch(error){res.writeHead(400);res.end(JSON.stringify({message:error.message}));}
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
  const win=new BrowserWindow({show:false,width:1400,height:900,webPreferences:{partition:'persist:sync-pc'+index,preload:path.resolve('app/preload.js'),contextIsolation:true,nodeIntegration:false}});
  win.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(request,done)=>done({cancel:!request.url.startsWith(url+'/')}));
  await win.loadFile(path.resolve('app/index.html'));await pause(700);
  await evaluate(win,'newmatrosAPI.setWatch(false)');
  await evaluate(win,`window.__pinLock8948.isConfigured()?window.__pinLock8948.unlock('1234'):window.__pinLock8948.setInitialPin('1234')`);
  if(initial)await evaluate(win,`state=norm(${JSON.stringify(fixture)});state.sync={url:${JSON.stringify(url)},token:'qa-pc${index}',enabled:true,interval:3600,revision:0};render();localStorage.setItem(KEY,JSON.stringify(state));window.masterSync8962.markSaved();`);
  return win;
 }
 let clients=await Promise.all([1,2].map(i=>client(i,true)));
 async function converge(debt){
  for(let round=0;round<2;round++)for(const win of clients){
   await evaluate(win,'window.masterSync8962.push(false)');
   let received=false;
   for(let attempt=0;attempt<20&&!received;attempt++){received=await evaluate(win,'window.masterSync8962.pull(false)');if(!received)await pause(200);}
   assert.equal(received,true,await evaluate(win,'document.getElementById("syncStatus").textContent'));await pause(450);
  }
  for(const win of clients){const value=await evaluate(win,'({debt:debtOf(1),ids:state.ops.map(o=>o.id),status:document.getElementById("syncStatus").dataset.syncState})');assert.equal(value.debt,debt);assert.equal(new Set(value.ids).size,value.ids.length);assert.equal(value.status,'online');}
 }
 await converge(240);
 const originalReceipt=JSON.stringify(store.state.ops);
 await evaluate(clients[0],`window.confirm=()=>false;delProduct(3);`);
 assert.equal(await evaluate(clients[0],'state.products.some(p=>p.id===3)'),true);
 progress('Cancel leaves product and persisted state intact');
 offline.add('qa-pc2');
 await evaluate(clients[0],`window.confirm=()=>true;window.__qaAlerts=[];window.alert=msg=>window.__qaAlerts.push(String(msg));cart=[{productId:2,qty:1}];window.__qaDeleteReturns=[delProduct(2),delProduct(1)];`);
 for(let i=0;i<20&&(!store.state.deletedProducts?.['2']||!store.state.products.find(p=>p.id===1)?.archived);i++){
  await evaluate(clients[0],'window.masterSync8962.push(false)');await pause(150);
 }
 assert.deepEqual(await evaluate(clients[0],'window.__qaAlerts'),[]);
 assert.ok(store.state.deletedProducts?.['2']);assert.equal(store.state.products.some(p=>p.id===2),false);
 assert.equal(store.state.products.find(p=>p.id===1).archived,true);
 assert.equal(store.state.products.find(p=>p.id===1).stock,98);
 assert.equal(JSON.stringify(store.state.ops),originalReceipt);
 assert.equal(await evaluate(clients[0],'cart.length'),0);
 async function visible(win){return evaluate(win,`(()=>{go('products');renderProducts();return [...productRows.querySelectorAll('tr')].map(r=>r.textContent)})()`);}
 assert.equal((await visible(clients[0])).join(' ').includes('Ненужный товар'),false);
 assert.equal((await visible(clients[0])).join(' ').includes('Тестовый товар'),false);
 progress('Unused product removed; used product hidden while historical receipt, debt and stock remain unchanged');
 // A stale offline computer saves unrelated work together with its old catalog.
 await evaluate(clients[1],`state.products.find(p=>p.id===3).extraInfo='Правка со второго ПК';save();`);
 offline.clear();await converge(240);
 for(const win of clients){assert.equal(await evaluate(win,'state.products.some(p=>p.id===2)'),false);assert.equal(await evaluate(win,'state.products.find(p=>p.id===1).archived'),true);assert.equal(await evaluate(win,'state.products.find(p=>p.id===1).stock'),98);assert.equal(await evaluate(win,'state.products.find(p=>p.id===3).extraInfo'),'Правка со второго ПК');}
 assert.equal(JSON.stringify(store.state.ops),originalReceipt);
 progress('Stale catalog cannot resurrect deleted cards; unrelated offline edit syncs to both clients');
 for(const win of clients){await win.webContents.session.flushStorageData();win.destroy();}
 clients=await Promise.all([1,2].map(i=>client(i,false)));await converge(240);
 for(const win of clients){assert.equal(await evaluate(win,'state.products.some(p=>p.id===2)'),false);assert.equal(await evaluate(win,'state.products.find(p=>p.id===1).archived'),true);assert.equal((await visible(win)).join(' ').includes('Тестовый товар'),false);await evaluate(win,'showReceiptFromHistory(77)');assert.equal(await evaluate(win,'state.ops[0].items[0].name'),'Историческое имя');assert.equal(await evaluate(win,'state.products.find(p=>p.id===1).stock'),98);}
 progress('Both profiles restart with deletion durable, old receipt and stock preserved');
 await evaluate(clients[0],`window.editReceiptItem(77,0,'qty','3');window.editReceiptItem(77,0,'price','130');window.editReceiptItem(77,0,'total','401,55');window.editReceiptItem(77,0,'name','Новое имя в чеке');`);
 await converge(401.55);
 for(const win of clients){const value=await evaluate(win,`({item:state.ops.find(o=>o.id===77).items[0],stock:state.products.find(p=>p.id===1).stock,name:state.products.find(p=>p.id===1).name})`);assert.equal(value.item.qty,3);assert.equal(value.item.price,133.85);assert.equal(value.item.total,401.55);assert.equal(value.item.name,'Новое имя в чеке');assert.equal(value.stock,97);assert.equal(value.name,'Тестовый товар');}
 progress('Receipt quantity, price, sum and name edits sync to both clients; archived card and stock remain consistent');
 for(const win of clients){await win.webContents.session.flushStorageData();win.destroy();}
 clients=await Promise.all([1,2].map(i=>client(i,false)));await converge(401.55);
 for(const win of clients){assert.equal(await evaluate(win,'state.ops.find(o=>o.id===77).items[0].name'),'Новое имя в чеке');assert.equal(await evaluate(win,'state.products.find(p=>p.id===1).stock'),97);}
 progress('Edited receipt, debt and stock survive both profile restarts');
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({ok:true,clientCount:2,events,errors},null,2));server.close();app.exit(0);
})().catch(error=>{fs.writeFileSync(path.join(output,'failure.txt'),String(error.stack));console.error(error);server.close();app.exit(1)});
