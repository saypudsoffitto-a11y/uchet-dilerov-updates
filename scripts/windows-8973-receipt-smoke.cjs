'use strict';
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawn,spawnSync}=require('node:child_process');
const assert=require('node:assert/strict');

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const exe=process.argv[2];
if(process.platform!=='win32')throw Error('This smoke test must run on Windows');
assert.ok(exe&&fs.existsSync(exe),'Application executable missing');

async function main(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'uchet-8973-receipt-'));
  const port=19353;
  const child=spawn(exe,[`--remote-debugging-port=${port}`],{
    env:{...process.env,APPDATA:path.join(tmp,'roaming'),LOCALAPPDATA:path.join(tmp,'local')},
    stdio:'pipe'
  });
  let output='';
  child.stdout.on('data',x=>output+=x);
  child.stderr.on('data',x=>output+=x);
  try{
    let page=null;
    for(let i=0;i<100;i++){
      if(child.exitCode!==null)throw Error('Application exited before renderer opened: '+output);
      try{
        const pages=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        page=pages.find(p=>p.type==='page'&&String(p.url||'').startsWith('file:'))||null;
        if(page)break;
      }catch{}
      await sleep(200);
    }
    assert.ok(page,'Renderer did not open');

    const socket=new WebSocket(page.webSocketDebuggerUrl);
    await Promise.race([
      new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject}),
      new Promise((_,reject)=>setTimeout(()=>reject(Error('WebSocket open timeout')),8000))
    ]);
    let id=0;
    const evaluate=(expression,timeout=8000)=>Promise.race([
      new Promise((resolve,reject)=>{
        const req=++id;
        const handler=e=>{
          const m=JSON.parse(e.data);if(m.id!==req)return;
          socket.removeEventListener('message',handler);
          if(m.result?.exceptionDetails)reject(Error(JSON.stringify(m.result.exceptionDetails)));
          else resolve(m.result?.result?.value);
        };
        socket.addEventListener('message',handler);
        socket.send(JSON.stringify({id:req,method:'Runtime.evaluate',params:{expression,returnByValue:true,awaitPromise:true}}));
      }),
      new Promise((_,reject)=>setTimeout(()=>reject(Error('Runtime.evaluate timeout')),timeout))
    ]);

    let ready=null;
    for(let i=0;i<80;i++){
      try{ready=await evaluate(`({ready:document.readyState,runtime:document.documentElement.dataset.uchetRuntime||'',interfaceVersion:document.documentElement.dataset.interfaceVersion||'',nameEdit:typeof window.editReceiptItemName8973==='function',manual:typeof window.openReceiptManualAdd8973==='function'})`,3000)}catch{ready=null}
      if(ready?.ready==='complete'&&ready.runtime==='8.9.73'&&ready.interfaceVersion==='8.9.73'&&ready.nameEdit&&ready.manual)break;
      await sleep(200);
    }
    assert.deepEqual(ready,{ready:'complete',runtime:'8.9.73',interfaceVersion:'8.9.73',nameEdit:true,manual:true});

    await evaluate(`(()=>{
      window.alert=message=>{throw Error(String(message))};
      state=norm({dealers:[{id:1,name:'Тестовый дилер'}],groups:[{id:1,name:'Свет'}],products:[{id:10,groupId:1,name:'Светильник',article:'SV-10',unit:'шт',stock:10,initialStock:10,buyPrice:50,retailPrice:100,wholesalePrice:90}],ops:[{id:100,ts:Date.now(),type:'sale',date:new Date().toLocaleString('ru'),dealerId:1,dealer:'Тестовый дилер',receiptNo:1,total:200,profit:100,items:[{productId:10,name:'Светильник',qty:2,price:100,buyPrice:50,total:200,profit:100,unit:'шт'}]}],receiptSeq:2});
      save();
      const old=document.getElementById('smokeReceipt8973');if(old)old.remove();
      const root=document.createElement('section');root.id='smokeReceipt8973';root.dataset.receiptOpId='100';
      root.innerHTML='<div class="receiptEditHelp"></div><div class="actions"></div><table><thead><tr><th>№</th><th>Наименование</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead><tbody><tr><td>1</td><td>Светильник</td><td><input class="receiptEditInput" value="2"></td><td><input class="receiptEditInput" value="100"></td><td>200</td></tr></tbody></table>';
      document.body.appendChild(root);
      return true;
    })()`);
    await sleep(700);

    const decorated=await evaluate(`(()=>{
      const root=document.getElementById('smokeReceipt8973'),row=root.querySelector('tbody tr');
      const name=row.querySelector('input.receiptNameInput8973:not(.receiptNameGuard8973)');
      const qty=row.children[2].querySelector('input.receiptEditInput');
      const price=row.children[3].querySelector('input.receiptEditInput');
      return {
        headers:[...root.querySelectorAll('thead th')].map(x=>x.textContent.trim()),
        nameColumn:[...row.children].findIndex(td=>td.contains(name)),
        name:name?.value||'',qty:qty?.value||'',price:price?.value||'',
        guard:!!row.children[2].querySelector('.receiptNameGuard8973'),
        manualButton:!!root.querySelector('.manualReceiptBtn8973'),
        help:root.querySelector('.receiptEditHelp')?.textContent||''
      };
    })()`);
    assert.deepEqual(decorated.headers,['№','Наименование','Кол-во','Цена','Сумма']);
    assert.equal(decorated.nameColumn,1,'Editable name must stay in Наименование column');
    assert.equal(decorated.name,'Светильник');
    assert.equal(decorated.qty,'2','Quantity must not be overwritten by name editor');
    assert.equal(decorated.price,'100');
    assert.equal(decorated.guard,true,'Quantity guard missing');
    assert.equal(decorated.manualButton,true,'Manual item button missing');
    assert.match(decorated.help,/Название, количество и цену/);

    const renamed=await evaluate(`(()=>{window.editReceiptItemName8973(100,0,'Светильник дизайнерский');const op=state.ops.find(x=>x.id===100);return {name:op.items[0].name,total:op.total,profit:op.profit}})()`);
    assert.deepEqual(renamed,{name:'Светильник дизайнерский',total:200,profit:100});

    const manualOpen=await evaluate(`(()=>{window.openReceiptManualAdd8973(100);const m=document.getElementById('manualReceiptModal8973');return {exists:!!m,visible:!!m&&!m.classList.contains('hidden'),save:!!document.getElementById('manualReceiptSave8973')}})()`);
    assert.deepEqual(manualOpen,{exists:true,visible:true,save:true});
    const manualSaved=await evaluate(`(()=>{
      document.getElementById('manualReceiptName8973').value='Монтаж световой линии';
      document.getElementById('manualReceiptQty8973').value='3';
      document.getElementById('manualReceiptUnit8973').value='м';
      document.getElementById('manualReceiptPrice8973').value='250';
      document.getElementById('manualReceiptSave8973').click();
      const op=state.ops.find(x=>x.id===100),item=op.items[1];
      return {count:op.items.length,total:op.total,name:item?.name,qty:item?.qty,unit:item?.unit,price:item?.price,lineTotal:item?.total,manual:item?.manualEntry,tracked:item?.stockTracked,modalHidden:document.getElementById('manualReceiptModal8973').classList.contains('hidden')};
    })()`);
    assert.deepEqual(manualSaved,{count:2,total:950,name:'Монтаж световой линии',qty:3,unit:'м',price:250,lineTotal:750,manual:true,tracked:false,modalHidden:true});

    const productCompact=await evaluate(`(()=>{
      if(typeof go==='function')go('products');
      const table=document.querySelector('#products .productTable');if(!table)return null;
      const headers=[...table.querySelectorAll('thead th')];
      const group=headers.find(x=>x.textContent.trim()==='Группа'),article=headers.find(x=>x.textContent.trim()==='Артикул');
      return {groupClass:!!group?.classList.contains('compactGroup8973'),articleClass:!!article?.classList.contains('compactArticle8973'),groupWidth:group?getComputedStyle(group).width:'',articleWidth:article?getComputedStyle(article).width:''};
    })()`);
    assert.ok(productCompact,'Product table missing');
    assert.equal(productCompact.groupClass,true,'Group compact class missing');
    assert.equal(productCompact.articleClass,true,'Article compact class missing');

    socket.close();
    assert.doesNotMatch(output,/Uncaught Exception|runtime loader error/i);
    console.log('PASS: 8.9.73 packaged runtime edits receipt names, protects quantity column, adds manual items and keeps compact product columns');
  }finally{
    try{spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore'})}catch{}
  }
}

const timer=setTimeout(()=>{console.error('8.9.73 receipt smoke global timeout');process.exit(1)},45000);timer.unref();
main().then(()=>{clearTimeout(timer)}).catch(e=>{clearTimeout(timer);console.error(e);process.exitCode=1});
