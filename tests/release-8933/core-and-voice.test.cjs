process.chdir(require('node:path').resolve(__dirname,'../..'));
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const wait=ms=>new Promise(r=>setTimeout(r,ms));

function coreHarness(){
  const store={};
  const ctx={
    console,Date,Map,Set,Object,Math,Number,String,Array,JSON,
    setInterval,clearInterval,setTimeout,clearTimeout,
    KEY:'uchet_dilerov_v8',
    state:{dealers:[{id:100,name:'Дубль',phone:'+7 (999) 12-34'}],groups:[],products:[],ops:[{id:200,ts:200,type:'sale',dealerId:100,dealer:'Дубль',total:100}],sync:{enabled:false,url:'',revision:0},newmatros:{marker:'untouched'},update:{}},
    norm(x){x=x||{};x.dealers=x.dealers||[];x.groups=x.groups||[];x.products=x.products||[];x.ops=x.ops||[];x.sync=x.sync||{};x.newmatros=x.newmatros||{};x.update=x.update||{};return x},
    render(){},save(){store.saved=JSON.stringify(ctx.state);ctx.render()},
    opTime:o=>+o.ts||+o.id||0,
    confirm:()=>true,
    localStorage:{setItem(k,v){store[k]=v},getItem(k){return store[k]||null}},
    document:{
      documentElement:{dataset:{}},
      addEventListener(){},
      getElementById(){return null},
      createElement(){return {style:{},append(){},remove(){},set onclick(v){this._onclick=v},get onclick(){return this._onclick}}},
      body:{appendChild(){}}
    },
    window:null,
    closeDealerModal(){},renderDealers(){},
    mergeSyncState(remote,local){return remote||local},
    addEventListener(){},
    addDealer(){},saveDealerEdit(){},saveDealerPhoto(){}
  };
  ctx.window=ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('app/core-fixes-8933.js','utf8'),ctx);
  return {ctx,store};
}

test('8.9.33 scripts parse',()=>{
  for(const f of ['app/core-fixes-8933.js','app/audio-fix-8933.js','app/speech-fallback-8933.js','app/release-8933-main.js','app/main-8933.js']){
    new vm.Script(fs.readFileSync(f,'utf8'));
  }
});

test('dealer deletion removes card, preserves history and phone snapshot',async()=>{
  const {ctx,store}=coreHarness();
  await wait(160);
  assert.equal(ctx.window.__uchetCore8933,true);
  const ok=ctx.window.deleteDealerPermanent8933(100);
  assert.equal(ok,true);
  assert.equal(ctx.state.dealers.length,0);
  assert.equal(ctx.state.ops.length,1);
  assert.equal(ctx.state.ops[0].dealerPhone,'+7 (999) 12-34');
  assert.ok(ctx.state.deletedDealers['100']>0);
  const persisted=JSON.parse(store. saved||store[ctx.KEY]);
  assert.equal(persisted.dealers.length,0);
});

test('sync tombstone prevents an old remote dealer from returning',async()=>{
  const {ctx}=coreHarness();
  await wait(160);
  const deletedAt=1000;
  const local={dealers:[],deletedDealers:{100:deletedAt},groups:[],products:[],ops:[],sync:{},newmatros:{marker:'local'},update:{}};
  const remote={dealers:[{id:100,name:'Старая карточка',phone:'111',updatedAt:500}],groups:[],products:[],ops:[],sync:{},newmatros:{marker:'remote'},update:{}};
  const merged=ctx.window.mergeSyncState8933(remote,local);
  assert.equal(merged.dealers.length,0);
  assert.equal(merged.newmatros.marker,'local');
});

test('a genuinely newer dealer edit can win over an older tombstone',async()=>{
  const {ctx}=coreHarness();
  await wait(160);
  const local={dealers:[{id:100,name:'Исправленная карточка',phone:'222',updatedAt:2000}],deletedDealers:{100:1000},groups:[],products:[],ops:[],sync:{},newmatros:{},update:{}};
  const remote={dealers:[],deletedDealers:{100:1000},groups:[],products:[],ops:[],sync:{},newmatros:{},update:{}};
  const merged=ctx.window.mergeSyncState8933(remote,local);
  assert.equal(merged.dealers.length,1);
  assert.equal(merged.dealers[0].phone,'222');
});

test('assistant speech falls back to Windows when browser TTS is unavailable',async()=>{
  let fallback=0,base=0;
  const status={textContent:''};
  const ctx={
    console,setInterval,clearInterval,setTimeout,clearTimeout,
    window:null,
    document:{getElementById(id){return id==='aiStatus'?status:null},documentElement:{dataset:{}}},
    assistantAudio:{speak:async()=>{base++;return {ok:true,mode:'base'}}},
    audioAPI:{config:async()=>({mode:'windows',hasKey:false})},
    voiceAPI:{speakWindows:async()=>{fallback++;return {ok:true,voice:'test'}}}
  };
  ctx.window=ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('app/audio-fix-8933.js','utf8'),ctx);
  await wait(160);
  const r=await ctx.assistantAudio.speak('Проверка');
  assert.equal(r.ok,true);
  assert.equal(fallback,1);
  assert.equal(base,0);
});

test('cloud speech keeps the natural OpenAI path when configured',async()=>{
  let fallback=0,base=0;
  const ctx={
    console,setInterval,clearInterval,setTimeout,clearTimeout,
    window:null,
    document:{getElementById(){return null},documentElement:{dataset:{}}},
    assistantAudio:{speak:async()=>{base++;return {ok:true,mode:'cloud'}}},
    audioAPI:{config:async()=>({mode:'cloud',hasKey:true})},
    voiceAPI:{speakWindows:async()=>{fallback++;return {ok:true}}}
  };
  ctx.window=ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('app/audio-fix-8933.js','utf8'),ctx);
  await wait(160);
  const r=await ctx.assistantAudio.speak('Проверка');
  assert.equal(r.mode,'cloud');
  assert.equal(base,1);
  assert.equal(fallback,0);
});

test('8.9.33 entry loads final runtime after legacy runtime and exposes Windows speech',()=>{
  const main=fs.readFileSync('app/main-8933.js','utf8');
  assert.ok(main.indexOf("require('./release-8930-main.js')")<main.indexOf("require('./release-8933-main.js')"));
  assert.ok(main.includes("require('./speech-fallback-8933.js')"));
  const preload=fs.readFileSync('app/preload.js','utf8');
  assert.ok(preload.includes("speakWindows: (text) => ipcRenderer.invoke('assistant:speakWindows', text)"));
  const finalLoader=fs.readFileSync('app/release-8933-main.js','utf8');
  assert.ok(finalLoader.indexOf("core-fixes-8933.js")<finalLoader.indexOf("audio-fix-8933.js"));
});
