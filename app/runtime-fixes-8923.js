(()=>{
  if(window.__uchetRuntime8923)return;
  window.__uchetRuntime8923=true;

  const PENDING_KEY='uchetNewMatRosPending8923';

  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const m=n=>{try{return typeof money==='function'?money(n):((+n||0).toLocaleString('ru-RU')+' ₽')}catch(_){return (+n||0).toLocaleString('ru-RU')+' ₽'}};
  const num=v=>{const n=Number(String(v??'').replace(',','.').replace(/[^0-9.\-]/g,''));return Number.isFinite(n)?n:0};

  function disableAutoPost(){
    try{
      if(typeof state!=='undefined'){
        state.newmatros=state.newmatros||{};
        state.newmatros.autoPost=false;
        localStorage.setItem(typeof KEY!=='undefined'?KEY:'uchet_dilerov_v8',JSON.stringify(state));
        const cb=document.getElementById('nmAutoPost');if(cb)cb.checked=false;
      }
    }catch(e){console.error('NewMatRos disable auto post',e)}
  }

  function persistPayload(payload){
    if(!payload?.text)return;
    try{localStorage.setItem(PENDING_KEY,JSON.stringify({name:payload.name||'NewMatRos.ini',text:String(payload.text),ts:Date.now()}))}catch(_){ }
  }
  function pendingPayload(){try{return JSON.parse(localStorage.getItem(PENDING_KEY)||'null')}catch(_){return null}}
  function clearPending(){try{localStorage.removeItem(PENDING_KEY)}catch(_){ }}
  function parsePayload(payload){
    if(!payload?.text)throw new Error('Файл выгрузки пустой');
    if(typeof parseIni!=='function')throw new Error('Модуль разбора NewMatRos не загружен');
    const data=parseIni(payload.text);
    if(!data||typeof data!=='object')throw new Error('Не удалось разобрать INI NewMatRos');
    return data;
  }

  function orderInfo(data){
    const z=data?.['Заказ']||{},c=data?.['Контрагент']||{};
    let found={};
    if(typeof nmFindDealer==='function')found=nmFindDealer(data)||{};
    const dealer=found.dealer||null;
    const name=dealer?.name||found.name||c['Наименование']||c['ФИО']||c['Контрагент']||'Дилер не определён';
    const phone=dealer?.phone||found.rawPhone||c['Телефон']||'';
    let width=0;
    try{if(typeof nmFindRollWidth==='function')width=+nmFindRollWidth(data)||0}catch(_){ }
    if(!width){
      for(const k of ['ШиринаПолотна','ШиринаРулона','ШиринаМатериала','МатериалШирина','Ширина']){
        let n=num(z[k]);if(!n)continue;if(n>1000)n/=1000;else if(n>10)n/=100;width=n;break;
      }
    }
    let items=[];
    if(typeof nmBuildItems==='function')items=nmBuildItems(data)||[];
    const total=items.reduce((s,i)=>s+(Number.isFinite(+i.total)?+i.total:(+i.qty||0)*(+i.price||0)),0);
    const mat=items.find(i=>i.article==='NM-MAT')||null;
    let key='';try{if(typeof nmOrderKey==='function')key=nmOrderKey(data)||''}catch(_){ }
    let duplicate=false;try{if(typeof nmAlreadyImported==='function')duplicate=!!nmAlreadyImported(key)}catch(_){ }
    return {z,c,found,dealer,name,phone,width,items,total,mat,key,duplicate};
  }

  function ensureReviewModal(){
    let o=document.getElementById('nmReviewModal8923');if(o)return o;
    const css=document.createElement('style');css.textContent=`
      #nmReviewModal8923{position:fixed;inset:0;z-index:500;background:#0009;display:flex;align-items:center;justify-content:center;padding:18px}
      #nmReviewModal8923.hidden{display:none!important}.nmReviewBox{width:min(1050px,97vw);max-height:92vh;overflow:auto;background:#fff;border-radius:18px;padding:20px;box-shadow:0 25px 90px #0006}
      .nmReviewHead{display:flex;align-items:center;justify-content:space-between;gap:12px}.nmReviewHead h2{margin:0}.nmReviewGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0}.nmReviewCard{border:1px solid #dfe7e3;border-radius:12px;padding:11px;background:#fbfcfb}.nmReviewCard span{display:block;color:#68756f;font-size:12px;margin-bottom:4px}.nmReviewCard b{font-size:16px}.nmReviewTable{width:100%;border-collapse:collapse;margin-top:10px}.nmReviewTable th,.nmReviewTable td{border:1px solid #d8dee7;padding:6px 7px;font-size:12px}.nmReviewWarn{background:#fff4e5;border:1px solid #efc875;color:#7a5200;border-radius:10px;padding:10px;margin:10px 0}.nmReviewOk{background:#edf8f3;border:1px solid #b9dfcc;color:#245b46;border-radius:10px;padding:10px;margin:10px 0}.nmReviewActions{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px}@media(max-width:900px){.nmReviewGrid{grid-template-columns:repeat(2,1fr)}}`;
    document.head.appendChild(css);
    o=document.createElement('div');o.id='nmReviewModal8923';o.className='hidden';
    o.innerHTML='<div class="nmReviewBox"><div class="nmReviewHead"><h2>Проверка выгрузки NewMatRos</h2><button id="nmReviewX8923" class="secondary" type="button">Закрыть</button></div><div id="nmReviewBody8923"></div></div>';
    document.body.appendChild(o);
    const close=()=>{o.classList.add('hidden');showPendingBanner()};
    o.querySelector('#nmReviewX8923').onclick=close;
    o.addEventListener('click',e=>{if(e.target===o)close()});
    return o;
  }

  function showReview(payload){
    try{
      disableAutoPost();persistPayload(payload);
      const data=parsePayload(payload);
      const info=orderInfo(data),z=info.z;
      const o=ensureReviewModal(),body=o.querySelector('#nmReviewBody8923');
      const material=z['МатериалКаталог']||z['МатериалМатериал']||'—';
      const color=z['МатериалЦвет']||'—';
      const width=info.width?info.width.toLocaleString('ru-RU',{maximumFractionDigits:2})+' м':'не распознана';
      const priceSource=info.mat?.priceProductName?('Карточка товара: '+info.mat.priceProductName):(info.mat?.priceSource||'—');
      const rows=info.items.map((i,n)=>'<tr><td>'+(n+1)+'</td><td>'+h(i.article||'')+'</td><td>'+h(i.name||'')+'</td><td>'+h(i.qty||0)+' '+h(i.unit||'')+'</td><td>'+m(i.price)+'</td><td>'+m(Number.isFinite(+i.total)?+i.total:(+i.qty||0)*(+i.price||0))+'</td></tr>').join('');
      let warning='';
      if(!info.dealer)warning+='<div class="nmReviewWarn"><b>Дилер не найден точно.</b> Проверь имя и телефон. При подтверждении программа создаст карточку из NewMatRos.</div>';
      if(!info.mat||(+info.mat.price||0)<=0)warning+='<div class="nmReviewWarn"><b>Цена плёнки не определена.</b> Продажу оформить нельзя, пока цена не будет найдена в карточке товара.</div>';
      if(info.duplicate)warning+='<div class="nmReviewWarn"><b>Этот заказ уже оформлен.</b> Повторная продажа заблокирована.</div>';
      if(info.mat&&(+info.mat.price||0)>0)warning+='<div class="nmReviewOk"><b>Плёнка распознана.</b> '+h(priceSource)+' · '+m(info.mat.price)+' / м²</div>';
      body.innerHTML=`<div class="nmReviewGrid">
        <div class="nmReviewCard"><span>Дилер</span><b>${h(info.name)}</b><div>${h(info.phone)}</div></div>
        <div class="nmReviewCard"><span>Заказ / потолок</span><b>${h(z['НомерРасчета']||'—')}</b><div>${h(z['ИндексПотолка']||'')}</div></div>
        <div class="nmReviewCard"><span>Фактура / материал</span><b>${h(material)}</b><div>Цвет: ${h(color)}</div></div>
        <div class="nmReviewCard"><span>Ширина полотна</span><b>${h(width)}</b><div>Источник цены: ${h(priceSource)}</div></div>
      </div>${warning}
      <table class="nmReviewTable"><thead><tr><th>№</th><th>Артикул</th><th>Позиция</th><th>Количество</th><th>Цена</th><th>Сумма</th></tr></thead><tbody>${rows||'<tr><td colspan="6">Позиции не распознаны</td></tr>'}</tbody></table>
      <div style="text-align:right;font-size:20px;font-weight:800;margin-top:10px">Итого: ${m(info.total)}</div>
      <div class="nmReviewActions"><button id="nmReviewBack8923" class="secondary" type="button">Закрыть без продажи</button><button id="nmReviewSale8923" class="primary" type="button" ${info.duplicate||info.total<=0||!info.mat||(+info.mat.price||0)<=0?'disabled':''}>Оформить как продажу дилеру</button></div>`;
      body.querySelector('#nmReviewBack8923').onclick=()=>{o.classList.add('hidden');showPendingBanner()};
      body.querySelector('#nmReviewSale8923').onclick=()=>{
        disableAutoPost();
        // Populate the application's lexical nmCurrent/nmPreviewItems only at
        // the confirmation step. 'пересчёт' prevents a second notification.
        if(typeof showNewMatRosPreview!=='function')return alert('Не найден модуль расчёта NewMatRos.');
        showNewMatRosPreview(data,'пересчёт');
        const before=(typeof state!=='undefined'&&Array.isArray(state.ops))?state.ops.length:0;
        if(typeof postNewMatRosOrder!=='function')return alert('Не найден модуль оформления продажи NewMatRos.');
        postNewMatRosOrder(false);
        const ops=(typeof state!=='undefined'&&Array.isArray(state.ops))?state.ops:[];
        if(ops.length>before){
          const op=ops.slice().reverse().find(x=>x.type==='sale'&&x.source==='NewMatRos');
          clearPending();
          try{if(typeof clearNewMatRosNotification==='function')clearNewMatRosNotification()}catch(_){ }
          document.getElementById('nmLiveBanner')?.classList.add('hidden');
          o.classList.add('hidden');
          if(op&&typeof showReceiptFromHistory==='function')setTimeout(()=>showReceiptFromHistory(op.id),80);
        }
      };
      o.classList.remove('hidden');
      try{if(typeof go==='function')go('newmatros')}catch(_){ }
      try{if(typeof clearNewMatRosNotification==='function')clearNewMatRosNotification()}catch(_){ }
    }catch(e){
      console.error('NewMatRos review',e);
      alert('Не удалось открыть выгрузку NewMatRos: '+String(e&&e.message||e));
    }
  }

  function ensureBanner(){
    let b=document.getElementById('nmLiveBanner');
    if(!b){
      b=document.createElement('div');b.id='nmLiveBanner';b.className='hidden';
      b.style.cssText='position:fixed;left:250px;right:24px;top:78px;z-index:420;background:#fff7e8;border:1px solid #efc875;border-radius:12px;padding:11px 14px;box-shadow:0 8px 24px #0002;display:flex;align-items:center;justify-content:space-between;gap:12px';
      b.innerHTML='<div><b style="color:#8a5a00">Новая выгрузка NewMatRos</b><div id="nmLiveBannerText" style="margin-top:3px"></div></div><div class="actions"><button id="nmLiveOpen" class="primary" type="button">Открыть</button><button id="nmLiveClose" class="secondary" type="button">Закрыть</button></div>';
      document.body.appendChild(b);
    }
    const old=b.querySelector('#nmLiveOpen');
    if(old&&!old.dataset.reviewFlow){
      const fresh=old.cloneNode(true);fresh.dataset.reviewFlow='1';old.replaceWith(fresh);
      fresh.addEventListener('click',()=>{const p=pendingPayload();if(p)showReview(p);else alert('Последняя выгрузка NewMatRos не найдена. Сделай выгрузку ещё раз.')});
    }
    const close=b.querySelector('#nmLiveClose');
    if(close&&!close.dataset.reviewFlow){const f=close.cloneNode(true);f.dataset.reviewFlow='1';close.replaceWith(f);f.addEventListener('click',()=>b.classList.add('hidden'))}
    return b;
  }

  function showPendingBanner(payload){
    const p=payload||pendingPayload();if(!p?.text)return;
    const b=ensureBanner(),t=b.querySelector('#nmLiveBannerText');
    let label='Получен файл '+(p.name||'NewMatRos')+'. Нажми «Открыть» для проверки перед продажей.';
    try{const d=parsePayload(p),z=d['Заказ']||{},c=d['Контрагент']||{};label='Заказ '+(z['НомерРасчета']||'без номера')+(c['Наименование']?' · '+c['Наименование']:'')+'. Нажми «Открыть» для проверки перед продажей.'}catch(_){ }
    if(t)t.textContent=label;b.classList.remove('hidden');
  }

  function receivePayload(payload){
    if(!payload?.text)return;
    disableAutoPost();persistPayload(payload);
    try{const data=parsePayload(payload);if(typeof markNewMatRosNotification==='function')markNewMatRosNotification(data)}catch(e){console.error('NewMatRos notification parse',e)}
    showPendingBanner(payload);
  }

  disableAutoPost();
  if(window.newmatrosAPI?.setIniHandler)window.newmatrosAPI.setIniHandler(receivePayload);
  else if(window.newmatrosAPI?.onIni)window.newmatrosAPI.onIni(receivePayload);

  const pending=pendingPayload();if(pending?.text)setTimeout(()=>showPendingBanner(pending),100);
})();
