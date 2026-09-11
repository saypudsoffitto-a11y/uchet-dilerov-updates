'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('8.9.39 is packaged as the final entrypoint after 8.9.38',()=>{
  const pkg=JSON.parse(read('app/package.json'));
  assert.equal(pkg.version,'8.9.39');
  assert.equal(pkg.main,'main-8939.js');
  for(const f of ['main-8939.js','release-8939-main.js','dealer-delete-8939.js'])assert.ok(pkg.build.files.includes(f),f+' missing from build');
  const main=read('app/main-8939.js');
  assert.match(main,/release-8939-main\.js/);
  assert.match(main,/main-8938\.js/);
});

test('final runtime explicitly restores verified 8.9.37 remover after a later overwrite',()=>{
  const src=read('app/dealer-delete-8939.js');
  let ticks=[];
  const verifiedRemove=()=>true;
  const verifiedMerge=()=>({ok:true});
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
});

test('Windows smoke waits for 8.9.39 final handler and verifies visible row disappears',()=>{
  const smoke=read('scripts/windows-smoke.cjs');
  assert.match(smoke,/dealerFix==='8\.9\.39'/);
  assert.match(smoke,/deleteDealerPermanent8939/);
  assert.match(smoke,/sameDelete/);
  assert.match(smoke,/removedFromVisibleList/);
  assert.match(smoke,/final installed 8\.9\.39 UI deletes selected dealer/);
});
