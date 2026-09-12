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
  console.log(JSON.stringify(info));
  return;
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
 console.log('Starting installed executable:',exe);
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
  console.log('Renderer debugger available');
  const socket=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject});
  let requestId=0;
  const evaluate=expression=>new Promise((resolve,reject)=>{const id=++requestId;socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.id===id){if(m.result?.exceptionDetails)reject(Error(JSON.stringify(m.result.exceptionDetails)));else resolve(m.result?.result?.value)}};socket.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,returnByValue:true,awaitPromise:true}}))});
  let result;
  for(let i=0;i<120;i++){
   if(child.exitCode!==null)throw Error('Installed application exited while renderer was loading: '+output);
   try{
    result=await evaluate(`(()=>({ready:document.readyState,text:document.body?.innerText||'',dealerFix:document.documentElement?.dataset?.dealerFix||'',deleteHandler:typeof window.deleteDealerPermanent8939,contextMenu:typeof window.showDealerContextMenu,finalInstalled:!!window.__dealerDelete8939Installed,sameDelete:window.deleteDealerFromList===window.deleteDealerPermanent8939}))()`);
   }catch(_){result=null}
   if(result?.ready==='complete'&&/Дилеры|дилер/.test(result.text||'')&&result.dealerFix==='8.9.39'&&result.deleteHandler==='function'&&result.contextMenu==='function'&&result.finalInstalled&&result.sameDelete)break;
   await sleep(200);
  }
  assert.ok(result,'Renderer readiness check returned no result');
  assert.equal(result.ready,'complete');
  assert.match(result.text,/Дилеры|дилер/);
  assert.equal(result.dealerFix,'8.9.39','final 8.9.39 dealer runtime did not win after all older patches');
  assert.equal(result.deleteHandler,'function');
  assert.equal(result.contextMenu,'function');
  assert.equal(result.finalInstalled,true);
  assert.equal(result.sameDelete,true,'visible delete action is not bound to final verified handler');
  assert.doesNotMatch(output,/Attempted to register a second handler|Uncaught Exception/);
  console.log('Final 8.9.39 runtime loaded; testing the exact right-click path a user performs');
  const deletion=await evaluate(`(async()=>{
    const base=Date.now()-30000;
    const keepId=base;
    const deleteId=base+1;
    const name='Windows duplicate smoke dealer';
    const phone='+79990000111';
    state.dealers.push(
      {id:keepId,name,phone,city:'Test keep'},
      {id:deleteId,name,phone,city:'Test delete'}
    );
    state.ops.push({id:base+10,dealerId:deleteId,type:'sale',date:new Date().toLocaleString('ru-RU'),total:100,items:[]});
    localStorage.setItem(KEY,JSON.stringify(state));
    renderDealers();
    const row=[...document.querySelectorAll('#dealerRows tr')].find(tr=>(tr.getAttribute('oncontextmenu')||'').includes(','+deleteId+')'));
    if(!row)return {error:'duplicate dealer row not rendered'};
    const original=window.confirm;let confirmations=0;
    window.confirm=()=>{confirmations++;return true};
    try{
      row.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:160,clientY:160,button:2}));
      await new Promise(r=>setTimeout(r,40));
      const menu=document.getElementById('dealerContextMenu');
      const button=menu&&[...menu.querySelectorAll('button')].find(b=>/Удалить дилера/.test(b.textContent||''));
      if(!button)return {error:'delete item missing from final dealer context menu',menus:[...document.querySelectorAll('[id^="dealerContextMenu"]')].map(x=>x.id+':'+x.innerText)};
      button.click();
      await new Promise(r=>setTimeout(r,150));
      const saved=JSON.parse(localStorage.getItem(KEY)||'{}');
      const visible=[...document.querySelectorAll('#dealerRows tr')].some(tr=>(tr.getAttribute('oncontextmenu')||'').includes(','+deleteId+')'));
      const remote={
        dealers:[{id:deleteId,name,phone,city:'remote copy',updatedAt:Date.now()+60000}],
        groups:[],products:[],ops:[],deletedDealers:{},deletedDealerKeys:{},receiptSeq:1,
        update:state.update,newmatros:state.newmatros,sync:state.sync
      };
      const merged=mergeSyncState(remote,JSON.parse(JSON.stringify(state)));
      return {
        confirmations,
        deleted:!state.dealers.some(d=>d.id===deleteId),
        survivor:state.dealers.some(d=>d.id===keepId),
        persisted:!(saved.dealers||[]).some(d=>d.id===deleteId),
        removedFromVisibleList:!visible,
        history:(saved.ops||[]).some(o=>o.dealerId===deleteId&&o.dealer===name),
        tombstone:!!saved.deletedDealers?.[String(deleteId)],
        noResurrection:!(merged.dealers||[]).some(d=>d.id===deleteId),
        survivorAfterMerge:(merged.dealers||[]).some(d=>d.id===keepId)
      };
    } finally {window.confirm=original}
  })()`);
  assert.deepEqual(deletion,{confirmations:2,deleted:true,survivor:true,persisted:true,removedFromVisibleList:true,history:true,tombstone:true,noResurrection:true,survivorAfterMerge:true});
  socket.close();console.log('PASS: final installed 8.9.39 UI deletes selected dealer, removes the visible row, persists deletion, preserves history and blocks sync resurrection');
 }finally{spawnSync('taskkill',['/PID',String(child.pid),'/T','/F']);}
}
main().catch(e=>{console.error(e);process.exitCode=1});
