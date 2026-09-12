'use strict';
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawn,spawnSync}=require('node:child_process');
const assert=require('node:assert/strict');

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const watchdog=setTimeout(()=>{console.error('Windows group filter smoke timeout');process.exit(1)},90000);watchdog.unref();

async function main(){
  if(process.platform!=='win32')throw Error('This check must run on Windows');
  const exe=process.argv[2];
  assert.ok(exe&&fs.existsSync(exe),'Installed executable missing');

  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'uchet group filter smoke '));
  const port=19337;
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

    const result=await evaluate(`(()=>{
      const base=Date.now()+500000;
      const groupA={id:base+1,name:'СВЕТОДИОДНЫЕ ЛЕНТЫ',note:'canonical test'};
      const groupB={id:base+2,name:'  Светодиодные   ленты  ',note:'duplicate-id test'};
      const product={id:base+3,groupId:groupB.id,name:'ТЕСТОВАЯ ЛЕНТА ДЛЯ ФИЛЬТРА 8942',article:'FILTER-8942',buyPrice:10,retailPrice:100,wholesalePrice:90,unit:'шт',photo:'',archived:false};
      state.groups.push(groupA,groupB);
      state.products.push(product);

      renderSaleProductGroups();
      const normalize=window.__runtimeFix8942.normGroupName;
      const matchingOptions=[...saleProductGroup.options].filter(o=>normalize(o.textContent)==='светодиодные ленты');
      const selected=matchingOptions[0];
      if(selected)saleProductGroup.value=selected.value;
      saleProductSearch.value='';
      renderSaleProducts();
      const shownByGroup=[...saleProductList.querySelectorAll('.choiceRow')].some(r=>(r.textContent||'').includes(product.name));

      saleProductSearch.value=product.article;
      renderSaleProducts();
      const shownByArticle=[...saleProductList.querySelectorAll('.choiceRow')].some(r=>(r.textContent||'').includes(product.name));

      editProduct(product.id);
      const cardGroup=String(editPgroup.selectedOptions?.[0]?.textContent||'').trim().replace(/\s+/g,' ');
      closeProductModal();

      const directSameGroup=window.__runtimeFix8942.sameGroup(state,product.groupId,selected?.value||'');

      state.products=state.products.filter(p=>p.id!==product.id);
      state.groups=state.groups.filter(g=>g.id!==groupA.id&&g.id!==groupB.id);
      try{localStorage.setItem(KEY,JSON.stringify(state))}catch(_){}
      renderSaleProductGroups();
      renderSaleProducts();

      return {matchingOptions:matchingOptions.length,shownByGroup,shownByArticle,cardGroup,directSameGroup};
    })()`);

    assert.equal(result.matchingOptions,1,JSON.stringify(result));
    assert.equal(result.shownByGroup,true,JSON.stringify(result));
    assert.equal(result.shownByArticle,true,JSON.stringify(result));
    assert.match(result.cardGroup,/Светодиодные\s+ленты/i,JSON.stringify(result));
    assert.equal(result.directSameGroup,true,JSON.stringify(result));
    assert.doesNotMatch(output,/Uncaught Exception|runtime loader error/);
    socket.close();
    console.log('PASS: product remains visible when card group name matches selected group but stored group IDs differ');
  }finally{
    spawnSync('taskkill',['/PID',String(child.pid),'/T','/F']);
  }
}

main().catch(e=>{console.error(e);process.exitCode=1});
