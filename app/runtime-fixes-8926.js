(()=>{
  if(window.__uchetRuntime8926)return;
  window.__uchetRuntime8926=true;

  const DRAFT_KEY='uchetNewMatRosOpenSale8926';
  const OLD_PENDING_KEY='uchetNewMatRosPending8923';
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const m=n=>{try{return typeof money==='function'?money(n):((+n||0).toLocaleString('ru-RU')+' ₽')}catch(_){return (+n||0).toLocaleString('ru-RU')+' ₽'}};
  const num=v=>{const n=Number(String(v??'').replace(',','.').replace(/[^0-9.\-]/g,''));return Number.isFinite(n)?n:0};
  const norm=v=>String(v||'').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/gi,' ').replace(/\s+/g,' ').trim();
  const digits=v=>String(v||'').replace(/\D/g,'').replace(/^8(?=\d{10}$)/,'7');

  function disableAutoPost(){
    try{
      if(typeof state!=='undefined'){
        state.newmatros=state.newmatros||{};
        state.newmatros.autoPost=false;
        localStorage.setItem(typeof KEY!=='undefined'?KEY:'uchet_dilerov_v8',JSON.stringify(state));
        const cb=document.getElementById('nmAutoPost');if(cb)cb.checked=false;
      }
    }catch(e){console.error('8.9.26 disable auto post',e)}
  }

  function loadDraft(){try{return JSON.parse(localStorage.getItem(DRAFT_KEY)||'null')}catch(_){return null}}
  function saveDraft(d){try{if(d)localStorage.setItem(DRAFT_KEY,JSON.stringify(d));else localStorage.removeItem(DRAFT_KEY)}catch(e){console.error('8.9.26 save draft',e)}}
  function clearOldPending(){try{localStorage.removeItem(OLD_PENDING_KEY)}catch(_){}}

  function parsePayload(payload){
    if(!payload?.text)throw new Error('Файл выгрузки пустой');
    if(typeof parseIni!=='function')throw new Error('Модуль разбора NewMatRos не загружен');
    const data=parseIni(payload.text);
    if(!data||typeof data!=='object')throw new Error('Не удалось разобрать INI NewMatRos');
    return data;
  }

  function alreadyImported(key){
    if(!key||typeof state==='undefined')return false;
    return (state.ops||[]).some(o=>o.type==='sale'&&o.source==='NewMatRos'&&(
      o.newmatrosKey===key ||
      (Array.isArray(o.newmatrosKeys)&&o.newmatrosKeys.includes(key)) ||
      (Array.isArray(o.newmatrosCeilings)&&o.newmatrosCeilings.some(c=>c?.key===key))
    ));
  }
  window.nmAlreadyImported=alreadyImported;

  function nmNumSafe(v){try{return typeof nmNum==='function'?nmNum(v):num(v)}catch(_){return num(v)}}
  function widthOf(data,z){
    let width=0;
    try{if(typeof nmFindRollWidth==='function')width=+nmFindRollWidth(data)||0}catch(_){ }
    if(width)return width;
    for(const k of ['ШиринаПолотна','ШиринаРулона','ШиринаМатериала','МатериалШирина','Ширина']){
      let n=num(z[k]);if(!n)continue;if(n>1000)n/=1000;else if(n>10)n/=100;width=n;break;
    }
    return width;
  }

  function ceilingFrom(data,payload){
    const z=data?.['Заказ']||{},c=data?.['Контрагент']||{};
    if(typeof nmFindDealer!=='function')throw new Error('Не загружен поиск дилера NewMatRos');
    if(typeof nmBuildItems!=='function')throw new Error('Не загружен расчёт позиций NewMatRos');
    const found=nmFindDealer(data)||{};
    const dealer=found.dealer||null;
    const name=dealer?.name||found.name||c['Наименование']||c['ФИО']||c['Контрагент']||'Дилер не определён';
    const phone=dealer?.phone||found.rawPhone||c['Телефон']||'';
    const items=(nmBuildItems(data)||[]).map(x=>({...x}));
    const total=items.reduce((s,i)=>s+(Number.isFinite(+i.total)?+i.total:(+i.qty||0)*(+i.price||0)),0);
    const mat=items.find(i=>i.article==='NM-MAT')||null;
    const width=widthOf(data,z);
    let key='';try{if(typeof nmOrderKey==='function')key=String(nmOrderKey(data)||'').trim()}catch(_){ }
    if(!key||key==='|')key='fallback|'+[z['НомерРасчета']||'',z['ИндексПотолка']||'',z['МатериалМатериал']||z['МатериалКаталог']||'',z['МатериалЦвет']||'',nmNumSafe(z['КоличествоПродукция']),nmNumSafe(z['ПериметрПомещения']),width].join('|');
    return {
      key,fileName:payload?.name||'NewMatRos.ini',ts:Date.now(),dealerId:dealer?.id??null,dealerName:name,dealerPhone:phone,
      number:String(z['НомерРасчета']||''),ceilingIndex:String(z['ИндексПотолка']||''),material:String(z['МатериалКаталог']||z['МатериалМатериал']||''),color:String(z['МатериалЦвет']||''),
      width,area:nmNumSafe(z['КоличествоПродукция']),perimeter:nmNumSafe(z['ПериметрПомещения']),plannedDate:String(c['ПланируемаяДата']||''),drawing:String(z['ЧертежПокупатель']||''),
      items,total,materialPrice:+mat?.price||0,priceProductName:String(mat?.priceProductName||''),priceSource:String(mat?.priceSource||'')
    };
  }

  function sameDealer(draft,ceil){
    if(!draft||!ceil)return false;
    if(draft.dealerId!=null&&ceil.dealerId!=null)return String(draft.dealerId)===String(ceil.dealerId);
    const aPhone=digits(draft.dealerPhone),bPhone=digits(ceil.dealerPhone);if(aPhone&&bPhone&&aPhone===bPhone)return true;
    const a=norm(draft.dealerName),b=norm(ceil.dealerName);return !!a&&!!b&&(a===b||(a.length>=4&&b.length>=4&&(a.includes(b)||b.includes(a))));
  }

  function draftTotal(d){return (d?.ceilings||[]).reduce((s,c)=>s+(+c.total||0),0)}
  function draftHasErrors(d){return (d?.ceilings||[]).some(c=>!(+c.total>0)||!(+c.materialPrice>0))}

  function ensureUi(){
    if(!document.getElementById('nmDraftStyle8926')){
      const css=document.createElement('style');css.id='nmDraftStyle8926';css.textContent=`
      #nmDraftBanner8926{position:fixed;left:250px;right:24px;top:78px;z-index:430;background:#eef8f4;border:1px solid #9fd1bc;border-radius:12px;padding:11px 14px;box-shadow:0 8px 24px #0002;display:flex;align-items:center;justify-content:space-between;gap:12px}#nmDraftBanner8926.hidden{display:none!important}
      #nmDraftModal8926{position:fixed;inset:0;z-index:520;background:#0009;display:flex;align-items:center;justify-content:center;padding:18px}#nmDraftModal8926.hidden{display:none!important}.nmDraftBox{width:min(1120px,97vw);max-height:93vh;overflow:auto;background:#fff;border-radius:18px;padding:20px;box-shadow:0 25px 90px #0006}.nmDraftHead{display:flex;justify-content:space-between;align-items:center;gap:12px}.nmDraftHead h2{margin:0}.nmDraftSummary{display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px;margin:14px 0}.nmDraftCard{background:#f8fbfa;border:1px solid #d7e7e1;border-radius:12px;padding:11px}.nmDraftCard span{display:block;color:#68756f;font-size:12px}.nmDraftCard b{font-size:18px}.nmCeiling{border:1px solid #d8dee7;border-radius:12px;margin:12px 0;overflow:hidden}.nmCeilingHead{display:flex;justify-content:space-between;gap:12px;background:#f5f8f7;padding:10px 12px}.nmCeilingMeta{font-size:12px;color:#566274;margin-top:4px}.nmCeiling table{margin:0;border:0;border-radius:0;box-shadow:none}.nmCeiling th,.nmCeiling td{padding:5px 7px;font-size:12px}.nmDraftWarn{background:#fff4e5;border:1px solid #efc875;color:#7a5200;border-radius:10px;padding:10px;margin:10px 0}.nmDraftOk{background:#edf8f3;border:1px solid #b9dfcc;color:#245b46;border-radius:10px;padding:10px;margin:10px 0}.nmDraftActions{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-top:14px}@media(max-width:900px){.nmDraftSummary{grid-template-columns:1fr}}
      `;document.head.appendChild(css);
    }
    let banner=document.getElementById('nmDraftBanner8926');
    if(!banner){banner=document.createElement('div');banner.id='nmDraftBanner8926';banner.className='hidden';banner.innerHTML='<div><b>Открытая продажа NewMatRos</b><div id="nmDraftBannerText8926" style="margin-top:3px"></div></div><div class="actions"><button id="nmDraftOpen8926" class="primary" type="button">Открыть продажу</button></div>';document.body.appendChild(banner);banner.querySelector('#nmDraftOpen8926').onclick=()=>renderDraft(true)}
    let modal=document.getElementById('nmDraftModal8926');
    if(!modal){modal=document.createElement('div');modal.id='nmDraftModal8926';modal.className='hidden';modal.innerHTML='<div class="nmDraftBox"><div class="nmDraftHead"><h2>Открытая продажа NewMatRos</h2><button id="nmDraftHide8926" class="secondary" type="button">Свернуть и продолжить выгрузку</button></div><div id="nmDraftBody8926"></div></div>';document.body.appendChild(modal);modal.querySelector('#nmDraftHide8926').onclick=()=>modal.classList.add('hidden');modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.add('hidden')})}
    return {banner,modal};
  }

  function renderDraft(openModal=false){
    const d=loadDraft(),ui=ensureUi();
    if(!d||!(d.ceilings||[]).length){ui.banner.classList.add('hidden');ui.modal.classList.add('hidden');return}
    const total=draftTotal(d),count=d.ceilings.length;
    ui.banner.querySelector('#nmDraftBannerText8926').textContent=d.dealerName+' · потолков: '+count+' · итого '+m(total)+' · новые выгрузки добавляются сюда автоматически до закрытия продажи.';
    ui.banner.classList.remove('hidden');
    const body=ui.modal.querySelector('#nmDraftBody8926');
    const ceilings=d.ceilings.map((c,idx)=>{
      const rows=(c.items||[]).map((i,n)=>'<tr><td>'+(n+1)+'</td><td>'+h(i.article||'')+'</td><td>'+h(i.name||'')+'</td><td>'+h(i.qty||0)+' '+h(i.unit||'')+'</td><td>'+m(i.price)+'</td><td>'+m(Number.isFinite(+i.total)?+i.total:(+i.qty||0)*(+i.price||0))+'</td></tr>').join('');
      const width=c.width?c.width.toLocaleString('ru-RU',{maximumFractionDigits:2})+' м':'не распознана';
      const priceSource=c.priceProductName?('Карточка: '+c.priceProductName):(c.priceSource||'—');
      const warn=!(+c.materialPrice>0)?'<div class="nmDraftWarn" style="margin:8px 12px"><b>Цена плёнки не определена.</b> Этот потолок нужно проверить до закрытия продажи.</div>':'';
      return `<div class="nmCeiling"><div class="nmCeilingHead"><div><b>Потолок ${idx+1}${c.ceilingIndex?' · индекс '+h(c.ceilingIndex):''}</b><div class="nmCeilingMeta">Расчёт: ${h(c.number||'—')} · ${h(c.material||'—')} · цвет ${h(c.color||'—')} · ширина ${h(width)} · площадь ${h(c.area||0)} м²</div><div class="nmCeilingMeta">Источник цены: ${h(priceSource)}</div></div><b>${m(c.total)}</b></div>${warn}<table><thead><tr><th>№</th><th>Артикул</th><th>Позиция</th><th>Количество</th><th>Цена</th><th>Сумма</th></tr></thead><tbody>${rows||'<tr><td colspan="6">Позиции не распознаны</td></tr>'}</tbody></table></div>`;
    }).join('');
    const warning=draftHasErrors(d)?'<div class="nmDraftWarn"><b>Продажу пока нельзя закрыть:</b> в одном из потолков не определена цена или сумма.</div>':'<div class="nmDraftOk"><b>Продажа открыта.</b> Продолжай выгружать потолки этого клиента — они будут добавляться автоматически в этот же чек.</div>';
    body.innerHTML=`<div class="nmDraftSummary"><div class="nmDraftCard"><span>Дилер</span><b>${h(d.dealerName)}</b><div>${h(d.dealerPhone||'')}</div></div><div class="nmDraftCard"><span>Потолков в продаже</span><b>${count}</b></div><div class="nmDraftCard"><span>Общая сумма</span><b>${m(total)}</b></div></div>${warning}${ceilings}<div class="nmDraftActions"><button id="nmDraftKeep8926" class="secondary" type="button">Свернуть и продолжить выгрузку</button><button id="nmDraftFinish8926" class="primary" type="button" ${draftHasErrors(d)?'disabled':''}>Закрыть и оформить продажу</button></div>`;
    body.querySelector('#nmDraftKeep8926').onclick=()=>ui.modal.classList.add('hidden');
    body.querySelector('#nmDraftFinish8926').onclick=finishDraft;
    if(openModal)ui.modal.classList.remove('hidden');
  }

  function addCeiling(payload){
    disableAutoPost();
    try{
      const data=parsePayload(payload),ceil=ceilingFrom(data,payload);
      if(alreadyImported(ceil.key)){renderDraft(false);alert('Этот потолок уже был оформлен раньше. Повторно в продажу он не добавлен.');return}
      let d=loadDraft();
      if(d&&(d.ceilings||[]).some(x=>x.key===ceil.key)){renderDraft(true);alert('Этот потолок уже есть в открытой продаже. Повторно он не добавлен.');return}
      if(d&&!sameDealer(d,ceil)){renderDraft(true);alert('Сейчас открыта продажа для «'+d.dealerName+'». Новая выгрузка относится к другому дилеру «'+ceil.dealerName+'» и не была добавлена. Сначала закрой текущую продажу.');return}
      if(!d)d={version:1,createdAt:Date.now(),dealerId:ceil.dealerId,dealerName:ceil.dealerName,dealerPhone:ceil.dealerPhone,ceilings:[]};
      else{if(d.dealerId==null&&ceil.dealerId!=null)d.dealerId=ceil.dealerId;if(!d.dealerPhone&&ceil.dealerPhone)d.dealerPhone=ceil.dealerPhone;if((!d.dealerName||d.dealerName==='Дилер не определён')&&ceil.dealerName)d.dealerName=ceil.dealerName}
      d.ceilings.push(ceil);d.updatedAt=Date.now();saveDraft(d);
      try{if(typeof clearNewMatRosNotification==='function')clearNewMatRosNotification()}catch(_){ }
      clearOldPending();try{if(typeof go==='function')go('newmatros')}catch(_){ }renderDraft(true);
      const s=document.getElementById('nmStatus');if(s)s.textContent='Открытая продажа: '+d.dealerName+' · добавлен потолок '+d.ceilings.length+' · итого '+m(draftTotal(d));
    }catch(e){console.error('8.9.26 add ceiling',e);alert('Не удалось добавить потолок из NewMatRos: '+String(e&&e.message||e))}
  }

  function finishDraft(){
    const d=loadDraft();if(!d||!(d.ceilings||[]).length)return;
    if(draftHasErrors(d))return alert('Не все потолки рассчитаны правильно. Проверь цену и сумму перед закрытием продажи.');
    if(!confirm('Закрыть продажу для «'+d.dealerName+'»?\nПотолков: '+d.ceilings.length+'\nИтого: '+m(draftTotal(d))+'\n\nПосле подтверждения будет создан один чек и долг дилера увеличится на общую сумму.'))return;
    try{
      let dealer=null;
      if(d.dealerId!=null)dealer=(state.dealers||[]).find(x=>String(x.id)===String(d.dealerId))||null;
      if(!dealer){const p=digits(d.dealerPhone),n=norm(d.dealerName);dealer=(state.dealers||[]).find(x=>(p&&digits(x.phone)===p)||(n&&norm(x.name)===n))||null}
      if(!dealer){dealer={id:Date.now(),name:d.dealerName||'Дилер NewMatRos',phone:d.dealerPhone||'',city:'',note:'Создан автоматически из NewMatRos'};state.dealers.push(dealer)}
      const total=draftTotal(d),numReceipt=state.receiptSeq++,now=Date.now(),date=new Date().toLocaleString('ru-RU');
      const flat=[];d.ceilings.forEach((c,idx)=>(c.items||[]).forEach(i=>flat.push({...i,name:'Потолок '+(idx+1)+' · '+String(i.name||''),ceilingNo:idx+1,ceilingIndex:c.ceilingIndex,newmatrosKey:c.key})));
      const first=d.ceilings[0]||{};
      const op={id:now+1,ts:now,type:'sale',date,dealerId:dealer.id,dealer:dealer.name,receiptNo:numReceipt,items:flat,total,profit:0,source:'NewMatRos',newmatrosKey:first.key||'',newmatrosKeys:d.ceilings.map(c=>c.key),newmatrosCeilings:d.ceilings.map((c,idx)=>({key:c.key,no:idx+1,number:c.number,ceilingIndex:c.ceilingIndex,material:c.material,color:c.color,width:c.width,area:c.area,perimeter:c.perimeter,total:c.total,plannedDate:c.plannedDate,drawing:c.drawing})),newmatros:{number:first.number||'',ceilingIndex:first.ceilingIndex||'',material:first.material||'',color:first.color||'',area:d.ceilings.reduce((s,c)=>s+(+c.area||0),0),perimeter:d.ceilings.reduce((s,c)=>s+(+c.perimeter||0),0),ceilingCount:d.ceilings.length}};
      state.ops.push(op);save();saveDraft(null);clearOldPending();try{if(typeof clearNewMatRosNotification==='function')clearNewMatRosNotification()}catch(_){ }renderDraft(false);
      const s=document.getElementById('nmStatus');if(s)s.textContent='Продажа закрыта: '+dealer.name+' · потолков '+d.ceilings.length+' · чек № '+numReceipt+' · долг увеличен на '+m(total);
      if(typeof showReceiptFromHistory==='function')setTimeout(()=>showReceiptFromHistory(op.id),80);else alert('Продажа оформлена. Чек № '+numReceipt+' · '+m(total));
    }catch(e){console.error('8.9.26 finish draft',e);alert('Не удалось закрыть продажу NewMatRos: '+String(e&&e.message||e))}
  }

  disableAutoPost();clearOldPending();document.getElementById('nmLiveBanner')?.remove();document.getElementById('nmReviewModal8923')?.remove();
  if(window.newmatrosAPI?.setIniHandler)window.newmatrosAPI.setIniHandler(addCeiling);else if(window.newmatrosAPI?.onIni)window.newmatrosAPI.onIni(addCeiling);
  renderDraft(false);
  const old=document.getElementById('runtime8921Badge');if(old)old.textContent='исправления 8.9.26 активны';
  document.documentElement.dataset.uchetRuntime='8.9.26';
})();
