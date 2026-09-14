const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const key='uchetNewMatRosOpenSale8926';
const ini=(index=1,dealer='Тестовый дилер')=>`[Заказ]\nНомерРасчета=100\nИндексПотолка=${index}\nКонтрагент=${dealer}\nМатериалМатериал=МАТ-303 PREMIUM\nКоличествоПродукция=10\nШиринаПолотна=380`;
function harness(draft,api={}){
  const storage=new Map(draft?[[key,JSON.stringify(draft)]]:[]),nodes=new Map(),alerts=[];
  function node(id){
    if(!nodes.has(id))nodes.set(id,{id,style:{},classList:{add(){},remove(){},toggle(){}},appendChild(){},addEventListener(){},remove(){},querySelector:node});
    return nodes.get(id);
  }
  let handler;
  const ctx={console:{error(){}},TextDecoder,Uint8Array,KEY:'state',
    document:{head:{appendChild(){}},body:{appendChild(e){nodes.set(e.id,e)}},documentElement:{dataset:{}},createElement:()=>({...node('template')}),getElementById:id=>nodes.get(id)||null},
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    state:{dealers:[{id:1,name:'Тестовый дилер'},{id:2,name:'Другой дилер'}],products:[{id:11,name:'МАТ-303 PREMIUM 380-500',retailPrice:200}],groups:[],ops:[],receiptSeq:1,newmatros:{prices:{}}},
    save(){},confirm:()=>true,alert:s=>alerts.push(s),setTimeout(){}};
  ctx.window=ctx;ctx.newmatrosAPI={...api,setIniHandler:fn=>handler=fn};vm.createContext(ctx);
  const html=read('app/index.html');vm.runInContext(html.slice(html.indexOf('function nmNum('),html.indexOf('function showNewMatRosPreview(')),ctx);
  for(const file of ['final-fixes-8917.js','runtime-fixes-8924.js','runtime-fixes-8926.js'])vm.runInContext(read('app/'+file),ctx);
  return {ctx,storage,alerts,nodes,send:(text=ini(),name='order.ini')=>handler({text,name}),draft:()=>JSON.parse(storage.get(key)||'null')};
}
function broken(){return {version:1,createdAt:100,dealerId:null,dealerName:'Дилер NewMatRos',dealerPhone:'',ceilings:[{key:'fallback|||||0|0|0',fileName:'order.ini',dealerId:null,dealerName:'Дилер NewMatRos',number:'',ceilingIndex:'',material:'',area:0,width:0,items:[],total:0,materialPrice:0}]}}
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('Empty/configuration/incomplete exports never create an open sale or debt',()=>{
  const h=harness();
  for(const text of ['[Settings]\nLanguage=ru','[Заказ]\nНомерРасчета=100',ini().replace('КоличествоПродукция=10','КоличествоПродукция=0'),ini().replace('Контрагент=Тестовый дилер',''),ini().replace('ШиринаПолотна=380','')])h.send(text);
  assert.equal(h.draft(),null);assert.equal(h.ctx.state.ops.length,0);assert.equal(h.alerts.length,5);
});
test('Re-export replaces the empty legacy placeholder and preserves a recovery copy',()=>{
  const old=broken(),h=harness(old);h.send();
  assert.equal(h.draft().dealerId,1);assert.equal(h.draft().ceilings.length,1);assert.equal(h.draft().ceilings[0].total,2000);
  const backups=[...h.storage].filter(([k])=>k.startsWith(key+'-recovery-'));
  assert.equal(backups.length,1);assert.deepEqual(JSON.parse(backups[0][1]),old);
  h.send(ini(2));assert.equal(h.draft().ceilings.length,2);assert.equal(h.ctx.state.ops.length,0);
});
test('A valid draft is unchanged by invalid data, another dealer or a duplicate',()=>{
  const h=harness();h.send();const before=h.storage.get(key);
  h.send('[Settings]\nLanguage=ru');h.send(ini(2,'Другой дилер'));h.send();
  assert.equal(h.storage.get(key),before);assert.equal(h.ctx.state.ops.length,0);
});
test('A missing-price ceiling can be re-exported after setting the product price, then posted once',()=>{
  const h=harness();h.ctx.state.products[0].retailPrice=0;h.send();
  assert.equal(h.draft().ceilings[0].materialPrice,0);
  h.ctx.state.products[0].retailPrice=200;h.send();
  assert.equal(h.draft().ceilings.length,1);assert.equal(h.draft().ceilings[0].materialPrice,200);
  h.nodes.get('#nmDraftFinish8926').onclick();
  assert.equal(h.ctx.state.ops.length,1);assert.equal(h.ctx.state.ops[0].dealerId,1);assert.equal(h.ctx.state.ops[0].total,2000);
  h.send();assert.equal(h.draft(),null);assert.equal(h.ctx.state.ops.length,1);
});
test('File picker and folder watcher append to the same draft',async()=>{
  const h=harness(null,{chooseIni:async()=>({text:ini(2),name:'second.ini'})});h.send();
  await h.ctx.chooseNewMatRosIni();
  assert.equal(h.draft().ceilings.length,2);assert.equal(h.ctx.state.ops.length,0);
});
test('Upgrade rereads the original INI to recover the broken placeholder without another export',async()=>{
  const names=[],h=harness(broken(),{rereadIni:async name=>{names.push(name);return {name,text:ini()}}});
  await settle();assert.deepEqual(names,['order.ini']);assert.equal(h.draft().dealerId,1);assert.equal(h.draft().ceilings[0].total,2000);assert.equal(h.ctx.state.ops.length,0);
});
test('Missing recovery file preserves the old draft and does not invent order data',async()=>{
  const old=broken(),h=harness(old,{rereadIni:async()=>({error:'missing'})});await settle();assert.deepEqual(h.draft(),old);
});
test('Recovery does not resurrect a draft closed while the INI read was pending',async()=>{
  let resolve;const h=harness(broken(),{rereadIni:()=>new Promise(r=>resolve=r)});
  h.storage.delete(key);resolve({name:'order.ini',text:ini()});await settle();assert.equal(h.draft(),null);assert.equal(h.ctx.state.ops.length,0);
});
test('Recovery cannot substitute a different order from a reused filename',async()=>{
  const first=harness();first.ctx.state.products[0].retailPrice=0;first.send();const old=first.draft();
  const h=harness(old,{rereadIni:async()=>({name:'order.ini',text:ini(99)})});await settle();assert.deepEqual(h.draft(),old);
});
test('Recovery IPC refuses traversal and files outside the NewMatRos directory',()=>{
  const main=read('app/main.js'),start=main.indexOf("ipcMain.handle('newmatros:rereadIni'");
  const code=main.slice(start,main.indexOf('\nfunction decodeCsv(',start));let handler,reads=0;
  const folder='C:\\NewMatRos Standart';let realFile=path.win32.join(folder,'order.ini');
  const ctx={ipcMain:{handle:(_n,fn)=>handler=fn},path:path.win32,nmFolder:folder,decodeIni:()=>ini(),fs:{realpathSync:p=>p===folder?folder:realFile,readFileSync:()=>{reads++;return Buffer.from('')}}};
  vm.runInNewContext(code,ctx);
  for(const name of ['../order.ini','..\\order.ini','C:\\order.ini','file:secret.ini','settings.txt',null])assert.ok(handler(null,name).error);
  assert.equal(reads,0);assert.equal(handler(null,'order.ini').text,ini());assert.equal(reads,1);
  realFile='C:\\elsewhere\\order.ini';assert.ok(handler(null,'order.ini').error);assert.equal(reads,1);
});
