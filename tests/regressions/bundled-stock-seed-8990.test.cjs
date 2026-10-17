'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require.resolve('../../app/index.html'),'utf8');
const source=html.slice(html.indexOf('async function autoImportBundledStockOnce(){'),html.indexOf('\nfunction setupReorderableTables()'));
const empty=()=>({products:[],groups:[],dealers:[],ops:[]});
function harness(initial=empty(),data=new Map()){
 let resolve,loads=0,imports=0,saves=0;
 const loading=new Promise(done=>{resolve=done;});
 const ctx={state:initial,KEY:'local',window:{stockAPI:{loadBundledProducts:()=>{loads++;return loading;}}},localStorage:{getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)},console:{error(){}},parseSemicolonCsv:text=>text,importStockProductRows(){imports++;ctx.state.products.push({id:99,name:'Bundled'});return {added:1,updated:0,total:1};},save(){saves++;}};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 return {ctx,data,resolve:()=>resolve({text:'bundled csv'}),run:()=>ctx.autoImportBundledStockOnce(),loads:()=>loads,imports:()=>imports,saves:()=>saves};
}
test('only pristine offline installation seeds once; marker survives replacement of synchronized state',async()=>{
 const h=harness(),pending=h.run();h.resolve();await pending;assert.equal(h.imports(),1);assert.equal(h.ctx.state.products.length,1);
 h.ctx.state=empty();await h.run();assert.equal(h.imports(),1);
 const restarted=harness(empty(),h.data);await restarted.run();assert.equal(restarted.loads(),0);assert.equal(restarted.imports(),0);
});
test('existing, archived, deleted, synchronized and legacy catalogs never auto import',async()=>{
 const cases=[{products:[{id:1,name:'Current'}]},{products:[{id:1,name:'Archived',archived:true}]},{deletedProducts:{1:42}},{catalogDeletedKeys:{'products:old':true}},{productAliases:{2:1}},{receiptItemStates:{line:{archived:true}}},{ops:[{id:1,type:'sale'}]},{groups:[{id:1}]},{dealers:[{id:1}]},{sync:{url:'https://server',enabled:false}},{sync:{enabled:true}},{_syncBaseline8981:{}},{_syncPending8981:{}},{stockMigrationVersion:3},{stockMigrationDone:true}];
 for(const extra of cases){const input={...empty(),...extra},before=JSON.stringify(input),h=harness(input);await h.run();assert.equal(h.loads(),0,JSON.stringify(extra));assert.equal(h.imports(),0);assert.equal(JSON.stringify(input),before);}
});
test('await race cannot overwrite a newly added or archived card, deletion marks or synchronization',async()=>{
 for(const mutate of [s=>s.products.push({id:1,name:'Manual'}),s=>s.products.push({id:1,name:'Archived',archived:true}),s=>{s.deletedProducts={1:42};},s=>{s.sync={url:'https://server',enabled:true};},s=>s.ops.push({id:1,type:'sale'}),s=>{s.receiptStates={old:{archived:true}};}]){
  const h=harness(),pending=h.run();mutate(h.ctx.state);const before=JSON.stringify(h.ctx.state);h.resolve();await pending;assert.equal(h.imports(),0);assert.equal(JSON.stringify(h.ctx.state),before);assert.equal(h.saves(),0);
 }
});
test('replacing state while awaiting bundled load cancels seed even with an empty replacement',async()=>{
 const h=harness(),pending=h.run();h.ctx.state=empty();h.resolve();await pending;assert.equal(h.imports(),0);
});
test('concurrent startup calls cannot duplicate seed',async()=>{
 const h=harness(),first=h.run();await h.run();assert.equal(h.loads(),1);h.resolve();await first;assert.equal(h.imports(),1);
});
test('explicit manual CSV import remains available after automatic seed was blocked',async()=>{
 const h=harness({...empty(),products:[{id:1,name:'Existing'}]});await h.run();
 h.ctx.getCsvPayload=async()=>({text:'chosen csv',name:'manual.csv'});h.ctx.stockImportStatus={textContent:''};h.ctx.alert=()=>{};h.ctx.toggleStockTransfer=()=>{};
 const manual=html.slice(html.indexOf('async function importStockProductsFromCsv(){'),html.indexOf('function normalizeDealerName('));
 vm.runInContext(manual,h.ctx);await h.ctx.importStockProductsFromCsv();assert.equal(h.imports(),1);assert.match(h.ctx.stockImportStatus.textContent,/manual.csv/);
});
