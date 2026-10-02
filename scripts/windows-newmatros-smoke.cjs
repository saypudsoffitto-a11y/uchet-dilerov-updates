'use strict';
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawn,spawnSync}=require('node:child_process');
const assert=require('node:assert/strict');

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const expectedRuntime='8.9.68';
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
      if(ready?.ready==='complete'&&ready.runtime===expectedRuntime&&ready.groupFilter==='8.9.42'&&ready.installed)break;
      await sleep(200);
    }
    assert.equal(ready?.runtime,expectedRuntime,JSON.stringify(ready));
    assert.equal(ready?.groupFilter,'8.9.42',JSON.stringify(ready));
    assert.equal(ready?.installed,true,JSON.stringify(ready));

    const receiptFormat=await evaluate("(async()=>{\n  window.alert=()=>{};window.confirm=()=>true;\n  state.sync={enabled:false};state.dealers=[{id:1,name:'Тестовый дилер',phone:''}];state.products=[];state.groups=[];state.receiptStates={};state.receiptItemStates={};\n  const items=[];\n  for(let n=1;n<=5;n++){\n    items.push({article:'NM-MAT',name:'Потолок '+n+' · Полотно: БЕЛАЯ МАТ-303 PREMIUM · рулон 2,8 м · узкая плёнка · цена из карточки «МАТ-303»',qty:10,price:200,total:2000,unit:'м²',ceilingNo:n});\n    const qty=[2,3,5,0,0][n-1];if(qty)items.push({article:'NM-CORNER',name:'Потолок '+n+' · Дополнительные углы (с 5-го)',qty,price:50,total:qty*50,unit:'шт',ceilingNo:n});\n  }\n  const op={id:898300,ts:100,type:'sale',source:'NewMatRos',dealerId:1,dealer:'Тестовый дилер',receiptNo:1,date:'02.10.2026',total:10500,profit:0,items};state.ops=[op];\n  const before=JSON.stringify(state);\n  showReceiptFromHistory(op.id);await new Promise(resolve=>setTimeout(resolve,50));\n  const root=document.getElementById('receiptViewBody');\n  const summary=root.querySelector('[data-corner-summary]');\n  if(!summary||summary.cells[1].textContent!=='Доп. углы'||summary.cells[2].textContent!=='10 шт'||!summary.cells[4].textContent.includes('500'))throw Error('Incorrect aggregated corners');\n  if(root.querySelectorAll('tbody tr').length!==6)throw Error('Receipt must have 5 materials and 1 corners row');\n  const jpeg=buildReceiptImage8968(op,state.dealers[0]);\n  if((jpeg.match(/Доп\\. углы/g)||[]).length!==1||/Полотно:|Потолок \\d|узкая плёнка|цена из карточки/.test(jpeg))throw Error('Wrong JPEG description');\n  if(JSON.stringify(state)!==before)throw Error('Opening a receipt changed business data');\n  summary.querySelector('button').click();await new Promise(resolve=>setTimeout(resolve,50));\n  const details=[...root.querySelectorAll('.receiptCornerDetail8983')];\n  if(details.length!==3)throw Error('Corner edit details missing');\n  const second=details.find(tr=>tr.dataset.receiptItemIndex==='3');\n  const quantity=second.querySelector('input');quantity.value='4';quantity.dispatchEvent(new Event('change',{bubbles:true}));\n  await new Promise(resolve=>setTimeout(resolve,50));\n  if(op.items[3].qty!==4||op.items[1].qty!==2||op.total!==10550)throw Error('Edit targeted wrong source line');\n  const first=root.querySelector('.receiptCornerDetail8983[data-receipt-item-index=\"1\"]');\n  first.querySelector('.receiptLineDelete').click();await new Promise(resolve=>setTimeout(resolve,50));\n  const current=state.ops.find(o=>o.id===898300),rows=receiptDisplay8983.rows(current);\n  if(rows.at(-1).qty!==9||current.total!==10450||current.items.filter(i=>i.article==='NM-MAT').length!==5)throw Error('Delete targeted wrong line');\n  if(!root.querySelector('[data-corner-summary]').textContent.includes('9 шт'))throw Error('Summary did not refresh after deletion');\n  return {ok:true,materials:5,cornersBefore:10,cornersAfterEditDelete:9,totalAfterEditDelete:10450};\n})()\n");
    assert.equal(receiptFormat.ok,true);
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
