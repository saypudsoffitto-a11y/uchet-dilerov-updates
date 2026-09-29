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
    if(!r?.ok){online=false;throw new Error(r?.message||'Нет ответа сервера');}
    if(r.protocol!==2)throw new Error('Сервер ещё не обновлён для главного компьютера. Данные сохранены локально.');
    if(r.storage!=='turso')throw new Error('Сервер ещё не подключён к постоянной базе Turso. Локальные данные не отправлены.');
    meta=r.computers;
    const serverName=meta?.devices?.[device.id]?.name;
    if(serverName&&serverName!==device.name){device.name=serverName;localStorage.setItem(DEVICE,JSON.stringify(device));const input=document.getElementById('computerName8962');if(input)input.value=device.name;}
    online=true;
    return r;
  }

  // 8.9.78: активная цена хранится только в текущей карточке сервера.
  // Клиент отправляет точечное изменение "before -> after"; сервер сам повышает catalogRev.
  const productWire=p=>{
    if(!p)return null;
    const x=C.clone(p);
    delete x.stock;
    delete x.receiptArchiveStock;
    return x;
  };
  const productUser=p=>{
    const x=productWire(p);
    if(!x)return null;
    delete x.catalogRev;
    delete x.catalogUpdatedAt;
    delete x.catalogUpdatedBy;
    return x;
  };
  function diffProductChanges(baseProducts,currentProducts){
    const a=new Map((baseProducts||[]).map(p=>[C.id(p.id),p]));
    const b=new Map((currentProducts||[]).map(p=>[C.id(p.id),p]));
    return [...new Set([...a.keys(),...b.keys()])]
      .filter(id=>!C.same(productUser(a.get(id)),productUser(b.get(id))))
      .map(id=>({id,before:productWire(a.get(id)),after:productWire(b.get(id))}));
  }
  const nonProductCatalog=s=>({
    dealers:C.clone(s?.dealers||[]),
    groups:C.clone(s?.groups||[]),
    deletedDealers:C.clone(s?.deletedDealers||{}),
    dealerAliases:C.clone(s?.dealerAliases||{})
  });
  const nonProductChanged=(a,b)=>!C.same(nonProductCatalog(a||{}),nonProductCatalog(b||{}));
  function overlayNonProduct(target,source){
    const next=C.clone(target||{});
    const value=nonProductCatalog(source||{});
    next.dealers=value.dealers;
    next.groups=value.groups;
    next.deletedDealers=value.deletedDealers;
    next.dealerAliases=value.dealerAliases;
    return next;
  }
  function applyLocalProductChanges(serverState,changes){
    const out=C.clone(serverState||{});
    out.products=Array.isArray(out.products)?out.products:[];
    out.deletedProducts=out.deletedProducts&&typeof out.deletedProducts==='object'?out.deletedProducts:{};
    const map=new Map(out.products.map(p=>[C.id(p.id),p]));
    for(const change of changes||[]){
      const id=C.id(change.id);
      const current=map.get(id)||null;
      const before=change.before?productWire(change.before):null;
      const after=change.after?productWire(change.after):null;

      if(!after&&!current)continue;
      if(after&&current&&C.same(productUser(current),productUser(after)))continue;

      const currentWire=current?productWire(current):null;
      const exactBase=C.same(currentWire,before);
      const metadataOnlyBase=current&&before&&C.same(productUser(current),productUser(before));
      if(!exactBase&&!metadataOnlyBase){
        throw new Error('Карточка товара '+id+' уже изменена на другом компьютере. Локальная правка сохранена; сначала выполните синхронизацию.');
      }

      if(after){
        const next=C.clone(after);
        if(current){
          next.stock=current.stock;
          if(Object.prototype.hasOwnProperty.call(current,'receiptArchiveStock'))next.receiptArchiveStock=C.clone(current.receiptArchiveStock);
          next.catalogRev=Number(current.catalogRev)||0;
          if(current.catalogUpdatedAt)next.catalogUpdatedAt=current.catalogUpdatedAt;
          if(current.catalogUpdatedBy)next.catalogUpdatedBy=current.catalogUpdatedBy;
        }else{
          next.stock=0;
        }
        map.set(id,next);
        delete out.deletedProducts[id];
      }else{
        map.delete(id);
      }
    }
    out.products=[...map.values()];
    return C.remap(out);
  }

  function pending(){const base=readBaseline();return base?C.diffOps(base.state.ops,state.ops):[];}
  function accept(r,changes,archives,productChanges,nonProductOverlay){
    let merged=C.applyTransaction(r.state||{},changes||[],archives);
    if(productChanges?.length)merged=applyLocalProductChanges(merged,productChanges);
    if(nonProductOverlay)merged=overlayNonProduct(merged,nonProductOverlay);
    const local=state;
    merged.sync={...local.sync,revision:r.revision};merged.update=local.update;merged.newmatros=local.newmatros;
    // Baseline is always the exact server snapshot. Local unsent edits live only in visible state.
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
      if(!meta?.masterId){status('Связь есть. Выберите главный компьютер. Отправка старых списков приостановлена.');if(manual)alert('Главный компьютер ещё не выбран. Нажмите «Сделать главным» на том компьютере, где данные верные.');return true;}
      const baseline=readBaseline();
      const productChanges=baseline?diffProductChanges(baseline.state.products,state.products):[];
      const masterCatalogPending=!!(meta.masterId===device.id&&baseline&&nonProductChanged(baseline.state,state));
      if(masterCatalogPending){status('Есть изменения дилеров или групп на главном компьютере. Нажмите «Отправить на сервер».');return true;}
      let firstJoinExactMirror=false;
      if(!baseline){
        if(!localStorage.getItem(recoveryKey()))await backup();
        localStorage.setItem(recoveryKey(),JSON.stringify(state));
        firstJoinExactMirror=true;
      }
      const changes=firstJoinExactMirror?[]:pending(),archives=firstJoinExactMirror?{}:C.diffArchives(readBaseline()?.state||{},state);
      accept(r,changes,archives,firstJoinExactMirror?[]:productChanges,null);
      if(!meta.devices?.[device.id]||meta.devices[device.id].name!==device.name){
        const registered=await request('PUT',{protocol:2,action:'register',device,baseRevision:r.revision});
        if(!registered.conflict){
          const b=readBaseline();
          accept(registered,pending(),C.diffArchives(b?.state||{},state),b?diffProductChanges(b.state.products,state.products):[],null);
        }
      }
      status('Подключено · база '+state.sync.revision+(firstJoinExactMirror?' · точная копия главного; прежняя локальная база сохранена отдельно — доступна кнопка скачивания':(changes.length||productChanges.length?' · есть неотправленные изменения':'')));return true;
    }catch(e){online=false;status(e.message);return false;}finally{busy=false;}
  }
  async function push(manual){
    if(busy||!syncCfg().url||(!manual&&!syncCfg().enabled))return false;
    if(!readBaseline()){await pull(true);return false;}
    busy=true;
    try{
      const base=readBaseline(),changes=pending(),productChanges=diffProductChanges(base.state.products,state.products),catalogChanged=nonProductChanged(base.state,state),archives=C.diffArchives(base.state,state);
      const expected=C.applyTransaction(base.state,changes,archives);
      const stockOverrides=(state.products||[]).flatMap(p=>{const old=base.state.products?.find(x=>C.id(x.id)===C.id(p.id)),e=expected.products?.find(x=>C.id(x.id)===C.id(p.id));return old&&e&&Number(p.stock)!==Number(e.stock)?[{id:C.id(p.id),before:Number(old.stock)||0,after:(Number(old.stock)||0)+Number(p.stock)-Number(e.stock)}]:[];});
      const r=await request('GET');
      if(!meta?.masterId)throw new Error('Выберите главный компьютер.');

      // Проверяем локальные карточки против свежего сервера ДО отправки.
      if(productChanges.length)applyLocalProductChanges(r.state,productChanges);

      if(catalogChanged&&meta.masterId!==device.id){
        await backup();
        state=norm(overlayNonProduct(state,r.state));
        localStorage.setItem(KEY,JSON.stringify(state));render();
        status('Изменения дилеров/групп сохранены в локальной копии. Товары можно изменять на любом компьютере.');
      }
      // Three-way operation conflict detection; no silent last-writer-wins.
      C.applyTransaction(r.state,changes,archives);
      if(catalogChanged&&meta.masterId===device.id&&nonProductChanged(base.state,r.state))throw new Error('Дилеры или группы на сервере изменились. Локальные изменения сохранены; требуется сверка.');

      const payload={protocol:2,action:'changes',device,baseRevision:r.revision,changes,archives,productChanges};
      if(meta.masterId===device.id)payload.stockOverrides=stockOverrides;
      if(catalogChanged&&meta.masterId===device.id)payload.catalogNonProducts=nonProductCatalog(state);

      const sentState=C.clone(state),sentOps=sentState.ops;
      const result=await request('PUT',payload);
      if(result.conflict)throw new Error('База изменилась во время отправки. Изменения сохранены; повторите синхронизацию.');

      const duringFlight=C.diffOps(sentOps,state.ops);
      const productDuringFlight=diffProductChanges(sentState.products,state.products);
      const nonProductDuringFlight=meta.masterId===device.id&&nonProductChanged(sentState,state)?nonProductCatalog(state):null;

      // Серверный результат становится новой базой. Только изменения, сделанные
      // пока запрос был в полёте, остаются поверх неё как ещё не отправленные.
      accept(result,duringFlight,C.diffArchives(sentState,state),productDuringFlight,nonProductDuringFlight);
      status('Синхронизировано · база '+result.revision);return true;
    }catch(e){online=false;status(e.message);return false;}finally{busy=false;}
  }
  async function claim(){
    if(busy)return;busy=true;
    try{
      const r=await request('GET');
      if(meta?.masterId){status('Главный компьютер уже назначен: '+(meta.devices?.[meta.masterId]?.name||'другой компьютер')+'.');alert('Главный компьютер уже назначен: '+(meta.devices?.[meta.masterId]?.name||'другой компьютер')+'. Если нужно назначить этот компьютер, сначала передайте роль главного с текущего главного компьютера.');return;}
      const askText='Сделать «'+device.name+'» главным? Его список станет основным: '+state.dealers.length+' дилеров, '+state.products.length+' товаров. Будет создана резервная копия.';
      let proceed=false;
      try{proceed=confirm(askText);}catch(_){status('Не удалось открыть подтверждение. Действие отменено.');return;}
      if(!proceed)return;
      await backup();
      const result=await request('PUT',{protocol:2,action:'claim',device,baseRevision:r.revision,state:C.clone(state)});
      if(result.conflict){status('База изменилась. Повторите выбор главного компьютера.');alert('База изменилась. Повторите выбор главного компьютера.');return;}
      localStorage.removeItem(key());accept(result,[],{},[],null);
      status('Этот компьютер — главный. Остальные получат его справочники.');
      alert('Готово. Этот компьютер назначен главным. На остальных компьютерах откройте раздел «Общий сервер» — они получат этот список автоматически.');
    }catch(e){status(e.message);alert('Не удалось назначить главный компьютер: '+e.message);}finally{busy=false;}
  }
  async function transfer(){
    if(busy)return;const targetId=document.getElementById('computerTarget8962').value;if(!targetId)return;
    if(!await push(true))return;
    let proceed=false;
    try{proceed=confirm('Передать роль главного компьютеру «'+meta.devices[targetId].name+'»? Текущий общий справочник сохранится.');}catch(_){status('Не удалось открыть подтверждение. Действие отменено.');return;}
    if(!proceed)return;
    busy=true;
    try{const r=await request('GET');const result=await request('PUT',{protocol:2,action:'transfer',device,targetId,baseRevision:r.revision});if(result.conflict){status('База изменилась. Повторите передачу роли.');alert('База изменилась. Повторите передачу роли.');return;}accept(result,pending(),C.diffArchives(readBaseline().state,state),diffProductChanges(readBaseline().state.products,state.products),null);status('Главный компьютер изменён.');alert('Готово. Роль главного передана компьютеру «'+meta.devices[targetId].name+'».');}catch(e){status(e.message);alert('Не удалось передать роль главного: '+e.message);}finally{busy=false;}
  }
  const host=document.getElementById('sync');
  if(host){
    const box=document.createElement('div');box.className='card';
    box.innerHTML='<h3>Этот компьютер</h3><label>Название<input id="computerName8962" maxlength="80"></label><p id="masterName8962"></p><div class="actions"><button id="claimMaster8962" class="primary">Сделать главным</button><select id="computerTarget8962" hidden></select><button id="transferMaster8962" hidden>Передать роль главного</button><button id="recovery8962" hidden>Скачать сохранённую локальную базу</button></div><p class="muted">Цены и карточки товаров синхронизируются с любого компьютера. Главный компьютер управляет дилерами и группами. Старые продажи и чеки сохраняют прежние цены.</p>';
    host.prepend(box);
    document.getElementById('computerName8962').value=device.name;
    document.getElementById('computerName8962').onchange=e=>{device.name=e.target.value.trim()||device.name;localStorage.setItem(DEVICE,JSON.stringify(device));paint();};
    document.getElementById('claimMaster8962').onclick=claim;document.getElementById('transferMaster8962').onclick=transfer;
    document.getElementById('recovery8962').onclick=()=>{const url=URL.createObjectURL(new Blob([localStorage.getItem(recoveryKey())],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='Uchet-before-master.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  }
  const badge=document.createElement('button');badge.id='computerBadge8962';badge.className='secondary';badge.onclick=()=>go('sync');document.querySelector('header .actions')?.prepend(badge);
  window.masterSync8962={pull,push,claim,transfer,device};paint();
  setTimeout(()=>{try{if(syncCfg().enabled&&syncCfg().url)pull(false)}catch(_){}},500);
})();
