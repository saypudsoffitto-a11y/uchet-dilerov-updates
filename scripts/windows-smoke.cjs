'use strict';
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawn,spawnSync}=require('node:child_process');
const assert=require('node:assert/strict');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
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
 assert.ok(fs.existsSync(marker),'Updater helper did not launch its target after parent exit: '+probe.stdout+' '+probe.stderr);
 console.log('PASS: Windows updater handoff with spaces in target arguments');
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
  const evaluate=expression=>new Promise((resolve,reject)=>{const id=Date.now();socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.id===id){if(m.result?.exceptionDetails)reject(Error(JSON.stringify(m.result.exceptionDetails)));else resolve(m.result?.result?.value)}};socket.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,returnByValue:true,awaitPromise:true}}))});
  await sleep(1800);
  const result=await evaluate(`(async()=>({ready:document.readyState,text:document.body.innerText,deleteHandler:typeof window.deleteDealerPermanent8935}))()`);
  assert.equal(result.ready,'complete');assert.match(result.text,/Дилеры|дилер/);assert.equal(result.deleteHandler,'function');
  assert.doesNotMatch(output,/Attempted to register a second handler|Uncaught Exception/);
  const deletion=await evaluate(`(()=>{
    const id=Date.now()-10000;
    state.dealers.push({id,name:'Windows smoke dealer',phone:'+79990000001'});
    state.ops.push({id:id+1,dealerId:id,type:'sale',amount:100});
    const original=window.confirm;let confirmations=0;
    window.confirm=()=>{confirmations++;return true};
    try {
      const ok=window.deleteDealerPermanent8935(id);
      const saved=JSON.parse(localStorage.getItem(KEY));
      return {ok,confirmations,absent:!state.dealers.some(d=>d.id===id),persisted:!saved.dealers.some(d=>d.id===id),history:saved.ops.some(o=>o.dealerId===id&&o.dealer==='Windows smoke dealer')};
    } finally {window.confirm=original}
  })()`);
  assert.deepEqual(deletion,{ok:true,confirmations:2,absent:true,persisted:true,history:true});
  socket.close();console.log('PASS: installed application opens, deletes dealer, persists deletion and preserves history');
 }finally{spawnSync('taskkill',['/PID',String(child.pid),'/T','/F']);}
}
main().catch(e=>{console.error(e);process.exitCode=1});
