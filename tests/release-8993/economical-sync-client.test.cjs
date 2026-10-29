'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const C=require('../../app/sync-core-8962'),H=require('../../app/sync-health-8987');
const D=require('../../app/permanent-delete-8989'),R=require('../../app/sync-convergence-8988');
const P=require('../../server/master-protocol-8962');
const source=fs.readFileSync(require.resolve('../../app/master-sync-8962'),'utf8');
const url='https://economical.test',device={id:'economical-device-0001',name:'MacBook'};
const operation=id=>({id,type:'payment',dealerId:1,total:25,ts:1,date:'2026-10-29'});
const initial=()=>({dealers:[{id:1,name:'Dealer',phone:'79990000001'}],products:[{id:9,name:'Product',retailPrice:100,stock:10}],groups:[],ops:[],sync:{url,enabled:true,revision:10}});

function harness({first=false,persisted}={}){
  let now=1000,successes=0,hook;
  let server={revision:10,state:initial(),computers:{shared:true,devices:{[device.id]:C.clone(device)}}};
  const data=new Map(persisted||[['uchet_device_8962',JSON.stringify(device)],['local',JSON.stringify(initial())]]);
  if(!first&&!persisted)data.set('uchet_sync_baseline_8962:'+url,JSON.stringify({state:initial(),revision:10}));
  const writes=[],calls=[],timers=[],status={dataset:{},textContent:''};
  class Clock extends Date{static now(){return now;}}
  const ctx={state:JSON.parse(data.get('local')),KEY:'local',Date:Clock,
    SyncCore8962:C,PermanentDelete8989:D,SyncConvergence8988:R,
    SyncHealth8987:{...H,create:options=>{const health=H.create(options);return {...health,success(...args){successes++;return health.success(...args);}};}},
    document:{getElementById:id=>id==='syncStatus'?status:null},
    localStorage:{getItem:key=>data.get(key)||null,setItem:(key,value)=>{writes.push(key);data.set(key,value);}},
    norm:x=>x,render(){},setTimeout:fn=>{timers.push(fn);return timers.length;},
    syncCfg:()=>ctx.state.sync,
    syncRequest:async(method,body)=>{
      calls.push({method,body:body===undefined?undefined:C.clone(body)});
      return hook?hook(method,body,serve):serve(method,body);
    }};
  function serve(method,body){
    if(method==='PUT'){
      if(body.baseRevision!==server.revision)return {ok:false,conflict:true,revision:server.revision};
      server=P.update(server,body);server.revision++;
    }
    const reply={...C.clone(server),ok:true,protocol:2,storage:'turso',inventoryProtocol:2,productRevisions:true,permanentDeletionProtocol:1};
    if(method==='GET'&&body?.knownRevision!==undefined&&String(body.knownRevision)===String(server.revision)){
      reply.notModified=true;delete reply.state;
    }
    return reply;
  }
  ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source,ctx);timers.length=0;
  return {ctx,data,writes,calls,timers,status,server:()=>server,successes:()=>successes,
    hook:value=>{hook=value;},advance:ms=>{now+=ms;},pull:manual=>ctx.masterSync8962.pull(manual||false),
    save:()=>ctx.masterSync8962.commitState(C.clone(ctx.state)),
    async warm(){assert.equal(await ctx.masterSync8962.pull(false),true);calls.length=0;writes.length=0;},
    async flush(){let count=0;while(timers.length){assert.ok(count++<12,'queued writes must settle');await timers.shift()();}}};
}
function gate(h,method='GET'){
  let enter,release,paused=false;
  const waiting=new Promise(resolve=>{enter=resolve;}),blocked=new Promise(resolve=>{release=resolve;});
  h.hook(async(m,body,serve)=>{if(!paused&&m===method){paused=true;enter();await blocked;}return serve(m,body);});
  return {waiting,release};
}

