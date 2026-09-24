'use strict';
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawn,spawnSync}=require('node:child_process');
const assert=require('node:assert/strict');

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const expected=require('../app/package.json').version;
const watchdog=setTimeout(()=>{console.error('Windows product-create smoke timeout');process.exit(1)},70000);watchdog.unref();

async function main(){
  if(process.platform!=='win32')throw Error('This check must run on Windows');
  const exe=process.argv[2];
  assert.ok(exe&&fs.existsSync(exe),'Installed executable missing');
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'uchet product create smoke '));
  const port=19371;
  const child=spawn(exe,[`--remote-debugging-port=${port}`],{env:{...process.env,APPDATA:path.join(tmp,'roaming'),LOCALAPPDATA:path.join(tmp,'local')},stdio:'pipe'});
  let output='';child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);
  try{
    let page;
    for(let i=0;i<180;i++){
      if(child.exitCode!==null)throw Error('Installed application exited: '+output);
      try{const pages=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();page=pages.find(p=>p.type==='page'&&p.url.startsWith('file:'));if(page)break}catch{}
      await sleep(200);
    }
    assert.ok(page,'Renderer not found: '+output);
    const socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise((res,rej)=>{socket.onopen=res;socket.onerror=rej});
    let rid=0;
    const evaluate=expression=>new Promise((resolve,reject)=>{
      const id=++rid;const handler=e=>{const m=JSON.parse(e.data);if(m.id!==id)return;socket.removeEventListener('message',handler);if(m.result?.exceptionDetails)reject(Error(JSON.stringify(m.result.exceptionDetails)));else resolve(m.result?.result?.value)};
      socket.addEventListener('message',handler);socket.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,returnByValue:true,awaitPromise:true}}));
    });
    let ready;
    for(let i=0;i<180;i++){
      try{ready=await evaluate(`({ready:document.readyState,runtime:document.documentElement.dataset.uchetRuntime||'',fix:document.documentElement.dataset.productCreateFix||''})`)}catch{ready=null}
      if(ready?.ready==='complete'&&ready.runtime===expected&&ready.fix==='8.9.71')break;
      await sleep(200);
    }
    assert.deepEqual(ready,{ready:'complete',runtime:expected,fix:'8.9.71'});
    const pin=await evaluate(`(async()=>{if(window.__pinLock8948){if(!window.__pinLock8948.isConfigured())await window.__pinLock8948.setInitialPin('2468','2468');else if(!window.__pinLock8948.isUnlocked())await window.__pinLock8948.unlock('2468')}return !document.getElementById('appPinLock8948')})()`);assert.equal(pin,true);

    const local=await evaluate(`(async()=>{
      state=norm({dealers:[],groups:[],products:[],ops:[],receiptSeq:1,sync:{enabled:false,url:'',token:'',interval:5,revision:0}});localStorage.setItem(KEY,JSON.stringify(state));render();go('products');
      pname.value='Тестовый товар без группы';particle.value='TEST-8971';pbuy.value='';pretail.value='';pwholesale.value='';pgroup.value='';productListSearch.value='старый поиск';
      await addProduct();
      const p=state.products.find(x=>x.article==='TEST-8971');
      return {count:state.products.length,name:p?.name||'',groupId:p?.groupId,retail:p?.retailPrice,wholesale:p?.wholesalePrice,visible:productRows.textContent.includes('Тестовый товар без группы'),search:productListSearch.value,status:document.getElementById('productCreateStatus8971')?.textContent||''};
    })()`);
    assert.equal(local.count,1);assert.equal(local.name,'Тестовый товар без группы');assert.equal(local.groupId,0);assert.equal(local.retail,0);assert.equal(local.wholesale,0);assert.equal(local.visible,true);assert.equal(local.search,'');assert.match(local.status,/создан/);

    const syncRetry=await evaluate(`(async()=>{
      state=norm({dealers:[],groups:[],products:[],ops:[],receiptSeq:1,sync:{enabled:true,url:'https://example.invalid',token:'x',interval:5,revision:0}});localStorage.setItem(KEY,JSON.stringify(state));render();go('products');
      let calls=0;const old=window.masterSync8962;window.masterSync8962={push:async()=>{calls++;if(calls===1){state.products=[];localStorage.setItem(KEY,JSON.stringify(state));render();return false}return true}};
      pname.value='Товар после первого pull';particle.value='SYNC-8971';pgroup.value='';pretail.value='100';pwholesale.value='90';
      await addProduct();await new Promise(r=>setTimeout(r,500));
      const p=state.products.find(x=>x.article==='SYNC-8971');window.masterSync8962=old;
      return {calls,exists:!!p,price:p?.retailPrice,status:document.getElementById('productCreateStatus8971')?.textContent||''};
    })()`);
    assert.ok(syncRetry.calls>=2,`Expected a retry after the first pull, got ${syncRetry.calls} sync call(s)`);
    assert.equal(syncRetry.exists,true,'Product disappeared after first sync pull');
    assert.equal(syncRetry.price,100,'Product price changed during first sync pull');
    assert.equal(syncRetry.status,'Товар «Товар после первого pull» создан и отправлен на сервер.');
    assert.doesNotMatch(output,/runtime loader error|Uncaught Exception/);
    socket.close();
    console.log('PASS: 8.9.71 creates products without a group and restores them after first-sync pull');
  }finally{spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'])}
}
main().catch(e=>{console.error(e);process.exitCode=1});
