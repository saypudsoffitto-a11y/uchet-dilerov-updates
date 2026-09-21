(()=>{
  'use strict';
  if(window.__release8963Installed)return;
  window.__release8963Installed=true;

  const DEVICE_ID_KEY='uchet_device_id_v1';
  const DEVICE_NAME_KEY='uchet_device_name_v1';

  function deviceId8963(){
    let id='';
    try{id=String(localStorage.getItem(DEVICE_ID_KEY)||'').trim()}catch(_){}
    if(id)return id;
    try{id=crypto.randomUUID()}catch(_){id='pc-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10)}
    try{localStorage.setItem(DEVICE_ID_KEY,id)}catch(_){}
    return id;
  }

  function deviceName8963(){
    let name='';
    try{name=String(localStorage.getItem(DEVICE_NAME_KEY)||'').trim()}catch(_){}
    return name||'Компьютер 1 · Главный';
  }

  function saveDeviceName8963(value){
    const name=String(value||'').trim()||'Компьютер 1 · Главный';
    try{localStorage.setItem(DEVICE_NAME_KEY,name)}catch(_){}
    return name;
  }

  function ensurePrimaryPanel8963(){
    const section=document.getElementById('sync');
    const card=section&&section.querySelector('.card.form');
    if(!card||document.getElementById('syncPrimaryPanel8963'))return;
    const panel=document.createElement('div');
    panel.id='syncPrimaryPanel8963';
    panel.className='full syncPrimaryPanel8963';
    panel.innerHTML=
      '<div class="syncPrimaryHead8963"><b>Главная база</b><span id="syncRoleBadge8963" class="syncRoleBadge8963">Не назначена</span></div>'+
      '<p class="muted">Turso хранит общую базу постоянно. Один компьютер выполняет только первичную загрузку; после этого все компьютеры работают с центральной базой.</p>'+
      '<label>Название этого компьютера<input id="syncDeviceName8963" value="'+String(deviceName8963()).replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'"></label>'+
      '<div class="actions"><button id="syncInitialize8963" class="primary" type="button">Сделать этот компьютер главным и загрузить базу</button></div>'+
      '<p id="syncPrimaryStatus8963" class="muted"></p>';
    card.appendChild(panel);
    const input=panel.querySelector('#syncDeviceName8963');
    input?.addEventListener('change',()=>{saveDeviceName8963(input.value);renderPrimaryPanel8963()});
    panel.querySelector('#syncInitialize8963')?.addEventListener('click',initializeCentralBase8963);
  }

  function renderPrimaryPanel8963(){
    ensurePrimaryPanel8963();
    const id=deviceId8963();
    const primaryId=String(state?.sync?.primaryDeviceId||'').trim();
    const primaryName=String(state?.sync?.primaryDeviceName||'').trim();
    const badge=document.getElementById('syncRoleBadge8963');
    const status=document.getElementById('syncPrimaryStatus8963');
    const btn=document.getElementById('syncInitialize8963');
    const name=document.getElementById('syncDeviceName8963');
    if(name&&document.activeElement!==name)name.value=deviceName8963();
    if(!badge||!status||!btn)return;
    if(primaryId){
      if(primaryId===id){
        badge.textContent='Главный компьютер';
        badge.dataset.role='primary';
        status.textContent='Этот компьютер выполнил первичную загрузку центральной базы.';
      }else{
        badge.textContent='Рабочий компьютер';
        badge.dataset.role='secondary';
        status.textContent='Главный: '+(primaryName||'другой компьютер')+'. Этот компьютер подстраивается под центральную базу.';
      }
      btn.disabled=true;
      btn.textContent='Главная база уже назначена';
    }else{
      badge.textContent='Не назначена';
      badge.dataset.role='none';
      status.textContent='Центральная база ещё не инициализирована.';
      btn.disabled=false;
      btn.textContent='Сделать этот компьютер главным и загрузить базу';
    }
  }

  function meaningfulLocalState8963(){
    const s=state&&typeof state==='object'?state:{};
    return ['dealers','products','groups','ops'].some(k=>Array.isArray(s[k])&&s[k].length>0);
  }

  async function initializeCentralBase8963(){
    const status=document.getElementById('syncPrimaryStatus8963');
    const button=document.getElementById('syncInitialize8963');
    if(syncBusy){if(status)status.textContent='Синхронизация уже выполняется.';return}
    if(!syncCfg().url){if(status)status.textContent='Сначала укажи адрес сервера и сохрани подключение.';return}
    if(!meaningfulLocalState8963()){if(status)status.textContent='На этом компьютере нет данных для первичной загрузки.';return}

    const id=deviceId8963();
    const input=document.getElementById('syncDeviceName8963');
    const name=saveDeviceName8963(input?.value||deviceName8963());

    syncBusy=true;
    if(button)button.disabled=true;
    if(status)status.textContent='Проверяю Turso и пустоту центральной базы…';
    try{
      const check=await syncRequest('GET');
      if(!check?.ok)throw new Error(check?.message||'Не удалось проверить центральную базу');
      if(check.storage!=='turso'||!/^8\.9\.63(?:\.|-|$)/.test(String(check.serverVersion||''))){
        throw new Error('Сервер ещё не переключён на Turso 8.9.63');
      }
      const remote=check.state&&typeof check.state==='object'?check.state:{};
      const remoteHasData=['dealers','products','groups','ops'].some(k=>Array.isArray(remote[k])&&remote[k].length>0);
      if((+check.revision||0)!==0||remoteHasData){
        state.sync=state.sync||{};
        if(remote.sync?.primaryDeviceId)state.sync.primaryDeviceId=remote.sync.primaryDeviceId;
        if(remote.sync?.primaryDeviceName)state.sync.primaryDeviceName=remote.sync.primaryDeviceName;
        if(remote.sync?.primaryInitializedAt)state.sync.primaryInitializedAt=remote.sync.primaryInitializedAt;
        state.sync.revision=+check.revision||0;
        localStorage.setItem(KEY,JSON.stringify(state));
        throw new Error('Центральная база уже заполнена. Повторная первичная загрузка запрещена.');
      }

      const r=await syncRequest('PUT',{
        initialize:true,
        baseRevision:0,
        deviceId:id,
        deviceName:name,
        state
      });
      if(!r?.ok){
        if(r?.state&&typeof r.state==='object'){
          const merged=typeof mergeSyncState==='function'?mergeSyncState(r.state,state):state;
          state=merged;
          state.sync=state.sync||{};
          state.sync.revision=+r.revision||0;
          localStorage.setItem(KEY,JSON.stringify(state));
        }
        throw new Error(r?.message||'Не удалось выполнить первичную загрузку');
      }
      state.sync=state.sync||{};
      state.sync.revision=+r.revision||1;
      state.sync.primaryDeviceId=r.primaryDeviceId||id;
      state.sync.primaryDeviceName=r.primaryDeviceName||name;
      state.sync.primaryInitializedAt=state.sync.primaryInitializedAt||new Date().toISOString();
      localStorage.setItem(KEY,JSON.stringify(state));
      if(status)status.textContent='Готово. Этот компьютер назначен главным, база загружена в Turso.';
      if(window.syncStatus)syncStatus.innerHTML='<span class="serverOk">Turso подключена</span> · версия базы '+state.sync.revision;
      if(typeof render==='function')render();
    }catch(e){
      if(status)status.textContent=String(e&&e.message||e);
    }finally{
      syncBusy=false;
      renderPrimaryPanel8963();
    }
  }
  window.initializeCentralBase8963=initializeCentralBase8963;

  const baseMerge8963=typeof mergeSyncState==='function'?mergeSyncState:window.mergeSyncState;
  if(typeof baseMerge8963==='function'&&!baseMerge8963.__authority8963){
    const wrapped=function(remote,local){
      const rs=remote&&remote.sync&&typeof remote.sync==='object'?{
        primaryDeviceId:remote.sync.primaryDeviceId,
        primaryDeviceName:remote.sync.primaryDeviceName,
        primaryInitializedAt:remote.sync.primaryInitializedAt
      }:{};
      const merged=baseMerge8963.apply(this,arguments);
      merged.sync=merged.sync&&typeof merged.sync==='object'?merged.sync:{};
      for(const [k,v] of Object.entries(rs)){if(String(v||'').trim())merged.sync[k]=v}
      return merged;
    };
    wrapped.__authority8963=true;
    window.mergeSyncState=wrapped;
    try{mergeSyncState=wrapped}catch(_){}
  }

  const baseRenderSync8963=typeof renderSyncSettings==='function'?renderSyncSettings:window.renderSyncSettings;
  if(typeof baseRenderSync8963==='function'&&!baseRenderSync8963.__authority8963){
    const wrapped=function(){
      const out=baseRenderSync8963.apply(this,arguments);
      renderPrimaryPanel8963();
      return out;
    };
    wrapped.__authority8963=true;
    window.renderSyncSettings=wrapped;
    try{renderSyncSettings=wrapped}catch(_){}
  }

  const style=document.createElement('style');
  style.id='release8963Style';
  style.textContent=`
    .syncPrimaryPanel8963{border-top:1px solid #dce4ef;padding-top:14px;margin-top:4px}
    .syncPrimaryHead8963{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:4px}
    .syncRoleBadge8963{font-size:12px;font-weight:800;border-radius:999px;padding:6px 10px;background:#eef2f6;color:#4b5768}
    .syncRoleBadge8963[data-role="primary"]{background:#e7f8ed;color:#187a38}
    .syncRoleBadge8963[data-role="secondary"]{background:#eaf3ff;color:#245f9f}
    .syncPrimaryPanel8963 .actions{margin-top:8px}
  `;
  (document.head||document.documentElement).appendChild(style);

  ensurePrimaryPanel8963();
  renderPrimaryPanel8963();
  document.documentElement.dataset.interfaceVersion='8.9.63';
  document.documentElement.dataset.uchetRuntime='8.9.63';
  window.__release8963={deviceId:deviceId8963,deviceName:deviceName8963,renderPrimaryPanel:renderPrimaryPanel8963};
})();
