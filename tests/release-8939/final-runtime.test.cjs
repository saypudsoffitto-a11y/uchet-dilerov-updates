'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('later package keeps the verified 8.9.39 runtime in its loader chain',()=>{
  const pkg=JSON.parse(read('app/package.json'));
  assert.match(pkg.main,/^main-89\d+\.js$/);
  for(const f of ['main-8939.js','release-8939-main.js','dealer-delete-8939.js'])assert.ok(pkg.build.files.includes(f),f+' missing from build');
  const current=read('app/'+pkg.main);
  assert.match(current,/main-8940\.js|main-8939\.js/);
  const wrapper8940=read('app/main-8940.js');
  assert.match(wrapper8940,/main-8939\.js/);
  const main8939=read('app/main-8939.js');
  assert.match(main8939,/release-8939-main\.js/);
  assert.match(main8939,/main-8938\.js/);
});

test('8.9.39 final runtime explicitly restores verified 8.9.37 remover after a later overwrite',()=>{
  const src=read('app/dealer-delete-8939.js');
  let ticks=[];
  const verifiedRemove=()=>true;
  const verifiedMerge=()=>({ok:true});
  const listeners={};
  const document={
    documentElement:{dataset:{}},
    getElementById:()=>null,
    createElement:()=>({style:{},append(){},remove(){}}),
    body:{appendChild(){}}
  };
  const ctx={
    console,document,
    window:{
      innerWidth:1200,innerHeight:800,
      addEventListener:(name,fn,capture)=>{listeners[name]={fn,capture}},
      __dealerDelete8937:{removeDealerNow:verifiedRemove,mergeSyncState:verifiedMerge},
      deleteDealerFromList:()=>false,
      showDealerContextMenu:()=>false
    },
    setInterval:fn=>{ticks.push(fn);return 1},
    clearInterval:()=>{},
    deleteDealerFromList:()=>false,
    showDealerContextMenu:()=>false,
    mergeSyncState:()=>({bad:true})
  };
  vm.createContext(ctx);
  vm.runInContext(src,ctx,{filename:'dealer-delete-8939.js'});
  assert.equal(ticks.length,1);
  ticks[0]();
  assert.equal(ctx.window.__dealerDelete8939Installed,true);
  assert.equal(ctx.window.deleteDealerFromList,verifiedRemove);
  assert.equal(ctx.window.deleteDealerPermanent8939,verifiedRemove);
  assert.equal(ctx.window.mergeSyncState,verifiedMerge);
  assert.equal(ctx.document.documentElement.dataset.dealerFix,'8.9.39');
  assert.equal(typeof listeners.contextmenu?.fn,'function');
  assert.equal(listeners.contextmenu?.capture,true);
});

test('Windows smoke verifies whichever final dealer runtime the current package installs',()=>{
  const smoke=read('scripts/windows-smoke.cjs');
  assert.match(smoke,/dealerFix/);
  assert.match(smoke,/deleteDealerPermanent89\d+/);
  assert.match(smoke,/removedFromVisibleList/);
  assert.match(smoke,/right-click path a user performs/);
});