test('first poll after startup is full; unchanged background polls do not rewrite visible data or baseline',async()=>{
  const h=harness();
  await h.warm();
  // warm() clears call records, so prove startup again from persisted data.
  const restarted=harness({persisted:h.data});
  assert.equal(await restarted.pull(),true);
  assert.equal(restarted.calls[0].body,undefined);
  const state=restarted.ctx.state,baseline=state._syncBaseline8981,stored=restarted.data.get('local');
  restarted.writes.length=0;restarted.calls.length=0;
  assert.equal(await restarted.pull(),true);
  assert.deepEqual(restarted.calls,[{method:'GET',body:{knownRevision:10}}]);
  assert.equal(restarted.ctx.state,state);
  assert.equal(restarted.ctx.state._syncBaseline8981,baseline);
  assert.equal(restarted.data.get('local'),stored);
  assert.deepEqual(restarted.writes,[]);
  assert.equal(restarted.status.dataset.syncState,'online');
});

test('first join obtains the full database and preserves the unknown cache in recovery',async()=>{
  const h=harness({first:true});h.ctx.state.ops.push(operation('unknown-cache'));h.data.set('local',JSON.stringify(h.ctx.state));
  // The imported cache predates startup in a real installation.
  const restarted=harness({first:true,persisted:h.data});
  assert.equal(await restarted.pull(),true);
  assert.equal(restarted.calls[0].body,undefined);
  assert.equal(restarted.ctx.state.ops.length,0);
  assert.equal(JSON.parse(restarted.data.get('uchet_before_master_8962:'+url)).ops[0].id,'unknown-cache');
  restarted.calls.length=0;
  assert.equal(await restarted.pull(),true);
  assert.equal(restarted.calls[0].body.knownRevision,10);
});

test('manual pulls and reads before writes always request the full state',async()=>{
  const h=harness();await h.warm();
  assert.equal(await h.pull(true),true);
  assert.equal(h.calls[0].body,undefined);
  h.calls.length=0;h.ctx.state.ops.push(operation('manual-safety'));h.save();
  assert.equal(await h.ctx.masterSync8962.push(false),true);
  assert.equal(h.calls[0].method,'GET');assert.equal(h.calls[0].body,undefined);
  assert.equal(h.server().state.ops[0].id,'manual-safety');
});

test('full refresh is forced every five minutes and after a clock rollback',async()=>{
  const h=harness();await h.warm();
  h.advance(299999);assert.equal(await h.pull(),true);
  assert.equal(h.calls.at(-1).body.knownRevision,10);
  h.advance(1);assert.equal(await h.pull(),true);
  assert.equal(h.calls.at(-1).body,undefined);
  assert.equal(await h.pull(),true);assert.equal(h.calls.at(-1).body.knownRevision,10);
  h.advance(-1);assert.equal(await h.pull(),true);assert.equal(h.calls.at(-1).body,undefined);
});

test('changing the URL forces a full refresh even when the new URL already has a baseline',async()=>{
  const h=harness();await h.warm();
  h.ctx.state.sync.url='https://another.test';
  h.data.set('uchet_sync_baseline_8962:https://another.test',JSON.stringify({state:initial(),revision:10}));
  assert.equal(await h.pull(),true);
  assert.equal(h.calls[0].body,undefined);
  assert.equal(h.ctx.state._syncBaseline8981.url,'https://another.test');
});

for(const revision of ['010','+10','10.0','1e1','10 ',true,null,-1,10.5,Number.MAX_SAFE_INTEGER+1]){
  test('noncanonical or unsafe baseline revision is never sent as knownRevision: '+JSON.stringify(revision),async()=>{
    const h=harness();await h.warm();
    h.ctx.state._syncBaseline8981.baseline.revision=revision;
    h.hook(()=>({ok:false,code:'SYNC_SERVICE_SUSPENDED',message:'Unavailable'}));
    assert.equal(await h.pull(),false);
    assert.equal(h.calls[0].body,undefined);
  });
}

test('canonical string and zero revisions remain eligible for economical polling',async()=>{
  for(const revision of ['10',0]){
    const h=harness();h.server().revision=revision;h.data.set('uchet_sync_baseline_8962:'+url,JSON.stringify({state:initial(),revision}));
    await h.warm();
    assert.equal(await h.pull(),true);
    assert.equal(h.calls[0].body.knownRevision,revision);
  }
});

