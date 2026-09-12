'use strict';
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawn,spawnSync}=require('node:child_process');
const assert=require('node:assert/strict');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
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
  const socket=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject});
  let requestId=0;
  const evaluate=expression=>new Promise((resolve,reject)=>{const id=++requestId;socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.id===id){if(m.result?.exceptionDetails)reject(Error(JSON.stringify(m.result.exceptionDetails)));else resolve(m.result?.result?.value)}};socket.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,returnByValue:true,awaitPromise:true}}))});
  let result;
  for(let i=0;i<160;i++){
   try{result=await evaluate(`(()=>({ready:document.readyState,text:document.body?.innerText||'',dealerFix:document.documentElement?.dataset?.dealerFix||'',groupFix:document.documentElement?.dataset?.groupFix||'',deleteHandler:typeof window.deleteDealerPermanent8941,finalInstalled:!!window.__dealerDelete8941Installed,dataInstalled:!!window.__dataFix8941Installed}))()`)}catch(_){result=null}
   if(result?.ready==='complete'&&/Дилеры|дилер/.test(result.text||'')&&result.dealerFix==='8.9.41'&&result.groupFix==='8.9.41'&&result.deleteHandler==='function'&&result.finalInstalled&&result.dataInstalled)break;
   await sleep(200);
  }
  assert.equal(result?.dealerFix,'8.9.41');
  assert.equal(result?.groupFix,'8.9.41');
  assert.equal(result?.finalInstalled,true);
  assert.equal(result?.dataInstalled,true);
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

  const deletion=await evaluate(`(async()=>{
    const base=Date.now()-30000,keepId=base,deleteId=base+1;
    const name='Windows locked dealer';
    state.dealers.push({id:keepId,name:'Other dealer',phone:'+70000000001',city:'Keep'},{id:deleteId,name,phone:'+79990000111',city:'Delete'});
    state.ops.push({id:base+10,dealerId:deleteId,type:'sale',date:new Date().toLocaleString('ru-RU'),total:100,items:[]});
    localStorage.setItem(KEY,JSON.stringify(state));renderDealers();window.__dealerDelete8941.tagRows();
    const row=[...document.querySelectorAll('#dealerRows tr')].find(tr=>String(tr.dataset.dealerId||'')===String(deleteId));
    if(!row)return {error:'target dealer row not rendered'};
    const original=window.confirm;let confirmations=0;window.confirm=()=>{confirmations++;return true};
    try{
      row.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:160,clientY:160,button:2}));
      await new Promise(r=>setTimeout(r,40));
      const lockedBefore=window.__dealerDelete8941.getLocked();
      const menu=document.getElementById('dealerContextMenu8941');
      const button=menu&&[...menu.querySelectorAll('button')].find(b=>/Удалить именно/.test(b.textContent||''));
      if(!button)return {error:'locked delete item missing'};
      state.dealers.reverse();renderDealers();window.__dealerDelete8941.tagRows();
      const lockedAfter=window.__dealerDelete8941.getLocked();
      button.click();await new Promise(r=>setTimeout(r,300));
      const saved=JSON.parse(localStorage.getItem(KEY)||'{}');
      const remote={dealers:[{id:deleteId,name,phone:'+79990000111',updatedAt:Date.now()+60000}],groups:[],products:[],ops:[],deletedDealers:{},deletedDealerKeys:{},receiptSeq:1,update:state.update,newmatros:state.newmatros,sync:state.sync};
      const merged=mergeSyncState(remote,JSON.parse(JSON.stringify(state)));
      return {confirmations,lockedBefore:lockedBefore?.id,lockedAfter:lockedAfter?.id,deleted:!state.dealers.some(d=>String(d.id)===String(deleteId)),survivor:state.dealers.some(d=>String(d.id)===String(keepId)),persisted:!(saved.dealers||[]).some(d=>String(d.id)===String(deleteId)),history:(saved.ops||[]).some(o=>String(o.dealerId)===String(deleteId)&&o.dealer===name),tombstone:!!saved.deletedDealers?.[String(deleteId)],noResurrection:!(merged.dealers||[]).some(d=>String(d.id)===String(deleteId))};
    }finally{window.confirm=original}
  })()`);
  assert.deepEqual(deletion,{confirmations:2,lockedBefore:String(deletion.lockedBefore),lockedAfter:String(deletion.lockedAfter),deleted:true,survivor:true,persisted:true,history:true,tombstone:true,noResurrection:true});
  assert.equal(deletion.lockedBefore,deletion.lockedAfter,'dealer ID changed after table re-render');
  socket.close();
  console.log('PASS: 8.9.41 keeps right-click dealer ID locked through table re-render and deletes exact dealer');
 }finally{spawnSync('taskkill',['/PID',String(child.pid),'/T','/F']);}
}
main().catch(e=>{console.error(e);process.exitCode=1});
