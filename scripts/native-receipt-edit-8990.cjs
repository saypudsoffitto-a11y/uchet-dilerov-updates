const {app,BrowserWindow,ipcMain,session}=require('electron');const path=require('path'),fs=require('fs');
const root=path.resolve(__dirname,'..');const qa=process.env.UCHET_RECEIPT_QA_DIR||path.join(root,'work','receipt-native-8990');fs.mkdirSync(qa,{recursive:true});app.setPath('userData',path.join(qa,'profile'));
const watchdog=setTimeout(()=>{console.error('Native receipt editor timeout');app.exit(1);},60000);watchdog.unref();
app.whenReady().then(async()=>{
 session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(_details,cb)=>cb({cancel:true}));
 ipcMain.handle('stock:loadBundledProducts',()=>({ok:false}));ipcMain.handle('newmatros:setWatch',()=>({ok:false}));
 const w=new BrowserWindow({show:false,webPreferences:{preload:path.join(root,'app/preload.js'),contextIsolation:true,nodeIntegration:false}});
 ipcMain.handle('app:info',()=>({version:'8.9.90',platform:process.platform,arch:process.arch}));
 try{
 await w.loadFile(path.join(root,'app/index.html'));
 for(let i=0;i<100;i++){if(await w.webContents.executeJavaScript('!!window.buildReceiptImage8968&&!!window.receiptEdit8987&&!!window.__pinLock8948'))break;await new Promise(r=>setTimeout(r,100));}
 if(!await w.webContents.executeJavaScript('!!window.receiptEdit8987'))throw Error('Receipt editor was not loaded by app/preload.js');
 await w.webContents.executeJavaScript(`(async()=>{if(!window.__pinLock8948.isConfigured())await window.__pinLock8948.setInitialPin('2468','2468');else if(!window.__pinLock8948.isUnlocked())await window.__pinLock8948.unlock('2468');window.alert=()=>{};})()`);
 const result=await w.webContents.executeJavaScript(`(()=>{
 const assert=(x,m)=>{if(!x)throw Error(m)};
 state.products=[{id:991,name:'Тестовый товар',article:'T',unit:'шт',retailPrice:100,wholesalePrice:80,buyPrice:40,stock:10}];state.dealers=[{id:992,name:'Тестовый дилер'}];state.ops=[];state.groups=[];state.sync.enabled=false;state.warehouseEnabled=false;render();
 saleProduct.value='991';salePrice.value='100';promptQtyAndAddSelected();
 const set=(id,value)=>{const e=document.getElementById(id);assert(e,'missing '+id);e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));};
 set('qtyModalInput','2');set('qtyModalPrice','150');assert(qtyModalTotal.value==='300','price total');set('qtyModalTotal','350');assert(qtyModalPrice.value==='175','total price');set('qtyModalName8987','Новое имя в чеке');qtyModalInput.focus();qtyModalInput.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
 assert(cart.length===1,'cart append');assert(cart[0].name==='Новое имя в чеке','cart name');assert(cart[0].price===175&&cart[0].total===350,'cart values');
 state.ops=[{id:993,type:'sale',dealerId:992,dealer:'Тестовый дилер',receiptNo:1,date:'18.10.2026',items:JSON.parse(JSON.stringify(cart)),total:350,profit:270}];showReceiptFromHistory(993);
 return {cart:cart[0],initial:true};})()`);
 await new Promise(r=>setTimeout(r,80));
 const edited=await w.webContents.executeJavaScript(`(async()=>{
 const table=document.querySelector('#receiptViewBody table');tableLayout.scan();tableLayout.reorder(table,tableLayout.keys(table).reverse());refreshReceiptViews(993);await new Promise(resolve=>setTimeout(resolve,80));
 const row=document.querySelector('#receiptViewBody tr[data-receipt-item-index]');if(!row)throw Error('receipt row missing');const nameField=row.querySelector('[aria-label="Название товара"]');if(!nameField.closest('td').dataset.colKey.startsWith('Наименование_'))throw Error('name moved to wrong column');const inputs=row.querySelectorAll('input');if(inputs.length!==4)throw Error('expected 4 fields, got '+inputs.length);const amount=row.querySelector('[aria-label=Сумма]');amount.value='420';amount.dispatchEvent(new Event('change',{bubbles:true}));let before=JSON.stringify(state);editReceiptItem(993,0,'total','+0e999');if(JSON.stringify(state)!==before)throw Error('invalid exponent total saved');editReceiptItem(993,0,'name','   ');if(JSON.stringify(state)!==before)throw Error('empty name saved');const op=state.ops[0];if(op.total!==420||op.items[0].price!==210||debtOf(992)!==420)throw Error('saved financial recalculation failed');const persisted=JSON.parse(localStorage.getItem(KEY));if(persisted.ops[0].total!==420)throw Error('not persisted');if(document.getElementById('receiptViewModal').classList.contains('hidden'))throw Error('Receipt closed after edit');return {total:op.total,price:op.items[0].price,debt:debtOf(992),pending:!!persisted._syncPending8981};})()`);
 await w.webContents.executeJavaScript('showReceiptFromHistory(993)');await new Promise(r=>setTimeout(r,150));const pdf=await w.webContents.printToPDF({printBackground:true});fs.writeFileSync(path.join(qa,'receipt-native-print.pdf'),pdf);const screenshot=await w.webContents.capturePage();fs.writeFileSync(path.join(qa,'receipt-native-ui.png'),screenshot.toPNG());const loaded=new Promise(resolve=>w.webContents.once('did-finish-load',resolve));w.webContents.reload();await loaded;for(let i=0;i<100;i++){if(await w.webContents.executeJavaScript('!!window.receiptEdit8987'))break;await new Promise(r=>setTimeout(r,100));}const restored=await w.webContents.executeJavaScript(`(()=>{const op=state.ops.find(o=>o.id===993);if(op?.total!==420||op.items[0].name!=='Новое имя в чеке'||op.items[0].price!==210||op.items[0].qty!==2)throw Error('reload did not restore receipt');return true;})()`);console.log(JSON.stringify({ok:true,result,edited,restored,pdfBytes:pdf.length}));app.exit(0);
 }catch(e){console.error(e);console.error(await w.webContents.executeJavaScript('document.body.innerText.slice(-1500)').catch(()=>''));app.exit(1);}
});
