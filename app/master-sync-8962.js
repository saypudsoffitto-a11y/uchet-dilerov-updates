(()=>{
  'use strict';
  const C=window.SyncCore8962;
  const DEVICE='uchet_device_8962';
  const OLD_SERVER='https://uchet-dilerov-sync.onrender.com';
  const TURSO_SERVER='https://uchet-dilerov-sync-8963-test.onrender.com';
  try{
    const current=String(state?.sync?.url||'').trim().replace(/\/+$/,'');
    if(current===OLD_SERVER){
      state.sync.url=TURSO_SERVER;
      state.sync.revision=0;
      localStorage.setItem(KEY,JSON.stringify(state));
    }
  }catch(_){}
  let device;
  try{device=JSON.parse(localStorage.getItem(DEVICE)||'null')}catch(_){}
  if(!device?.id){device={id:crypto.randomUUID(),name:'Компьютер '+crypto.randomUUID().slice(0,4)};localStorage.setItem(DEVICE,JSON.stringify(device));}
  let busy=false,meta=null,online=false;
  const key=()=> 'uchet_sync_baseline_8962:'+String(syncCfg().url||'');
  const recoveryKey=()=> 'uchet_before_master_8962:'+String(syncCfg().url||'');
  const readBaseline=()=>{try{return JSON.parse(localStorage.getItem(key())||'null')}catch(_){return null}};
  const status=text=>{const el=document.getElementById('syncStatus');if(el)el.textContent=text;paint();};
  function paint(){
    const role=meta?.masterId===device.id?'Главный':meta?.masterId?'Рабочий':'Роль не выбрана';
    const badge=document.getElementById('computerBadge8962');if(badge)badge.textContent=device.name+' · '+role+' · '+(online?'связь есть':'нет связи');
    const master=document.getElementById('masterName8962');if(master)master.textContent=meta?.masterId?'Главный: '+(meta.devices?.[meta.masterId]?.name||'компьютер'):'Выберите главный компьютер там, где правильные дилеры и товары.';
    const claim=document.getElementById('claimMaster8962');if(claim)claim.hidden=!!meta?.masterId;
    const transfer=document.getElementById('transferMaster8962');if(transfer)transfer.hidden=meta?.masterId!==device.id;
    const select=document.getElementById('computerTarget8962');if(select){const selected=select.value;select.innerHTML='';for(const [id,d] of Object.entries(meta?.devices||{})){if(id===device.id)continue;const option=document.createElement('option');option.value=id;option.textContent=d.name;select.appendChild(option);}select.value=selected||select.options[0]?.value||'';select.hidden=meta?.masterId!==device.id;}
    const recovery=document.getElementById('recovery8962');if(recovery)recovery.hidden=!localStorage.getItem(recoveryKey());
  }
  async function request(method,body){
    const r=await syncRequest(method,body);
    if(r?.conflict)return r;
    if(!r?.ok)throw new Error(r?.message||'Нет ответа сервера');
    if(r.protocol!==2)throw new Error('Сервер ещё не обновлён для главного компьютера. Данные сохранены локально.');
    if(r.storage!=='turso')throw new Error('Сервер ещё не подключён к постоянной базе Turso. Локальные данные не отправлены.');
    meta=r.computers;
    const serverName=meta?.devices?.[device.id]?.name;
    if(serverName&&serverName!==device.name){device.name=serverName;localStorage.setItem(DEVICE,JSON.stringify(device));const input=document.getElementById('computerName8962');if(input)input.value=device.name;}
    online=true;
    return r;
  }
  function pending(){const base=readBaseline();return base?C.diffOps(base.state.ops,state.ops):[];}
  function accept(r,changes,archives){
    const local=state;
    const merged=C.applyTransaction(r.state||{},changes||[],archives);
    // Only locally edited master catalog fields overlay a fresh server snapshot.
    const base=readBaseline();
    if(meta?.masterId===device.id&&base&&!C.same(C.definitions(base.state),C.definitions(local)))Object.assign(merged,C.catalog(local));
    merged.sync={...local.sync,revision:r.revision};merged.update=local.update;merged.newmatros=local.newmatros;
    // Save the baseline before replacing the visible state; failed writes abort.
    localStorage.setItem(key(),JSON.stringify({state:r.state,revision:r.revision,masterId:meta?.masterId}));
    localStorage.setItem(KEY,JSON.stringify(merged));state=norm(merged);
    render();paint();
  }
  async function backup(){
    const data=JSON.stringify(state);
    localStorage.setItem(recoveryKey(),data);
    if(window.updateAPI?.saveBackup){const result=await window.updateAPI.saveBackup(data);if(!result?.ok)throw new Error('Не удалось сохранить резервную копию: '+(result?.message||''));}
  }
  async function pull(manual){
    if(busy||!syncCfg().url)return false;busy=true;
    try{
      const r=await request('GET');
      if(!meta?.masterId){status('Связь есть. Выберите главный компьютер. Отправка старых списков приостановлена.');return true;}
      const baseline=readBaseline();
      if(meta.masterId===device.id&&baseline&&!C.same(C.definitions(baseline.state),C.definitions(state))){status('Есть изменения справочника на главном компьютере. Нажмите «Отправить на сервер».');return true;}
      let firstJoinChanges=null,firstJoinDuplicates=0;
      if(!baseline){
        // First join must load the shared server state, but must never destroy
        // local receipts/payments. Save a full recovery copy first, then layer
        // genuinely local-only operations on top of the server snapshot.
        if(!localStorage.getItem(recoveryKey()))await backup();

        const stableValue=v=>{
          if(v===null||v===undefined)return v??null;
          if(Array.isArray(v))return v.map(stableValue);
          if(typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stableValue(v[k])]));
          return v;
        };
        const opSignature=op=>{
          const copy=C.clone(op||{});
          delete copy.id;
          return JSON.stringify(stableValue(copy));
        };
        const remoteOps=new Map((r.state?.ops||[]).map(op=>[C.id(op.id),op]));
        const remoteSignatures=new Set((r.state?.ops||[]).map(opSignature));
        const additions=[],conflicts=[];
        for(const op of state.ops||[]){
          const opId=C.id(op.id),remote=remoteOps.get(opId);
          if(remote){
            if(!C.same(op,remote))conflicts.push(op);
            continue;
          }
          if(remoteSignatures.has(opSignature(op))){
            firstJoinDuplicates++;
            continue;
          }
          additions.push({id:opId,before:null,after:C.clone(op)});
        }
        if(conflicts.length){
          status('Подключение приостановлено: '+conflicts.length+' операций имеют одинаковый номер, но разные данные. Локальная база сохранена отдельно; серверные данные не перезаписаны.');
          return false;
        }
        firstJoinChanges=additions;
      }
      // Re-read edits after any awaited backup, immediately before accepting.
      const changes=firstJoinChanges||pending(),archives=C.diffArchives(readBaseline()?.state||{},state);
      accept(r,changes,readBaseline()?archives:{});
      if(!meta.devices?.[device.id]||meta.devices[device.id].name!==device.name){
        const registered=await request('PUT',{protocol:2,action:'register',device,baseRevision:r.revision});
        if(!registered.conflict)accept(registered,pending(),C.diffArchives(readBaseline().state,state));
      }
      status('Подключено · база '+state.sync.revision+(changes.length?' · есть неотправленные операции':'')+(!baseline?' · прежняя локальная база сохранена отдельно; доступна кнопка скачивания':''));return true;
    }catch(e){online=false;status(e.message);return false;}finally{busy=false;}
  }
  async function push(manual){
    if(busy||!syncCfg().url||(!manual&&!syncCfg().enabled))return false;
    if(!readBaseline()){await pull(true);return false;}
    busy=true;
    try{
      const base=readBaseline(),changes=pending(),catalogChanged=!C.same(C.definitions(base.state),C.definitions(state)),archives=C.diffArchives(base.state,state);
      const expected=C.applyTransaction(base.state,changes,archives);
      const stockOverrides=(state.products||[]).flatMap(p=>{const old=base.state.products?.find(x=>C.id(x.id)===C.id(p.id)),e=expected.products?.find(x=>C.id(x.id)===C.id(p.id));return old&&e&&Number(p.stock)!==Number(e.stock)?[{id:C.id(p.id),before:Number(old.stock)||0,after:(Number(old.stock)||0)+Number(p.stock)-Number(e.stock)}]:[];});
      const r=await request('GET');
      if(!meta?.masterId)throw new Error('Выберите главный компьютер.');
      if(catalogChanged&&meta.masterId!==device.id){
        await backup();Object.assign(state,C.catalog(r.state));localStorage.setItem(KEY,JSON.stringify(state));render();
        status('Изменения справочника сохранены в локальной копии. Дилеры и товары редактируются на главном компьютере.');
      }
      // Three-way operation conflict detection; no silent last-writer-wins.
      C.applyTransaction(r.state,changes,archives);
      if(catalogChanged&&meta.masterId===device.id&&!C.same(C.definitions(base.state),C.definitions(r.state)))throw new Error('Справочник на сервере изменился. Локальные изменения сохранены; требуется сверка.');
      const payload={protocol:2,action:'changes',device,baseRevision:r.revision,changes,archives};
      if(meta.masterId===device.id)payload.stockOverrides=stockOverrides;
      if(catalogChanged&&meta.masterId===device.id)payload.catalog=C.catalog(state);
      const sentState=C.clone(state),sentOps=sentState.ops,sentCatalog=C.catalog(state);
      const result=await request('PUT',payload);
      if(result.conflict)throw new Error('База изменилась во время отправки. Изменения сохранены; повторите синхронизацию.');
      const duringFlight=C.diffOps(sentOps,state.ops);
      // Do not restore the just-acknowledged catalog as an unsent edit.
      localStorage.setItem(key(),JSON.stringify({state:{...result.state,...sentCatalog},revision:result.revision}));
      accept(result,duringFlight,C.diffArchives(sentState,state));
      status('Синхронизировано · база '+result.revision);return true;
    }catch(e){online=false;status(e.message);return false;}finally{busy=false;}
  }
  async function claim(){
    if(busy)return;busy=true;
    try{
      const r=await request('GET');
      if(meta?.masterId)throw new Error('Главный компьютер уже назначен.');
      if(!confirm('Сделать «'+device.name+'» главным? Его список станет основным: '+state.dealers.length+' дилеров, '+state.products.length+' товаров. Будет создана резервная копия.'))return;
      await backup();
      const result=await request('PUT',{protocol:2,action:'claim',device,baseRevision:r.revision,state:C.clone(state)});
      if(result.conflict)throw new Error('База изменилась. Повторите выбор главного компьютера.');
      localStorage.removeItem(key());accept(result,[]);status('Этот компьютер — главный. Остальные получат его справочники.');
    }catch(e){status(e.message);}finally{busy=false;}
  }
  async function transfer(){
    if(busy)return;const targetId=document.getElementById('computerTarget8962').value;if(!targetId)return;
    if(!await push(true))return;
    if(!confirm('Передать роль главного компьютеру «'+meta.devices[targetId].name+'»? Текущий общий справочник сохранится.'))return;
    busy=true;
    try{const r=await request('GET');const result=await request('PUT',{protocol:2,action:'transfer',device,targetId,baseRevision:r.revision});if(result.conflict)throw new Error('База изменилась. Повторите передачу роли.');accept(result,pending(),C.diffArchives(readBaseline().state,state));status('Главный компьютер изменён.');}catch(e){status(e.message);}finally{busy=false;}
  }
  const host=document.getElementById('sync');
  if(host){
    const box=document.createElement('div');box.className='card';
    box.innerHTML='<h3>Этот компьютер</h3><label>Название<input id="computerName8962" maxlength="80"></label><p id="masterName8962"></p><div class="actions"><button id="claimMaster8962" class="primary">Сделать главным</button><select id="computerTarget8962" hidden></select><button id="transferMaster8962" hidden>Передать роль главного</button><button id="recovery8962" hidden>Скачать сохранённую локальную базу</button></div><p class="muted">Главный управляет дилерами и товарами. Продажи и оплаты доступны на всех компьютерах. При первом подключении прежняя локальная база сохраняется отдельно для сверки.</p>';
    host.prepend(box);
    document.getElementById('computerName8962').value=device.name;
    document.getElementById('computerName8962').onchange=e=>{device.name=e.target.value.trim()||device.name;localStorage.setItem(DEVICE,JSON.stringify(device));paint();};
    document.getElementById('claimMaster8962').onclick=claim;document.getElementById('transferMaster8962').onclick=transfer;
    document.getElementById('recovery8962').onclick=()=>{const url=URL.createObjectURL(new Blob([localStorage.getItem(recoveryKey())],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='Uchet-before-master.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  }
  const badge=document.createElement('button');badge.id='computerBadge8962';badge.className='secondary';badge.onclick=()=>go('sync');document.querySelector('header .actions')?.prepend(badge);
  window.masterSync8962={pull,push,claim,transfer,device};paint();
  // The legacy timer is initialized before this module loads. Run one guaranteed
  // refresh here as well so a third computer does not stay on its old local debt
  // merely because the first timer fired before masterSync8962 was ready.
  setTimeout(()=>{try{if(syncCfg().enabled&&syncCfg().url)pull(false)}catch(_){}},500);
})();