test('a baseline without a valid state cannot authorize a metadata-only reply',async()=>{
  const h=harness();await h.warm();
  h.ctx.state._syncBaseline8981.baseline.state=null;h.save();
  const stored=h.data.get('local'),successes=h.successes();
  h.hook(()=>({ok:true,notModified:true,revision:10,protocol:2,storage:'turso',computers:h.server().computers}));
  assert.equal(await h.pull(),false);
  assert.equal(h.calls[0].body,undefined);
  assert.equal(h.successes(),successes);
  assert.equal(h.data.get('local'),stored);
});

for(const mode of ['startup','manual','wrong-revision','noncanonical-revision','url-change','baseline-removed','write-read']){
  test('unsolicited or mismatched notModified is refused before health success: '+mode,async()=>{
    const h=harness();if(mode!=='startup')await h.warm();
    const stored=h.data.get('local'),successes=h.successes();
    h.hook(()=>{
      if(mode==='url-change')h.ctx.state.sync.url='https://changed-during-request.test';
      if(mode==='baseline-removed'){delete h.ctx.state._syncBaseline8981;h.data.delete('uchet_sync_baseline_8962:'+url);}
      return {ok:true,notModified:true,revision:mode==='wrong-revision'?11:mode==='noncanonical-revision'?'10.0':10,
        protocol:2,storage:'turso',computers:h.server().computers};
    });
    const result=mode==='write-read'?await h.ctx.masterSync8962.push(false):await h.pull(mode==='manual');
    assert.equal(result,false);
    assert.equal(h.successes(),successes);
    assert.equal(h.data.get('local'),stored);
    assert.equal(h.status.dataset.syncState,'offline');
    assert.equal(h.calls.some(call=>call.method==='PUT'),false);
  });
}

test('a server that ignores knownRevision remains compatible and sends its full snapshot',async()=>{
  const h=harness();await h.warm();
  h.hook((method,body,serve)=>serve(method,method==='GET'?undefined:body));
  assert.equal(await h.pull(),true);
  assert.equal(h.calls[0].body.knownRevision,10);
  assert.equal(h.ctx.state._syncBaseline8981.baseline.revision,10);
  assert.ok(h.writes.includes('local'));
});

for(const kind of ['payment','sale','product','dealer','archive']){
  test('a metadata-only poll preserves and schedules '+kind+' edited while GET is pending',async()=>{
    const h=harness();await h.warm();const g=gate(h),pulling=h.pull();await g.waiting;
    if(kind==='payment')h.ctx.state.ops.push(operation('during-get-payment'));
    if(kind==='sale')h.ctx.state.ops.push({...operation('during-get-sale'),type:'sale',items:[],total:100});
    if(kind==='product')h.ctx.state.products[0].retailPrice=120;
    if(kind==='dealer')h.ctx.state.dealers[0].city='Edited during GET';
    if(kind==='archive')h.ctx.state.receiptStates={receipt:{archived:true,receipt:{...operation('receipt'),type:'sale',items:[]}}};
    h.save();const saved=h.data.get('local'),baseline=h.ctx.state._syncBaseline8981;
    h.writes.length=0;g.release();assert.equal(await pulling,true);
    assert.equal(h.calls[0].body.knownRevision,10);
    assert.equal(h.ctx.state._syncBaseline8981,baseline);
    assert.equal(h.data.get('local'),saved);
    assert.deepEqual(h.writes,[]);
    assert.equal(h.timers.length,1,'retained local work must schedule an upload');
    await h.flush();
    if(kind==='payment'||kind==='sale')assert.equal(h.server().state.ops[0].id,'during-get-'+kind);
    if(kind==='product')assert.equal(h.server().state.products[0].retailPrice,120);
    if(kind==='dealer')assert.equal(h.server().state.dealers[0].city,'Edited during GET');
    if(kind==='archive')assert.equal(h.server().state.receiptStates.receipt.archived,true);
    assert.equal(h.calls.filter(call=>call.method==='GET').slice(1).every(call=>call.body===undefined),true);
  });
}

