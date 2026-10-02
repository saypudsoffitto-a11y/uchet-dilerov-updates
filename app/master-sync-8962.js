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
  let busy=false,meta=null,online=false,quarantinedThisRun=0;
  let queuedWrite=false,queuedManual=false,pushTimer=null;
  function queuePush(manual,conflictAttempt=0){
    queuedManual=queuedManual||!!manual;
    if(pushTimer!==null)return;
    pushTimer=setTimeout(async()=>{
      pushTimer=null;
      const runManual=queuedManual;queuedManual=false;
      return push(runManual,conflictAttempt);
    },350);
  }
  function finishExchange(){
    busy=false;
    if(queuedWrite){queuedWrite=false;queuePush(queuedManual);}
  }
  const key=()=> 'uchet_sync_baseline_8962:'+String(syncCfg().url||'');
  const staleKey=()=> 'uchet_stale_products:'+String(syncCfg().url||'');
  const catalogConflictKey=()=> 'uchet_catalog_conflicts_8981:'+String(syncCfg().url||'');
  const conflictNote=()=>quarantinedThisRun?' · конфликтующие поля сохранены отдельно':'';
  const recoveryKey=()=> 'uchet_before_master_8962:'+String(syncCfg().url||'');
  const readBaseline=()=>{
    // Visible data and its server baseline share one atomic localStorage write.
    // The old separate key is read only to migrate an existing installation.
    const embedded=state._syncBaseline8981;
    if(embedded?.url===String(syncCfg().url||''))return embedded.baseline;
    try{return JSON.parse(localStorage.getItem(key())||'null')}catch(_){return null}
  };
  const status=(text,connection=online?'online':'offline')=>{const el=document.getElementById('syncStatus');if(el){el.dataset.syncState=connection;el.textContent=text;}paint();};
  function paint(){
    const badge=document.getElementById('computerBadge8962');if(badge)badge.textContent=device.name.replace(/\s*·\s*Главный/g,'')+' · '+(online?'связь есть':'нет связи');
    const master=document.getElementById('masterName8962');if(master)master.textContent=meta?.masterId?'Общая серверная база. Все компьютеры могут создавать документы и изменять справочники.':'Общая база ещё не настроена.';
    const claim=document.getElementById('claimMaster8962');if(claim)claim.hidden=!!meta?.masterId;
    const transfer=document.getElementById('transferMaster8962');if(transfer)transfer.hidden=true;
    const select=document.getElementById('computerTarget8962');if(select)select.hidden=true;
    const conflicts=document.getElementById('productConflictRecovery');if(conflicts)conflicts.hidden=!localStorage.getItem(staleKey());
    const catalogConflicts=document.getElementById('catalogConflictRecovery');if(catalogConflicts)catalogConflicts.hidden=!localStorage.getItem(catalogConflictKey());
    const recovery=document.getElementById('recovery8962');if(recovery)recovery.hidden=!localStorage.getItem(recoveryKey());
  }
  async function request(method,body){
    const r=await syncRequest(method,body);
    if(r?.conflict)return r;
    if(!r?.ok){online=false;throw new Error(r?.message||'Нет ответа сервера');}
    if(r.protocol!==2)throw new Error('Сервер ещё не обновлён для главного компьютера. Данные сохранены локально.');
    if(r.storage!=='turso')throw new Error('Сервер ещё не подключён к постоянной базе Turso. Локальные данные не отправлены.');
    if(window.warehouseInstalled&&r.serverVersion&&(r.inventoryProtocol!==2||r.productRevisions!==true))throw new Error('Сервер ещё не обновлён для защищённых цен и склада. Все правки сохранены локально.');
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
    delete x.inventoryVersion;
    delete x.warehouseOpening;
    if(window.warehouseInstalled)delete x.initialStock;
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
  function diffCatalog(base,current){
    const patch={dealers:C.diffOps(base?.dealers,current?.dealers),groupChanges:C.diffOps(base?.groups,current?.groups),mapChanges:{}};
    for(const field of ['deletedDealers','dealerAliases']){
      const a=base?.[field]||{},b=current?.[field]||{};
      patch.mapChanges[field]=[...new Set([...Object.keys(a),...Object.keys(b)])]
        .filter(key=>!C.same(a[key],b[key])).map(key=>({key,before:a[key]??null,after:b[key]??null}));
    }
    return patch;
  }
  const catalogPending=patch=>patch.dealers.length||patch.groupChanges.length||Object.values(patch.mapChanges).some(rows=>rows.length);
  function applyLocalCatalog(server,patch){
    const next=C.clone(server);
    for(const [field,changes] of [['dealers',patch.dealers],['groups',patch.groupChanges]]){
      const rows=new Map((next[field]||[]).map(row=>[C.id(row.id),row]));
      for(const ch of changes){
        const current=rows.get(ch.id)||null;
        if(C.same(current,ch.after))continue;
        if(!C.same(current,ch.before))throw new Error('Карточка '+field+' '+ch.id+' изменена на другом компьютере. Правка сохранена.');
        if(ch.after)rows.set(ch.id,C.clone(ch.after));else rows.delete(ch.id);
      }
      next[field]=[...rows.values()];
    }
    for(const [field,changes] of Object.entries(patch.mapChanges)){
      const map=next[field]||(next[field]={});
      for(const ch of changes){
        if(C.same(map[ch.key]??null,ch.after))continue;
        if(!C.same(map[ch.key]??null,ch.before))throw new Error('Справочник изменён на другом компьютере. Правка сохранена.');
        if(ch.after==null)delete map[ch.key];else map[ch.key]=C.clone(ch.after);
      }
    }
    return C.remap(next);
  }
  function freshCatalog(server,patch){
    const kept={dealers:[],groupChanges:[],mapChanges:{}},conflicts=[];
    for(const [field,key] of [['dealers','dealers'],['groups','groupChanges']])for(const ch of patch[key]){
      const current=(server[field]||[]).find(row=>C.id(row.id)===ch.id)||null;
      if(C.same(current,ch.after))continue;
      const deleted=field==='dealers'&&server.deletedDealers?.[ch.id];
      if(!deleted&&C.same(current,ch.before)){kept[key].push(ch);continue;}
      // Rebase only fields still equal to the user's actual starting value.
      // A fresh server snapshot never becomes permission to overwrite a conflict.
      if(!deleted&&current&&ch.before&&ch.after){
        const after=C.clone(current),fields=[];
        for(const name of Object.keys({...ch.before,...ch.after}))if(!C.same(ch.before[name],ch.after[name])){
          if(C.same(current[name],ch.before[name])){
            if(Object.hasOwn(ch.after,name))after[name]=C.clone(ch.after[name]);else delete after[name];
          }else if(!C.same(current[name],ch.after[name]))fields.push(name);
        }
        if(!C.same(current,after))kept[key].push({id:ch.id,before:C.clone(current),after});
        if(fields.length)conflicts.push({field,...ch,fields});
      }else conflicts.push({field,...ch});
    }
    for(const [field,changes] of Object.entries(patch.mapChanges)){
      kept.mapChanges[field]=[];
      for(const ch of changes){
        const current=server[field]?.[ch.key]??null;
        if(C.same(current,ch.after)||field.startsWith('deleted')&&current&&ch.after)continue;
        if(C.same(current,ch.before)&&!(field.startsWith('deleted')&&ch.after==null))kept.mapChanges[field].push(ch);
        else conflicts.push({field,...ch});
      }
    }
    if(conflicts.length){
      let previous=[];try{previous=JSON.parse(localStorage.getItem(catalogConflictKey())||'[]');}catch(_){}
      localStorage.setItem(catalogConflictKey(),JSON.stringify([...previous,{at:new Date().toISOString(),changes:conflicts}]));
      quarantinedThisRun+=conflicts.length;
    }
    return kept;
  }
  let lastSaved=C.clone(state);
  function combineChanges(previous,changes,field='id'){
    const rows=new Map((previous||[]).map(ch=>[ch[field],C.clone(ch)]));
    for(const ch of changes||[]){const old=rows.get(ch[field]);rows.set(ch[field],old?{...ch,before:old.before}:C.clone(ch));}
    return [...rows.values()].filter(ch=>!C.same(ch.before,ch.after));
  }
  const firstOutbox=()=>state._syncPending8981?.url===String(syncCfg().url||'')?state._syncPending8981:null;
  function recordSave(){
    if(readBaseline())return;
    const previous=firstOutbox()||{},catalog=diffCatalog(lastSaved,state);
    const archives=C.diffArchives(lastSaved,state);
    // Only actual saves after startup enter the first-connection outbox.
    // An unknown imported cache is never treated as a server write.
    state._syncPending8981={url:String(syncCfg().url||''),
      changes:combineChanges(previous.changes,C.diffOps(lastSaved.ops,state.ops)),
      products:combineChanges(previous.products,diffProductChanges(lastSaved.products,state.products)),
      catalog:{dealers:combineChanges(previous.catalog?.dealers,catalog.dealers),groupChanges:combineChanges(previous.catalog?.groupChanges,catalog.groupChanges),mapChanges:Object.fromEntries(Object.entries(catalog.mapChanges).map(([field,rows])=>[field,combineChanges(previous.catalog?.mapChanges?.[field],rows,'key')]))},
      archives:Object.fromEntries(Object.entries(archives).map(([field,rows])=>[field,combineChanges(previous.archives?.[field],rows,'key')]))};
  }
  function markSaved(){lastSaved=C.clone(state);}
  function commitState(next){
    const previous=state;state=next;
    try{recordSave();localStorage.setItem(KEY,JSON.stringify(state));markSaved();}
    catch(error){state=previous;throw error;}
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
          for(const field of ['inventoryVersion','warehouseOpening','initialStock'])if(current[field]!=null)next[field]=current[field];
          if(Object.prototype.hasOwnProperty.call(current,'receiptArchiveStock'))next.receiptArchiveStock=C.clone(current.receiptArchiveStock);
          next.catalogRev=Number(current.catalogRev)||0;
          if(current.catalogUpdatedAt)next.catalogUpdatedAt=current.catalogUpdatedAt;
          if(current.catalogUpdatedBy)next.catalogUpdatedBy=current.catalogUpdatedBy;
        }else{
          next.stock=0;
          if(window.warehouseInstalled){next.inventoryVersion=2;next.warehouseOpening=0;}
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

  function freshProductChanges(serverState,changes){
    const keep=[],stale=[];
    for(const change of changes){
      const current=(serverState.products||[]).find(p=>C.id(p.id)===change.id)||null;
      const cacheRollback=Number(change.after?.catalogRev||0)<Number(change.before?.catalogRev||0);
      const newerServer=Number(current?.catalogRev||0)>Number(change.before?.catalogRev||0);
      if(cacheRollback){stale.push(change);continue;}
      if(newerServer&&current&&change.before&&change.after){
        // Rebase independent fields. A newer name must not discard a local price edit.
        const before=productUser(change.before),after=productUser(change.after);
        const changed=Object.keys({...before,...after}).filter(field=>!C.same(before[field],after[field]));
        const rebased=productWire(current),conflicts=[];
        for(const field of changed){
          if(C.same(current[field],before[field])){
            if(Object.hasOwn(after,field))rebased[field]=C.clone(after[field]);else delete rebased[field];
          }else if(!C.same(current[field],after[field]))conflicts.push(field);
        }
        if(conflicts.length)stale.push({...change,fields:conflicts});
        if(!C.same(productUser(current),productUser(rebased)))keep.push({id:change.id,before:productWire(current),after:rebased});
      }else if(newerServer&&!change.after){stale.push(change);}
      else keep.push(change);
    }
    if(stale.length){
      quarantinedThisRun+=stale.length;
      const archiveKey=staleKey();
      let previous=[];try{previous=JSON.parse(localStorage.getItem(archiveKey)||'[]');}catch(_){}
      localStorage.setItem(archiveKey,JSON.stringify([...previous,{at:new Date().toISOString(),changes:stale}]));
      status('Получена новая карточка с сервера. Устаревшие поля сохранены отдельно и не отправлены.');
    }
    return keep;
  }
  function pending(){const base=readBaseline();return base?C.diffOps(base.state.ops,state.ops):[];}
  function hasPending(){
    const base=readBaseline();
    return !!base&&(pending().length||diffProductChanges(base.state.products,state.products).length||
      nonProductChanged(base.state,state)||Object.values(C.diffArchives(base.state,state)).some(rows=>rows.length));
  }
  function accept(r,changes,archives,productChanges,nonProductOverlay){
    const known=readBaseline();
    if(known&&Number(r.revision)<Number(known.revision))throw new Error('Получен устаревший ответ сервера. Локальные данные сохранены.');
    for(const old of known?.state?.products||[]){
      const incoming=(r.state?.products||[]).find(p=>C.id(p.id)===C.id(old.id));
      if(incoming&&Number(incoming.catalogRev||0)<Number(old.catalogRev||0))throw new Error('Сервер вернул старую карточку товара '+old.id+'. Локальная цена сохранена.');
    }
    let merged=C.applyTransaction(r.state||{},changes||[],archives);
    if(productChanges?.length)merged=applyLocalProductChanges(merged,productChanges);
    if(nonProductOverlay)merged=applyLocalCatalog(merged,nonProductOverlay);
    const local=state;
    merged.sync={...local.sync,revision:r.revision};merged.update=local.update;merged.newmatros=local.newmatros;
    if(local._syncPending8981&&local._syncPending8981.url!==String(syncCfg().url||''))merged._syncPending8981=C.clone(local._syncPending8981);
    // Baseline is always the exact server snapshot. Local unsent edits live only in visible state.
    merged._syncBaseline8981={url:String(syncCfg().url||''),baseline:{state:r.state,revision:r.revision,masterId:meta?.masterId}};
    merged=norm(merged);
    if(window.warehouseInstalled)C.enableInventory(merged);
    localStorage.setItem(KEY,JSON.stringify(merged));state=merged;
    markSaved();
    // Keep compatibility for diagnostic exports; failure cannot advance the
    // baseline independently from the saved visible database.
    try{localStorage.setItem(key(),JSON.stringify(merged._syncBaseline8981.baseline));}catch(_){}
    render();paint();
  }
  async function backup(){
    const data=JSON.stringify(state);
    localStorage.setItem(recoveryKey(),data);
    if(window.updateAPI?.saveBackup){const result=await window.updateAPI.saveBackup(data);if(!result?.ok)throw new Error('Не удалось сохранить резервную копию: '+(result?.message||''));}
  }
  async function pull(manual){
    if(busy||!syncCfg().url)return false;busy=true;quarantinedThisRun=0;
    const pullStarted=C.clone(state);
    try{
      const r=await request('GET');
      if(!meta?.masterId){status('Связь есть. Выберите главный компьютер. Отправка старых списков приостановлена.');if(manual)alert('Главный компьютер ещё не выбран. Нажмите «Сделать главным» на том компьютере, где данные верные.');return true;}
      const baseline=readBaseline();
      const productChanges=baseline?freshProductChanges(r.state,diffProductChanges(baseline.state.products,state.products)):[];
      let firstJoinExactMirror=false;
      if(!baseline){
        if(!localStorage.getItem(recoveryKey()))await backup();
        localStorage.setItem(recoveryKey(),JSON.stringify(state));
        firstJoinExactMirror=true;
      }
      const firstWarehouseChanges=window.warehouseInstalled?(state.ops||[]).filter(op=>C.warehouseTypes.includes(op.type)&&!(r.state.ops||[]).some(old=>C.id(old.id)===C.id(op.id))):[];
      // Old, unverified cache stays in recovery. Documents created or edited by
      // the user during this exchange are new work, never an old cache upload.
      const outbox=firstOutbox();
      const sessionOps=combineChanges(outbox?.changes,C.diffOps(pullStarted.ops,state.ops));
      const changes=firstJoinExactMirror?[...new Map([...C.diffOps([],firstWarehouseChanges),...sessionOps].map(c=>[c.id,c])).values()]:pending();
      const sessionArchives=C.diffArchives(pullStarted,state);
      const archives=firstJoinExactMirror?Object.fromEntries(Object.entries(sessionArchives).map(([field,rows])=>[field,combineChanges(outbox?.archives?.[field],rows,'key')])):C.diffArchives(readBaseline()?.state||{},state);
      let sessionProductChanges=productChanges;
      if(firstJoinExactMirror){
        sessionProductChanges=freshProductChanges(r.state,combineChanges(outbox?.products,diffProductChanges(pullStarted.products,state.products)));
      }
      let catalogPatch=diffCatalog(firstJoinExactMirror?pullStarted:baseline.state,state);
      if(firstJoinExactMirror&&outbox?.catalog)catalogPatch={dealers:combineChanges(outbox.catalog.dealers,catalogPatch.dealers),groupChanges:combineChanges(outbox.catalog.groupChanges,catalogPatch.groupChanges),mapChanges:Object.fromEntries(Object.entries(catalogPatch.mapChanges).map(([field,rows])=>[field,combineChanges(outbox.catalog.mapChanges[field],rows,'key')]))};
      const catalogChanges=freshCatalog(r.state,catalogPatch);
      accept(r,changes,archives,sessionProductChanges,catalogChanges);
      if(!meta.devices?.[device.id]||meta.devices[device.id].name!==device.name){
        const registered=await request('PUT',{protocol:2,action:'register',device,baseRevision:r.revision});
        if(!registered.conflict){
          const b=readBaseline();
          accept(registered,pending(),C.diffArchives(b?.state||{},state),b?diffProductChanges(b.state.products,state.products):[],freshCatalog(registered.state,diffCatalog(b?.state,state)));
        }
      }
      if(hasPending()&&syncCfg().enabled)queuePush(false);
      status('Подключено · база '+state.sync.revision+(firstJoinExactMirror?' · получена серверная база; прежняя локальная база сохранена отдельно — доступна кнопка скачивания':(hasPending()?' · есть неотправленные изменения':''))+conflictNote());return true;
    }catch(e){online=false;status(e.message);return false;}finally{finishExchange();}
  }
  async function push(manual,conflictAttempt=0){
    if(!syncCfg().url||(!manual&&!syncCfg().enabled))return false;
    if(busy){queuedWrite=true;queuedManual=queuedManual||!!manual;return false;}
    if(!readBaseline()){await pull(true);return false;}
    busy=true;quarantinedThisRun=0;
    try{
      // Capture the exact local state used by the payload before any network await.
      const sentState=C.clone(state),sentOps=sentState.ops;
      const base=readBaseline(),changes=C.diffOps(base.state.ops,sentOps),allProductChanges=diffProductChanges(base.state.products,sentState.products),archives=C.diffArchives(base.state,sentState);
      const expected=C.applyTransaction(base.state,changes,archives);
      const stockOverrides=(sentState.products||[]).flatMap(p=>{const old=base.state.products?.find(x=>C.id(x.id)===C.id(p.id)),e=expected.products?.find(x=>C.id(x.id)===C.id(p.id));return old&&e&&Number(p.stock)!==Number(e.stock)?[{id:C.id(p.id),before:Number(old.stock)||0,after:(Number(old.stock)||0)+Number(p.stock)-Number(e.stock)}]:[];});
      const r=await request('GET');
      if(!meta?.masterId)throw new Error('Выберите главный компьютер.');
      if(Number(r.revision)<Number(base.revision))throw new Error('Сервер вернул устаревшую базу. Отправка остановлена.');
      const productChanges=freshProductChanges(r.state,allProductChanges);

      // Проверяем локальные карточки против свежего сервера ДО отправки.
      if(productChanges.length)applyLocalProductChanges(r.state,productChanges);

      const catalogChanges=freshCatalog(r.state,diffCatalog(base.state,sentState));
      applyLocalCatalog(r.state,catalogChanges);
      // Three-way operation conflict detection; no silent last-writer-wins.
      C.applyTransaction(r.state,changes,archives);

      const payload={protocol:2,action:'changes',device,baseRevision:r.revision,changes,archives,productChanges};
      if(window.warehouseInstalled)payload.inventoryProtocol=2;
      else if(meta.masterId===device.id)payload.stockOverrides=stockOverrides;
      if(catalogPending(catalogChanges))payload.catalogPatch=catalogChanges;

      const result=await request('PUT',payload);
      if(result.conflict){
        if(conflictAttempt<3)queuePush(manual,conflictAttempt+1);
        status('База изменилась во время отправки. Изменения сохранены; повторная отправка выполняется автоматически.');
        return false;
      }
      // Older servers must not acknowledge an ignored delta and erase local work.
      if(payload.catalogPatch&&!C.same(nonProductCatalog(applyLocalCatalog(result.state,catalogChanges)),nonProductCatalog(result.state)))throw new Error('Сервер не подтвердил правки справочника. Они сохранены локально; обновите сервер.');

      const duringFlight=C.diffOps(sentOps,state.ops);
      const productDuringFlight=freshProductChanges(result.state,diffProductChanges(sentState.products,state.products));
      const nonProductDuringFlight=freshCatalog(result.state,diffCatalog(sentState,state));

      // Серверный результат становится новой базой. Только изменения, сделанные
      // пока запрос был в полёте, остаются поверх неё как ещё не отправленные.
      const archivesDuringFlight=C.diffArchives(sentState,state);
      accept(result,duringFlight,archivesDuringFlight,productDuringFlight,nonProductDuringFlight);
      // A save timer may have fired while busy; send retained edits again.
      if(productDuringFlight.length||duringFlight.length||catalogPending(nonProductDuringFlight)||Object.values(archivesDuringFlight).some(rows=>rows.length))queuePush(false);
      status('Синхронизировано · база '+result.revision+conflictNote());return true;
    }catch(e){online=false;status(e.message);return false;}finally{finishExchange();}
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
    box.innerHTML='<h3>Этот компьютер</h3><label>Название<input id="computerName8962" maxlength="80"></label><p id="masterName8962"></p><div class="actions"><button id="claimMaster8962" class="primary">Сделать главным</button><select id="computerTarget8962" hidden></select><button id="transferMaster8962" hidden>Передать роль главного</button><button id="recovery8962" hidden>Скачать сохранённую локальную базу</button><button id="productConflictRecovery" hidden>Скачать конфликтующие правки товаров</button></div><p class="muted">Цены и карточки товаров синхронизируются с любого компьютера. Главный компьютер управляет дилерами и группами. Старые продажи и чеки сохраняют прежние цены.</p>';
    host.prepend(box);
    const hiddenStyle=document.createElement('style');hiddenStyle.textContent='[hidden]{display:none!important}';host.prepend(hiddenStyle);
    const info=box.querySelector('.muted');if(info)info.textContent='Документы и справочники синхронизируются с любого компьютера. Сервер хранит общую базу; конфликтующие правки сохраняются отдельно. Старые продажи и чеки сохраняют прежние цены.';
    const catalogRecovery=document.createElement('button');catalogRecovery.id='catalogConflictRecovery';catalogRecovery.hidden=true;catalogRecovery.textContent='Скачать конфликтующие правки дилеров и групп';box.querySelector('.actions').appendChild(catalogRecovery);
    catalogRecovery.onclick=()=>{const url=URL.createObjectURL(new Blob([localStorage.getItem(catalogConflictKey())||'[]'],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='Uchet-catalog-conflicts.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
    document.getElementById('computerName8962').value=device.name;
    document.getElementById('computerName8962').onchange=e=>{device.name=e.target.value.trim()||device.name;localStorage.setItem(DEVICE,JSON.stringify(device));paint();};
    document.getElementById('claimMaster8962').onclick=claim;document.getElementById('transferMaster8962').onclick=transfer;
    document.getElementById('productConflictRecovery').onclick=()=>{const url=URL.createObjectURL(new Blob([localStorage.getItem(staleKey())||'[]'],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='Uchet-product-conflicts.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
    document.getElementById('recovery8962').onclick=()=>{const url=URL.createObjectURL(new Blob([localStorage.getItem(recoveryKey())],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='Uchet-before-master.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  }
  const badge=document.createElement('button');badge.id='computerBadge8962';badge.className='secondary';badge.onclick=()=>go('sync');document.querySelector('header .actions')?.prepend(badge);
  window.masterSync8962={pull,push,claim,transfer,device,recordSave,markSaved,commitState};paint();
  setTimeout(()=>{try{if(syncCfg().enabled&&syncCfg().url)pull(false)}catch(_){}},500);
})();
