'use strict';
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawn,spawnSync}=require('node:child_process');
const assert=require('node:assert/strict');

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const watchdog=setTimeout(()=>{console.error('Windows interface and archive smoke timeout');process.exit(1)},90000);watchdog.unref();

async function main(){
  if(process.platform!=='win32')throw Error('This check must run on Windows');
  const exe=process.argv[2];
  assert.ok(exe&&fs.existsSync(exe),'Installed executable missing');

  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'uchet interface archive smoke '));
  const port=19348;
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

    const command=(method,params={})=>new Promise((resolve,reject)=>{
      const id=++requestId;
      const handler=e=>{const m=JSON.parse(e.data);if(m.id!==id)return;socket.removeEventListener('message',handler);m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result)};
      socket.addEventListener('message',handler);socket.send(JSON.stringify({id,method,params}));
    });
    await sleep(7000); // Includes the last legacy merge guard installation.
    await evaluate(`newmatrosAPI.setWatch(false)`);
    await evaluate(`(()=>{
      window.confirm=()=>true;window.alert=message=>{throw Error(message)};
      state=norm({dealers:[{id:1,name:'Дилер 01',city:'Махачкала'},{id:2,name:'Дилер 02',city:'Каспийск'},{id:3,name:'Дилер 03',city:'Дербент'}],groups:[{id:1,name:'Профили'}],products:[{id:10,groupId:1,name:'Парящий профиль Fly 01',article:'FLY-01',stock:50,initialStock:52,unit:'пог. м',buyPrice:100,retailPrice:200,wholesalePrice:180}],ops:[{id:100,ts:Date.now(),type:'sale',date:new Date().toLocaleString('ru'),dealerId:1,dealer:'Дилер 01',total:400,profit:200,receiptNo:1,items:[{productId:10,name:'Парящий профиль Fly 01',qty:2,price:200,total:400,profit:200,unit:'пог. м'}]},{id:101,ts:Date.now(),type:'payment',date:new Date().toLocaleString('ru'),dealerId:1,dealer:'Дилер 01',total:100,method:'Наличные'}],receiptSeq:2});
      save();go('home');return true;
    })()`);
    const summary=await evaluate(`({version:document.documentElement.dataset.interfaceVersion,today:document.getElementById('todaySales').textContent,rows:document.querySelectorAll('#homeDealerRows tr').length})`);
    assert.equal(summary.version,'8.9.45');assert.equal(summary.today,'1');assert.equal(summary.rows,3);
    const search=await evaluate(`(()=>{homeSearch.value='02';homeSearch.dispatchEvent(new Event('input'));const n=homeDealerRows.children.length;homeSearch.value='';homeSearch.dispatchEvent(new Event('input'));return n})()`);assert.equal(search,1);
    const folder=path.resolve('qa-interface');fs.mkdirSync(folder,{recursive:true});
    async function screenshot(name,width,height){await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await sleep(200);const result=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(folder,name+'.png'),Buffer.from(result.data,'base64'))}
    await screenshot('home',1440,1000);
    const archived=await evaluate(`(()=>{window.__beforeArchive=JSON.parse(JSON.stringify(state));showReceiptFromHistory(100);const button=[...receiptViewBody.querySelectorAll('button')].find(b=>b.textContent==='Удалить чек');if(!button)throw Error('Archive button missing');button.click();return {debt:debtOf(1),stock:state.products[0].stock,archived:state.receiptStates['100'].archived,payments:state.ops.filter(o=>o.type==='payment').length}})()`);
    assert.deepEqual(archived,{debt:-100,stock:52,archived:true,payments:1});await screenshot('archive',1440,1000);
    const stale=await evaluate(`(()=>{const merged=mergeSyncState(JSON.parse(JSON.stringify(state)),JSON.parse(JSON.stringify(window.__beforeArchive)));return {sales:merged.ops.filter(o=>o.type==='sale').length,stock:merged.products[0].stock,archived:merged.receiptStates['100'].archived}})()`);assert.deepEqual(stale,{sales:0,stock:52,archived:true});
    const restored=await evaluate(`(()=>{document.querySelector('#receiptArchiveRows button').click();return {debt:debtOf(1),stock:state.products[0].stock,archived:state.receiptStates['100'].archived}})()`);assert.deepEqual(restored,{debt:300,stock:50,archived:false});
    await screenshot('receipt',1440,1000);
    await evaluate(`(()=>{closeReceiptView();go('products');return true})()`);await screenshot('products-small',1100,700);
    const scroll=await evaluate(`(()=>{const el=document.querySelector('.productTableScroll8938');el.scrollLeft=220;return el.scrollLeft})()`);assert.ok(scroll>0,'Product table must scroll horizontally');
    await evaluate(`(()=>{const b=document.createElement('div');b.id='nmLiveBanner';b.style='position:fixed;left:250px;top:78px;z-index:420';b.textContent='Новая выгрузка NewMatRos';document.body.appendChild(b);return true})()`);await sleep(100);
    const position=await evaluate(`getComputedStyle(document.getElementById('nmLiveBanner')).position`);assert.equal(position,'static');
    await evaluate(`(()=>{openDealer(1);return true})()`);await screenshot('dealer-small',1100,700);
    const topButton=await evaluate(`(()=>{const b=document.querySelector('#dealerModal .modalBox>.actions button'),r=b.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===b})()`);assert.equal(topButton,true,'Notification must not cover Close');
    await evaluate(`(()=>{closeDealerModal();go('sales');return true})()`);await screenshot('sale-small',1100,700);
    // Persistence failure must keep the original receipt, balance and stock.
    const failed=await evaluate(`(()=>{const old=Storage.prototype.setItem;const before=JSON.stringify(state);let message='';window.alert=s=>message=s;Storage.prototype.setItem=function(){throw Error('disk full')};try{archiveReceipt(100)}finally{Storage.prototype.setItem=old}return {unchanged:JSON.stringify(state)===before,error:message.includes('disk full')}})()`);assert.deepEqual(failed,{unchanged:true,error:true});
    assert.doesNotMatch(output,/Uncaught Exception|runtime loader error/);
    socket.close();
    console.log('PASS: Windows dashboard, search, archive/restore, debt, inventory, stale sync, failed persistence, small-screen scrolling and unobstructed close button');
  }finally{spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'])}
}
main().catch(e=>{console.error(e);process.exitCode=1});
