'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('save-time push is queued instead of lost while a server pull is busy',async()=>{
  const src=read('app/sync-fix-8939.js');
  let timers=[];
  let pushes=0;
  const ctx={
    console,
    document:{documentElement:{dataset:{}}},
    window:{},
    syncBusy:true,
    syncCfg:()=>({url:'https://sync.example',enabled:true}),
    syncPull:async()=>{},
    syncPush:async()=>{pushes++},
    setInterval:fn=>{timers.push({fn,delay:100,interval:true});return timers.length},
    clearInterval:()=>{},
    setTimeout:(fn,delay)=>{timers.push({fn,delay,interval:false});return timers.length},
    clearTimeout:()=>{}
  };
  vm.createContext(ctx);
  vm.runInContext(src,ctx,{filename:'sync-fix-8939.js'});
  const installer=timers.find(t=>t.interval);
  assert.ok(installer,'installer timer missing');
  installer.fn();
  assert.equal(ctx.window.__syncFix8939Installed,true);
  assert.equal(ctx.document.documentElement.dataset.syncFix,'8.9.39');

  await ctx.window.syncPush(false);
  assert.equal(pushes,0,'busy pull must not lose or execute the write immediately');
  assert.equal(ctx.window.__syncFix8939.hasQueuedWrite(),true,'write must remain queued');

  ctx.syncBusy=false;
  const retry=timers.filter(t=>!t.interval).at(-1);
  assert.ok(retry&&retry.delay===500,'queued write must schedule a retry');
  await retry.fn();
  await new Promise(r=>setImmediate(r));
  assert.equal(pushes,1,'queued dealer/debt state must be pushed after pull releases the lock');
});

test('multi-PC payload includes dealers and initial-debt operations and merge code keeps both',()=>{
  const index=read('app/index.html');
  const core=read('app/core-fixes-8933.js');
  const pkg=JSON.parse(read('app/package.json'));
  const loader=read('app/release-8939-main.js');

  assert.match(index,/type:'initial_debt'/);
  assert.match(index,/let payload=\{state,baseRevision:/);
  assert.match(core,/remote\.dealers=mergeNewest\(remote\.dealers,local\.dealers,deletedDealers\)/);
  assert.match(core,/remote\.ops=mergeNewest\(remote\.ops,local\.ops,\{\}\)/);
  assert.ok(pkg.build.files.includes('sync-fix-8939.js'),'sync fix must be packaged into installer');
  assert.match(loader,/sync-fix-8939\.js/,'installed app must inject sync fix');
});
