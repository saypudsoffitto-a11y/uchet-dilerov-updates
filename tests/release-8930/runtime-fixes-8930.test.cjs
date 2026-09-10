process.chdir(require('node:path').resolve(__dirname,'../..'));
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');

function harness(){
  const ctx={
    console,Date,Map,Set,Object,Math,Number,String,Array,JSON,
    setInterval,clearInterval,setTimeout,clearTimeout,
    KEY:'uchet_dilerov_v8',
    state:{dealers:[],groups:[],products:[],ops:[],sync:{},newmatros:{marker:'unchanged'},update:{}},
    save(){},
    norm(x){x=x||{};x.dealers=x.dealers||[];x.groups=x.groups||[];x.products=x.products||[];x.ops=x.ops||[];x.sync=x.sync||{};x.newmatros=x.newmatros||{};x.update=x.update||{};return x},
    opTime:o=>+o.ts||+o.id||0,
    localStorage:{setItem(){},getItem(){return ''}},
    confirm:()=>true,alert(){},
    document:{addEventListener(){},querySelector(){return null},getElementById(){return null},documentElement:{dataset:{}},body:{appendChild(){}},createElement(){return {style:{},querySelector(){return {onclick:null}},remove(){}}}},
    hideDealerContextMenu(){},closeDealerModal(){},
    addDealer(){},saveDealerEdit(){},saveDealerPhoto(){},
    saveSale(){},makePayment(){},confirmInitialDebt(){},
    showReceiptFromHistory(){},refreshReceiptViews(){},sendWhatsApp(){},
    showDebtReport(){},debtReportText(){},sendDebtReportWhatsApp(){},
    delProduct(){},showSaleProductContextMenu(){},mergeSyncState(){},
    saveProductEdit(){},editReceiptItem(){},addEventListener(){},window:null
  };
  ctx.window=ctx;ctx.window.__uchetPatch8914=true;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('app/runtime-fixes-8930.js','utf8'),ctx);
  return new Promise(resolve=>setTimeout(()=>resolve(ctx),140));
}

test('8.9.30 runtime compiles and installs',async()=>{
  new vm.Script(fs.readFileSync('app/runtime-fixes-8930.js','utf8'));
  const h=await harness();assert.equal(h.window.__uchetRuntime8930,true);
});

test('newer dealer contact wins and NewMatRos remains on unchanged local path',async()=>{
  const h=await harness();
  const remote={dealers:[{id:1,name:'A',phone:'222',updatedAt:200}],groups:[],products:[],ops:[],sync:{revision:2},newmatros:{marker:'remote'},update:{}};
  const local={dealers:[{id:1,name:'A',phone:'111',updatedAt:100}],groups:[],products:[],ops:[],sync:{revision:1},newmatros:{marker:'local'},update:{}};
  const m=h.mergeSyncState(remote,local);assert.equal(m.dealers[0].phone,'222');assert.equal(m.newmatros.marker,'local');
});

test('dealer tombstone propagates deletion but a later edit can win',async()=>{
  const h=await harness();
  let m=h.mergeSyncState({dealers:[],deletedDealers:{1:300},groups:[],products:[],ops:[],sync:{},newmatros:{},update:{}},{dealers:[{id:1,name:'Old',updatedAt:100}],groups:[],products:[],ops:[],sync:{},newmatros:{},update:{}});
  assert.equal(m.dealers.length,0);
  m=h.mergeSyncState({dealers:[],deletedDealers:{1:300},groups:[],products:[],ops:[],sync:{},newmatros:{},update:{}},{dealers:[{id:1,name:'Edited later',updatedAt:400}],groups:[],products:[],ops:[],sync:{},newmatros:{},update:{}});
  assert.equal(m.dealers[0].name,'Edited later');
});

test('deleting dealer removes card but preserves operations and phone snapshot',async()=>{
  const h=await harness();
  h.state={dealers:[{id:7,name:'Дубль',phone:'+7 999'}],groups:[],products:[],ops:[{id:9,ts:9,type:'sale',dealerId:7,dealer:'Дубль',total:100}],sync:{},newmatros:{},update:{}};
  h.deleteDealerFromList(7);
  assert.equal(h.state.dealers.length,0);assert.equal(h.state.ops.length,1);assert.ok(h.state.deletedDealers['7']>0);assert.equal(h.state.ops[0].dealerPhone,'+7 999');
});
