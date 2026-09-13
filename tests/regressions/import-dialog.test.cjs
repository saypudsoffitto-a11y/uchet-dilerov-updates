const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const main=read('app/main.js'),html=read('app/index.html');
function section(s,a,b){return s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)))}
function cp1251(s){return Buffer.from([...s].map(c=>{const n=c.charCodeAt(0);if(n<128)return n;if(n>=0x410&&n<=0x44f)return n-0x410+0xc0;if(n===0x401)return 0xa8;if(n===0x451)return 0xb8;throw Error(c)}))}
test('Both INI entry points preserve order and dealer fields in UTF-8, CP1251 and UTF-16',()=>{
 const text='[Заказ]\nКонтрагент=Тестовый дилер\nМатериалМатериал=МАТ-303\nКоличествоПродукция=10\nШиринаПолотна=380\n[Контрагент]\nНаименование=Тестовый дилер';
 const le=Buffer.from('\ufeff'+text,'utf16le'),be=Buffer.from(le);be.swap16();
 const ctx={TextDecoder,Uint8Array};vm.createContext(ctx);
 vm.runInContext(section(main,'function decodeIni(','function sendIniFile(')+section(html,'function parseIni(','function nmPrices('),ctx);
 for(const bytes of [Buffer.from(text),Buffer.from('\ufeff'+text),cp1251(text),le,be])for(const fn of ['decodeIni','decodeIniBytes']){
  ctx.bytes=bytes;const d=vm.runInContext(`parseIni(${fn}(bytes))`,ctx);
  assert.equal(d['Заказ']['МатериалМатериал'],'МАТ-303');assert.equal(d['Контрагент']['Наименование'],'Тестовый дилер');
 }
});
test('Native confirmations reply exactly once AFTER the answer, across repeated deletion attempts',()=>{
 const handlers={},trace=[],frame={url:require('node:url').pathToFileURL(path.join(root,'app/index.html')).href};let answer=1;
 const win={on(){},isDestroyed:()=>false,webContents:{on(){}}};
 const electron={BrowserWindow:{fromWebContents:()=>win},ipcMain:{on:(n,f)=>handlers[n]=f},dialog:{showMessageBoxSync:()=>{trace.push('dialog');return answer}}};
 vm.runInNewContext(read('app/window-safety.js'),{require:n=>n==='electron'?electron:require(n),__dirname:path.join(root,'app'),module:{exports:{}},setImmediate:()=>{}});
 for(answer of [1,1,1,0,1,1]){trace.length=0;const event={senderFrame:frame,sender:{mainFrame:frame},set returnValue(v){trace.push(v)}};handlers['window:dialog'](event,{kind:'confirm',message:'Удалить?'});assert.deepEqual(trace,['dialog',answer===1]);}
});
test('Open NewMatRos sale prices three widths from cards and posts one receipt',()=>{
 const elements=new Map(),storage=new Map();let handler;
 const element=()=>({style:{},classList:{add(){},remove(){},toggle(){}},appendChild(){},addEventListener(){},remove(){},querySelector:()=>element()});
 const ctx={console,TextDecoder,Uint8Array,document:{head:{appendChild(){}},body:{appendChild(e){elements.set(e.id,e)}},documentElement:{dataset:{}},createElement:element,getElementById:id=>elements.get(id)||null},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},state:{dealers:[{id:1,name:'Тестовый дилер',phone:'79990000000'}],products:[{id:11,name:'МАТ-303 PREMIUM 380-500',retailPrice:200},{id:12,name:'МАТ-303 PREMIUM до 360',retailPrice:100},{id:13,name:'МАТ-303 PREMIUM 580',retailPrice:300}],groups:[],ops:[],receiptSeq:1,newmatros:{prices:{}}},save(){},confirm:()=>true,alert:()=>{},setTimeout(){},KEY:'state'};
 ctx.window=ctx;ctx.newmatrosAPI={setIniHandler:fn=>handler=fn};vm.createContext(ctx);
 vm.runInContext(section(html,'function nmNum(','function showNewMatRosPreview('),ctx);
 for(const file of ['final-fixes-8917.js','runtime-fixes-8924.js','runtime-fixes-8926.js'])vm.runInContext(read('app/'+file),ctx);
 for(const [i,w] of [360,380,580].entries())handler({text:`[Заказ]\nНомерРасчета=100\nИндексПотолка=${i+1}\nКонтрагент=Тестовый дилер\nМатериалМатериал=МАТ-303 PREMIUM\nКоличествоПродукция=10\nШиринаПолотна=${w}\n[Контрагент]\nНаименование=Тестовый дилер`,name:'test.ini'});
 const draft=JSON.parse(storage.get('uchetNewMatRosOpenSale8926'));
 assert.equal(draft.dealerId,1);assert.deepEqual(draft.ceilings.map(c=>c.materialPrice),[100,200,300]);assert.equal(ctx.state.ops.length,0);
 // Capture the actual finish button created by renderDraft.
 const modal=elements.get('nmDraftModal8926'),nodes=new Map();modal.querySelector=id=>{if(!nodes.has(id)){const n=element();n.querySelector=modal.querySelector;nodes.set(id,n)}return nodes.get(id)};
 handler({text:'[Заказ]\nНомерРасчета=100\nИндексПотолка=1',name:'duplicate.ini'});
 nodes.get('#nmDraftFinish8926').onclick();
 assert.equal(ctx.state.ops.length,1);assert.equal(ctx.state.ops[0].total,6000);assert.equal(ctx.state.ops[0].newmatrosKeys.length,3);assert.equal(storage.has('uchetNewMatRosOpenSale8926'),false);
});
test('Current dealer remover survives seven deletions and stale sync without removing the kept duplicate or history',()=>{
 let install;const store=new Map();const ctx={console,KEY:'state',state:{dealers:Array.from({length:8},(_,i)=>({id:i+1,name:'Дубль',phone:'79990000000'})),ops:[{id:100,dealerId:2,total:500,type:'sale'}],sync:{}},localStorage:{setItem:(k,v)=>store.set(k,v)},document:{head:{appendChild(){}},documentElement:{dataset:{}},getElementById:()=>null,createElement:()=>({}),querySelectorAll:()=>[]},norm:x=>x,save(){},confirm:()=>true,alert(){},setInterval:fn=>{install=fn;return 1},clearInterval(){},setTimeout(){},addEventListener(){},removeEventListener(){},mergeSyncState:(remote,local)=>({...local,dealers:[...remote.dealers,...local.dealers]})};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(read('app/dealer-delete-8941.js'),ctx);install();
 for(let id=2;id<=8;id++)assert.equal(ctx.deleteDealerPermanent8941(id),true);
 assert.deepEqual(Array.from(ctx.state.dealers,d=>d.id),[1]);assert.equal(ctx.state.ops.length,1);assert.equal(ctx.state.ops[0].dealer,'Дубль');
 const merged=ctx.mergeSyncState({dealers:[{id:2,name:'Дубль',updatedAt:Date.now()+10000}],deletedDealers:{}},ctx.state);
 assert.deepEqual(Array.from(merged.dealers,d=>d.id),[1]);assert.deepEqual(JSON.parse(store.get('state')).dealers.map(d=>d.id),[1]);
});