test('a changed full response to a conditional GET preserves edits made during that request',async()=>{
  const h=harness();await h.warm();const g=gate(h),pulling=h.pull();await g.waiting;
  h.server().state.ops.push(operation('remote-payment'));h.server().revision++;
  h.ctx.state.ops.push(operation('local-payment'));h.save();
  g.release();assert.equal(await pulling,true);
  assert.deepEqual(h.ctx.state.ops.map(op=>op.id).sort(),['local-payment','remote-payment']);
  await h.flush();
  assert.deepEqual(h.server().state.ops.map(op=>op.id).sort(),['local-payment','remote-payment']);
});

test('metadata-only polls still register the device and preserve edits during registration',async()=>{
  const h=harness();await h.warm();delete h.server().computers.devices[device.id];
  const g=gate(h,'PUT'),pulling=h.pull();await g.waiting;
  h.ctx.state.ops.push(operation('during-registration'));h.save();
  g.release();assert.equal(await pulling,true);
  assert.equal(h.calls[0].body.knownRevision,10);
  assert.equal(h.calls[1].body.action,'register');
  assert.ok(h.server().computers.devices[device.id]);
  await h.flush();assert.equal(h.server().state.ops[0].id,'during-registration');
});

test('a metadata-only poll forwards a persisted deletion queue for acknowledged processing',async()=>{
  const h=harness();await h.warm();
  h.ctx.state._purgeQueue8989={url,commands:[{requestId:'economical-deletion-0001',target:'dealer',dealerId:'1',confirmed:true,preserveStock:true}]};
  h.save();const saved=h.data.get('local');h.writes.length=0;
  assert.equal(await h.pull(),true);
  assert.equal(h.calls[0].body.knownRevision,10);
  assert.equal(h.data.get('local'),saved);
  assert.deepEqual(h.writes,[]);
  await h.flush();
  assert.equal(h.server().state.dealers.length,0);
  assert.equal(h.ctx.state._purgeQueue8989.commands.length,0);
  assert.equal(h.calls.some(call=>call.body?.action==='purge'),true);
});

test('failure and recovery preserve pending edits until an economical poll can schedule upload',async()=>{
  const h=harness();await h.warm();h.ctx.state.ops.push(operation('offline-pending'));h.save();
  const stored=h.data.get('local');
  h.hook(()=>({ok:false,code:'SYNC_SERVICE_SUSPENDED',message:'Render service suspended'}));
  assert.equal(await h.pull(),false);assert.equal(h.data.get('local'),stored);
  h.hook(null);assert.equal(await h.pull(),true);
  assert.equal(h.data.get('local'),stored);
  await h.flush();assert.equal(h.server().state.ops[0].id,'offline-pending');
});

const malformedFullReplies=[
  ['missing state',{}],
  ['false marker without state',{notModified:false}],
  ...[0,'',null,'true','false',1].map(notModified=>['nonboolean marker '+JSON.stringify(notModified),{notModified,state:initial()}]),
  ...[null,[], 'database',123,new Date()].map(state=>['invalid snapshot '+JSON.stringify(state),{state}]),
  ...[undefined,null,true,-1,1.5,'010','10.0','1e1','10 ',Number.MAX_SAFE_INTEGER+1].map(revision=>['invalid revision '+String(revision),{state:initial(),revision}])
];
for(const phase of ['startup','conditional'])for(const [label,fields] of malformedFullReplies){
  test('malformed full reply preserves memory, persisted data and baseline: '+phase+' / '+label,async()=>{
    const h=harness();if(phase==='conditional')await h.warm();
    h.ctx.state.ops.push(operation('pending-local-work'));h.save();
    const visible=JSON.stringify(h.ctx.state),stored=h.data.get('local'),baseline=h.data.get('uchet_sync_baseline_8962:'+url),
      embedded=JSON.stringify(h.ctx.state._syncBaseline8981),successes=h.successes();
    h.writes.length=0;
    h.hook(()=>({ok:true,protocol:2,storage:'turso',revision:10,computers:h.server().computers,...fields}));
    assert.equal(await h.pull(),false);
    assert.equal(h.successes(),successes);
    assert.equal(JSON.stringify(h.ctx.state),visible);
    assert.equal(h.data.get('local'),stored);
    assert.equal(h.data.get('uchet_sync_baseline_8962:'+url),baseline);
    assert.equal(JSON.stringify(h.ctx.state._syncBaseline8981),embedded);
    assert.deepEqual(h.writes,[]);
    assert.equal(h.status.dataset.syncState,'offline');
  });
}

