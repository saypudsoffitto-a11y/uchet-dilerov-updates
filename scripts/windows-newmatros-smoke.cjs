'use strict';
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawn,spawnSync}=require('node:child_process');
const assert=require('node:assert/strict');

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const watchdog=setTimeout(()=>{console.error('Windows NewMatRos recovery smoke timeout');process.exit(1)},90000);watchdog.unref();

async function main(){
  if(process.platform!=='win32')throw Error('This check must run on Windows');
  const exe=process.argv[2];
  assert.ok(exe&&fs.existsSync(exe),'Installed executable missing');

  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'uchet NewMatRos recovery smoke '));
  const port=19338;
  const child=spawn(exe,[`--remote-debugging-port=${port}`],{
    env:{...process.env,APPDATA:path.join(tmp,'roaming'),LOCALAPPDATA:path.join(tmp,'local')},
    stdio:'pipe'
  });
  let output='';
  child.stderr.on('data',x=>output+=x);
  child.stdout.on('data',x=>output+=x);

  try{
    let page;
    for(let i=0;i<180;i++){
      if(child.exitCode!==null)throw Error('Installed application exited: '+output);
      try{
        const pages=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        page=pages.find(p=>p.type==='page'&&p.url.startsWith('file:'));
        if(page)break;
      }catch{}
      await sleep(200);
    }
    assert.ok(page,'Installed application did not open a renderer: '+output);

    const socket=new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject});
    let requestId=0;
    const evaluate=expression=>new Promise((resolve,reject)=>{
      const id=++requestId;
      const handler=e=>{
        const m=JSON.parse(e.data);
        if(m.id!==id)return;
        socket.removeEventListener('message',handler);
        if(m.result?.exceptionDetails)reject(Error(JSON.stringify(m.result.exceptionDetails)));
        else resolve(m.result?.result?.value);
      };
      socket.addEventListener('message',handler);
      socket.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,returnByValue:true,awaitPromise:true}}));
    });

    let ready;
    for(let i=0;i<180;i++){
      try{
        ready=await evaluate(`(()=>({ready:document.readyState,runtime:document.documentElement?.dataset?.uchetRuntime||'',groupFilter:document.documentElement?.dataset?.groupFilterFix||'',installed:!!window.__runtimeFix8942Installed}))()`);
      }catch{ready=null}
      if(ready?.ready==='complete'&&ready.runtime==='8.9.42'&&ready.groupFilter==='8.9.42'&&ready.installed)break;
      await sleep(200);
    }
    assert.equal(ready?.runtime,'8.9.42',JSON.stringify(ready));
    assert.equal(ready?.groupFilter,'8.9.42',JSON.stringify(ready));
    assert.equal(ready?.installed,true,JSON.stringify(ready));

    const nmFolder='C:\\NewMatRos Standart';
    fs.mkdirSync(nmFolder,{recursive:true});
    const fileName='codex-newmatros-'+process.pid+'.ini';
    const ini=index=>'[Заказ]\nНомерРасчета=8944\nИндексПотолка='+index+'\nКонтрагент=ТЕСТ NEWMATROS 8944\nМатериалМатериал=МАТ-303 PREMIUM\nКоличествоПродукция=10\nШиринаПолотна=380';
    const file=path.join(nmFolder,fileName);
    try{
      fs.writeFileSync(file,ini(1),'utf8');
      await evaluate(`(()=>{
        state.dealers=[{id:894401,name:'ТЕСТ NEWMATROS 8944',phone:''}];
        state.products=[{id:894402,name:'МАТ-303 PREMIUM 380-500',retailPrice:200,wholesalePrice:190,groupId:1}];
        state.groups=[{id:1,name:'Полотно'}];state.ops=[];state.receiptSeq=1;
        state.newmatros.watching=false;state.sync={enabled:false};
        localStorage.setItem(KEY,JSON.stringify(state));
        localStorage.setItem('uchetNewMatRosOpenSale8926',JSON.stringify({version:1,createdAt:100,dealerId:null,dealerName:'Дилер NewMatRos',ceilings:[{key:'fallback|||||0|0|0',fileName:${JSON.stringify(fileName)},dealerId:null,area:0,width:0,items:[],total:0,materialPrice:0}]}));
        setTimeout(()=>location.reload(),0);return true;
      })()`);
      let recovered;
      for(let i=0;i<150;i++){
        await sleep(200);
        try{recovered=await evaluate(`JSON.parse(localStorage.getItem('uchetNewMatRosOpenSale8926')||'null')`)}catch{}
        if(recovered?.ceilings?.[0]?.total===2000)break;
      }
      assert.equal(recovered?.dealerId,894401,JSON.stringify(recovered));
      assert.equal(recovered?.ceilings?.[0]?.total,2000,JSON.stringify(recovered));
      const watch=await evaluate(`newmatrosAPI.setWatch(true)`);
      assert.equal(watch?.ok,true,JSON.stringify(watch));
      fs.writeFileSync(file,ini(2),'utf8');
      let draft;
      for(let i=0;i<100;i++){
        await sleep(200);
        draft=await evaluate(`JSON.parse(localStorage.getItem('uchetNewMatRosOpenSale8926')||'null')`);
        if(draft?.ceilings?.length===2)break;
      }
      assert.equal(draft?.ceilings?.length,2,JSON.stringify(draft));
      assert.deepEqual(draft.ceilings.map(c=>c.materialPrice),[200,200]);
      const posted=await evaluate(`(()=>{
        window.confirm=()=>true;window.alert=()=>{};
        document.getElementById('nmDraftFinish8926').click();
        return {ops:state.ops.map(o=>({total:o.total,dealerId:o.dealerId,keys:o.newmatrosKeys})),draft:localStorage.getItem('uchetNewMatRosOpenSale8926')};
      })()`);
      assert.equal(posted.ops.length,1,JSON.stringify(posted));
      assert.equal(posted.ops[0].total,4000,JSON.stringify(posted));
      assert.equal(posted.ops[0].dealerId,894401,JSON.stringify(posted));
      assert.equal(posted.ops[0].keys.length,2,JSON.stringify(posted));
      assert.equal(posted.draft,null,JSON.stringify(posted));
      await evaluate(`newmatrosAPI.setWatch(false)`);
    }finally{fs.rmSync(file,{force:true})}

    assert.doesNotMatch(output,/Uncaught Exception|runtime loader error/);
    socket.close();
    console.log('PASS: installed Windows application recovers the original INI, appends a second export and posts one receipt for the correct dealer');
  }finally{
    spawnSync('taskkill',['/PID',String(child.pid),'/T','/F']);
  }
}

main().catch(e=>{console.error(e);process.exitCode=1});
