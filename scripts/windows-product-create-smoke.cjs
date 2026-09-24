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
      if(ready?.ready==='complete'&&ready.runtime===expected&&ready.fix==='8.9.72')break;
      await sleep(200);
    }
    assert.deepEqual(ready,{ready:'complete',runtime:expected,fix:'8.9.72'});
    const pin=await evaluate(`(async()=>{if(window.__pinLock8948){if(!window.__pinLock8948.isConfigured())await window.__pinLock8948.setInitialPin('2468','2468');else if(!window.__pinLock8948.isUnlocked())await window.__pinLock8948.unlock('2468')}return !document.getElementById('appPinLock8948')})()`);assert.equal(pin,true);

    const local=await evaluate(`(async()=>{
      state=norm({dealers:[],groups:[],products:[],ops:[],receiptSeq:1,sync:{enabled:false,url:'',token:'',interval:5,revision:0}});localStorage.setItem(KEY,JSON.stringify(state));render();go('products');
      pname.value='Тестовый товар без группы';particle.value='TEST-8971';pbuy.value='';pretail.value='';pwholesale.value='';pgroup.value='';productListSearch.value='старый поиск';
      await addProduct();
      const p=state.products.find(x=>x.article==='TEST-8971');
      return {count:state.products.length,name:p?.name||'',groupId:p?.groupId,retail:p?.retailPrice,wholesale:p?.wholesalePrice,visible:productRows.textContent.includes('Тестовый товар без группы'),search:productListSearch.value,status:document.getElementById('productCreateStatus8971')?.textContent||''};
    })()`);
    assert.equal(local.count,1);assert.equal(local.name,'Тестовый товар без группы');assert.equal(local.groupId,0);assert.equal(local.retail,0);assert.equal(local.wholesale,0);assert.equal(local.visible,true);assert.equal(local.search,'');assert.match(local.status,/создан/);

    const live=await evaluate(`(async()=>{
      const oldRequest=syncRequest;
      const url='https://example.invalid';
      state=norm({dealers:[],groups:[],products:[{id:1,name:'Полотно BAUF',retailPrice:180,wholesalePrice:180}],ops:[],receiptSeq:1,sync:{enabled:true,url,token:'x',interval:5,revision:1}});
      let remote=JSON.parse(JSON.stringify(state));
      localStorage.setItem(KEY,JSON.stringify(state));
      localStorage.setItem('uchet_sync_baseline_8962:'+url,JSON.stringify({state:remote,revision:1}));
      const device=masterSync8962.device;
      let release,enteredResolve,first=true;const entered=new Promise(r=>enteredResolve=r);
      syncRequest=async(method,body)=>{
        if(method==='GET'&&first){first=false;enteredResolve();await new Promise(r=>release=r)}
        if(method==='PUT'&&body.catalog)remote={...remote,...JSON.parse(JSON.stringify(body.catalog))};
        return {ok:true,protocol:2,storage:'turso',revision:2,state:JSON.parse(JSON.stringify(remote)),computers:{masterId:device.id,devices:{[device.id]:{name:device.name}}}};
      };
      try{
        render();go('products');
        const pulling=masterSync8962.pull(true);await entered;
        pname.value='ПРИЩЕПКА ДЛЯ МОНТАЖА';particle.value='SYNC-8972';pgroup.value='';pretail.value='100';pwholesale.value='90';
        await addProduct();const immediate=productRows.textContent.includes('ПРИЩЕПКА ДЛЯ МОНТАЖА');
        release();await pulling;await masterSync8962.push(true);
        productListSearch.value='ПРИЩЕ';renderProducts();
        const searched=productRows.textContent.includes('ПРИЩЕПКА ДЛЯ МОНТАЖА');
        editProduct(1);editPretail.value='85';editPwholesale.value='85';saveProductEdit();
        await masterSync8962.push(true);await masterSync8962.pull(true);
        editProduct(1);const reopened=Number(editPretail.value);closeProductModal();
        return {immediate,searched,reopened,stored:JSON.parse(localStorage.getItem(KEY)).products.find(p=>p.id===1)?.retailPrice,remotePrice:remote.products.find(p=>p.id===1)?.retailPrice,remoteCreated:remote.products.some(p=>p.article==='SYNC-8972')};
      }finally{state.sync.enabled=false;syncRequest=oldRequest;}
    })()`);
    assert.deepEqual(live,{immediate:true,searched:true,reopened:85,stored:85,remotePrice:85,remoteCreated:true});
    assert.doesNotMatch(output,/runtime loader error|Uncaught Exception/);
    socket.close();
    console.log('PASS: created products and price 85 survive actual queued pull/push and reopening');
  }finally{spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'])}
}
main().catch(e=>{console.error(e);process.exitCode=1});