test('an explicitly supplied empty object remains a valid initial server database',async()=>{
  for(const notModified of [undefined,false]){
    const h=harness();
    h.ctx.norm=s=>({...s,dealers:s.dealers||[],products:s.products||[],groups:s.groups||[],ops:s.ops||[]});
    h.hook(()=>({ok:true,protocol:2,storage:'turso',revision:10,computers:h.server().computers,state:{},
      ...(notModified===undefined?{}:{notModified})}));
    assert.equal(await h.pull(),true);
    assert.equal(h.ctx.state.dealers.length,0);
    assert.equal(h.ctx.state.products.length,0);
    assert.equal(h.ctx.state.groups.length,0);
    assert.equal(h.ctx.state.ops.length,0);
    assert.equal(h.status.dataset.syncState,'online');
    assert.deepEqual(JSON.parse(h.data.get('local'))._syncBaseline8981.baseline.state,{});
  }
});

test('malformed write acknowledgement keeps pending work recoverable and retry does not duplicate it',async()=>{
  const h=harness();await h.warm();h.ctx.state.ops.push(operation('lost-state-ack'));h.save();
  const saved=h.data.get('local'),embedded=JSON.stringify(h.ctx.state._syncBaseline8981);
  h.hook((method,body,serve)=>{
    const reply=serve(method,body);
    if(method==='PUT')delete reply.state;
    return reply;
  });
  assert.equal(await h.ctx.masterSync8962.push(false),false);
  assert.equal(h.data.get('local'),saved);
  assert.equal(JSON.stringify(h.ctx.state._syncBaseline8981),embedded);
  assert.equal(h.ctx.state.ops[0].id,'lost-state-ack');
  h.hook(null);assert.equal(await h.pull(),true);await h.flush();
  assert.equal(h.server().state.ops.length,1);
  assert.equal(h.ctx.state.ops.length,1);
});

for(const phase of ['startup','conditional'])for(const reply of [
  {ok:true,conflict:true},
  {ok:false,conflict:true},
  {ok:true,conflict:true,status:409},
  {ok:false,status:409,message:'Conflict'}
])test('GET conflict cannot bypass response validation: '+phase+' / '+JSON.stringify(reply),async()=>{
  const h=harness();if(phase==='conditional')await h.warm();
  h.ctx.state.ops.push(operation('conflict-pending-local'));h.save();
  const visible=JSON.stringify(h.ctx.state),stored=h.data.get('local'),baseline=h.data.get('uchet_sync_baseline_8962:'+url),
    embedded=JSON.stringify(h.ctx.state._syncBaseline8981),successes=h.successes();
  h.writes.length=0;
  h.hook(()=>({protocol:2,storage:'turso',revision:10,computers:h.server().computers,...reply}));
  assert.equal(await h.pull(),false);
  assert.equal(h.successes(),successes);
  assert.equal(JSON.stringify(h.ctx.state),visible);
  assert.equal(h.data.get('local'),stored);
  assert.equal(h.data.get('uchet_sync_baseline_8962:'+url),baseline);
  assert.equal(JSON.stringify(h.ctx.state._syncBaseline8981),embedded);
  assert.deepEqual(h.writes,[]);
  assert.equal(h.calls.some(call=>call.method==='PUT'),false);
  assert.equal(h.status.dataset.syncState,'offline');
});
