'use strict';
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawn,spawnSync}=require('node:child_process');
const assert=require('node:assert/strict');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const expectedRuntime=require('../app/package.json').version;
const watchdog=setTimeout(()=>{console.error('Windows smoke timeout');process.exit(1)},90000);watchdog.unref();
async function main(){
 if(process.platform!=='win32')throw Error('This check must run on Windows');
 if(process.argv[2]==='handoff'){
  const Module=require('node:module'),original=Module._load;
  Module._load=function(name,...rest){if(name==='electron')return {app:{},BrowserWindow:{},dialog:{},ipcMain:{on(){},handle(){},removeHandler(){}}};return original.call(this,name,...rest)};
  const info=await require('../app/updater-8931.js').launchInstallerAfterAppExit(process.execPath,[process.argv[3]]);
  console.log(JSON.stringify(info));return;
 }
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'uchet smoke '));
 const marker=path.join(tmp,'installed.txt'),writer=path.join(tmp,'write marker.cjs');
 fs.writeFileSync(writer,`require('node:fs').writeFileSync(${JSON.stringify(marker)},'ok')`);
 const probe=spawnSync(process.execPath,[__filename,'handoff',writer],{encoding:'utf8',timeout:20000});
 assert.equal(probe.status,0,probe.stderr);
 for(let i=0;i<150&&!fs.existsSync(marker);i++)await sleep(100);
 const info=JSON.parse(probe.stdout.trim());
 const diagnostics=[info.logPath,info.logPath+'.stderr'].map(p=>fs.existsSync(p)?fs.readFileSync(p,'utf8'):'missing').join('\n');
 assert.ok(fs.existsSync(marker),'Updater helper did not launch its target after parent exit: '+probe.stdout+' '+probe.stderr+' '+diagnostics);
 console.log('PASS: Windows updater handoff with spaces in target arguments');
 if(process.argv[2]==='--handoff-only')return;
 const exe=process.argv[2];assert.ok(fs.existsSync(exe),'Installed executable missing');
 const child=spawn(exe,['--remote-debugging-port=19336'],{env:{...process.env,APPDATA:path.join(tmp,'roaming'),LOCALAPPDATA:path.join(tmp,'local')},stdio:'pipe'});
 let output='';child.stderr.on('data',x=>output+=x);child.stdout.on('data',x=>output+=x);
 try{
  let page;
  for(let i=0;i<150;i++){
   if(child.exitCode!==null)throw Error('Installed application exited: '+output);
   try{const pages=await(await fetch('http://127.0.0.1:19336/json/list')).json();page=pages.find(p=>p.type==='page'&&p.url.startsWith('file:'));if(page)break}catch{}
   await sleep(200);
  }
  assert.ok(page,'Installed application did not open a renderer: '+output);
  console.log('SMOKE: renderer page found '+page.url);
  const socket=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject});
  console.log('SMOKE: debugger websocket connected');
  let requestId=0;
  const evaluate=expression=>new Promise((resolve,reject)=>{const id=++requestId;const timer=setTimeout(()=>reject(Error('CDP evaluate timeout id='+id)),5000);socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.id===id){clearTimeout(timer);if(m.result?.exceptionDetails)reject(Error(JSON.stringify(m.result.exceptionDetails)));else resolve(m.result?.result?.value)}};socket.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,returnByValue:true,awaitPromise:true}}))});
  let result;
  for(let i=0;i<180;i++){
   try{result=await evaluate(`(()=>({ready:document.readyState,text:document.body?.innerText||'',runtime:document.documentElement?.dataset?.uchetRuntime||'',dealerFix:document.documentElement?.dataset?.dealerFix||'',groupFix:document.documentElement?.dataset?.groupFix||'',finalMergeFix:document.documentElement?.dataset?.finalMergeFix||'',deleteHandler:typeof window.deleteDealerPermanent8941,finalInstalled:!!window.__dealerDelete8941Installed,dataInstalled:!!window.__dataFix8941Installed,mergeInstalled:!!window.__finalMerge8942&&!!mergeSyncState.__finalMerge8942}))()`)}catch(_){result=null}
   if(i%30===0)console.log('SMOKE: renderer state '+JSON.stringify(result));
   if(result?.ready==='complete'&&/Дилеры|дилер/.test(result.text||'')&&result.runtime===expectedRuntime&&result.dealerFix==='8.9.41'&&result.groupFix==='8.9.41'&&result.finalMergeFix==='8.9.42'&&result.deleteHandler==='function'&&result.finalInstalled&&result.dataInstalled&&result.mergeInstalled)break;
   await sleep(200);
  }
  assert.equal(result?.runtime,expectedRuntime);
  assert.equal(result?.dealerFix,'8.9.41');
  assert.equal(result?.groupFix,'8.9.41');
  assert.equal(result?.finalMergeFix,'8.9.42');
  assert.equal(result?.finalInstalled,true);
  assert.equal(result?.dataInstalled,true);
  assert.equal(result?.mergeInstalled,true);
  assert.doesNotMatch(output,/Attempted to register a second handler|Uncaught Exception/);

  const groupRepair=await evaluate(`(()=>{
    const sample={
      groups:[
        {id:11,name:'СВЕТОДИОДНЫЕ ЛЕНТЫ',note:'populated'},
        {id:22,name:'СВЕТОДИОДНЫЕ ЛЕНТЫ',note:'duplicate'},
        {id:33,name:'СВЕТИЛЬНИКИ'}
      ],
      products:[
        {id:1,article:'00114',name:'КОНЕКТОР КОНЦЫ С ПРОВОДОМ 10мм',groupId:33,source:'Склад CSV'},
        {id:2,article:'00115',name:'КОННЕКТОР СОЕДИНИТЕЛЬ  10ММ',groupId:22,source:'Склад CSV'},
        {id:3,article:'00116',name:'КОННЕКТОР УГЛЫ 10ММ',groupId:22,source:'Склад CSV'},
        {id:4,article:'00118',name:'ЛЕНТА COB-480 10 Вт  4000к  24V 5 метров          DARS-ELECTRO',groupId:33,source:'Склад CSV'},
        {id:5,article:'00119',name:'ЛЕНТА 120д-1м 13Вт  2000К (AMBER) 24V  5 метров DARS-ELECTRO',groupId:33,source:'Склад CSV'}
      ]
    };
    const r=window.__dataFix8941.repairGroupsInState(sample);
    const ledGroups=sample.groups.filter(g=>String(g.name).trim().toLocaleLowerCase('ru-RU')==='светодиодные ленты');
    const target=ledGroups[0];
    return {systemicShift:r.systemicShift,relinked:r.relinked,duplicatesRemoved:r.duplicatesRemoved,orphansAfter:r.orphansAfter,ledGroups:ledGroups.length,allLinked:!!target&&sample.products.every(p=>String(p.groupId)===String(target.id))};
  })()`);
  assert.equal(groupRepair.systemicShift,true);
  assert.ok(groupRepair.relinked>=3,JSON.stringify(groupRepair));
  assert.equal(groupRepair.duplicatesRemoved,1);
  assert.equal(groupRepair.orphansAfter,0);
  assert.equal(groupRepair.ledGroups,1);
  assert.equal(groupRepair.allLinked,true,JSON.stringify(groupRepair));
  console.log('PASS: 8.9.41 repairs shifted/duplicate product groups from bundled stock catalogue');

  const lockCheck=await evaluate(`(()=>{
    const base=Date.now()-30000,keepId=base,deleteId=base+1;
    const name='Windows locked dealer';
    window.__smokeDealer8963={base,keepId,deleteId,name};
    state.dealers.push({id:keepId,name:'Other dealer',phone:'+70000000001',city:'Keep'},{id:deleteId,name,phone:'+79990000111',city:'Delete'});
    state.ops.push({id:base+10,dealerId:deleteId,type:'sale',date:new Date().toLocaleString('ru-RU'),total:100,items:[]});
    localStorage.setItem(KEY,JSON.stringify(state));renderDealers();window.__dealerDelete8941.tagRows();
    const row=[...document.querySelectorAll('#dealerRows tr')].find(tr=>String(tr.dataset.dealerId||'')===String(deleteId));
    if(!row)return {error:'target dealer row not rendered'};
    row.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:160,clientY:160,button:2}));
    const lockedBefore=window.__dealerDelete8941.getLocked();
    state.dealers.reverse();renderDealers();window.__dealerDelete8941.tagRows();
    const lockedAfter=window.__dealerDelete8941.getLocked();
    return {deleteId:String(deleteId),lockedBefore:lockedBefore?.id||null,lockedAfter:lockedAfter?.id||null};
  })()`);
  assert.ok(!lockCheck?.error,lockCheck?.error||'dealer lock check failed');
  assert.equal(lockCheck.lockedBefore,lockCheck.deleteId,'dealer lock did not capture the intended row');
  assert.equal(lockCheck.lockedAfter,lockCheck.deleteId,'dealer ID changed after table re-render');
  console.log('PASS: dealer context-menu lock survives table re-render');

  const deletion=await evaluate(`(()=>{
    const x=window.__smokeDealer8963;
    if(!x)return {error:'smoke dealer state missing'};
    const original=window.confirm;let confirmations=0,removed=false;
    try{
      window.confirm=()=>{confirmations++;return true};
      removed=!!window.__dealerDelete8941.removeDealerNow(x.deleteId,x.name);
    }finally{window.confirm=original}
    const saved=JSON.parse(localStorage.getItem(KEY)||'{}');
    const remote={dealers:[{id:x.deleteId,name:x.name,phone:'+79990000111',updatedAt:Date.now()+60000}],groups:[],products:[],ops:[],deletedDealers:{},deletedDealerKeys:{},receiptSeq:1,update:state.update,newmatros:state.newmatros,sync:state.sync};
    const merged=mergeSyncState(remote,JSON.parse(JSON.stringify(state)));
    return {
      confirmations,
      removed,
      deleted:!state.dealers.some(d=>String(d.id)===String(x.deleteId)),
      survivor:state.dealers.some(d=>String(d.id)===String(x.keepId)),
      persisted:!(saved.dealers||[]).some(d=>String(d.id)===String(x.deleteId)),
      history:(saved.ops||[]).some(o=>String(o.dealerId)===String(x.deleteId)&&o.dealer===x.name),
      tombstone:!!saved.deletedDealers?.[String(x.deleteId)],
      noResurrection:!(merged.dealers||[]).some(d=>String(d.id)===String(x.deleteId))
    };
  })()`);
  assert.ok(!deletion?.error,deletion?.error||'dealer deletion smoke failed');
  assert.deepEqual(deletion,{confirmations:2,removed:true,deleted:true,survivor:true,persisted:true,history:true,tombstone:true,noResurrection:true});
  socket.close();
  console.log('PASS: '+expectedRuntime+' keeps right-click dealer ID locked and blocks sync resurrection through final merge guard');
 }finally{spawnSync('taskkill',['/PID',String(child.pid),'/T','/F']);}
}
main().catch(e=>{console.error(e);process.exitCode=1});
