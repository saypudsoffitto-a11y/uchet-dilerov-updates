(()=>{
  let onlyDebtors=false;
  const paths=['<circle cx="12" cy="8" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3M3 7a3 3 0 0 1 3-3M21 7a3 3 0 0 0-3-3"/>','<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"/>','<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 5V3h8v2M10 10h3a2 2 0 0 1 0 4h-3M10 10v7M8 15h7"/>','<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v12c0 4 16 4 16 0V5M4 11c0 4 16 4 16 0"/>'];
  document.querySelectorAll('.metricIcon').forEach((el,i)=>el.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+paths[i]+'</svg>');
  const productHint=document.querySelector('#products .sectionHint');if(productHint)productHint.textContent='Поиск, цены и остатки товаров. Повторяющиеся карточки автоматически объединяются в один товар.';
  const productSearch=document.getElementById('productListSearch');if(productSearch)productSearch.placeholder='Поиск товара по названию, артикулу или группе';
  window.setHomeDebtFilter=value=>{
    onlyDebtors=!!value;
    for(const [id,active] of [['homeAll',!value],['homeDebtors',!!value]]){
      const b=document.getElementById(id);if(!b)continue;b.className=active?'primary':'secondary';b.setAttribute('aria-pressed',String(active));
    }
    renderHomeDashboard();
  };
  window.renderHomeDashboard=()=>{
    if(!document.getElementById('home')?.classList.contains('hidden'))document.getElementById('pageTitle').textContent='Главная';
    const now=new Date(),today=o=>{const d=new Date(opTime(o));return d.toDateString()===now.toDateString()};
    const todaySales=document.getElementById('todaySales'),todayPayments=document.getElementById('todayPayments');
    if(todaySales)todaySales.textContent=state.ops.filter(o=>o.type==='sale'&&today(o)).length;
    if(todayPayments)todayPayments.textContent=money(state.ops.filter(o=>o.type==='payment'&&today(o)).reduce((s,o)=>s+(+o.total||0),0));
    const query=(document.getElementById('homeSearch')?.value||'').trim().toLocaleLowerCase('ru');
    const arr=state.dealers.filter(d=>(d.name+' '+(d.phone||'')).toLocaleLowerCase('ru').includes(query)&&(!onlyDebtors||debtOf(d.id)>0)).sort((a,b)=>lastDealerActivity(b.id)-lastDealerActivity(a.id)||String(a.name).localeCompare(String(b.name),'ru'));
    const body=document.getElementById('homeDealerRows');if(!body)return;body.replaceChildren();
    for(const d of arr){
      const last=state.ops.filter(o=>o.type==='sale'&&o.dealerId==d.id).sort((a,b)=>opTime(b)-opTime(a))[0];
      const tr=document.createElement('tr');tr.className='clickable';tr.tabIndex=0;
      const open=()=>openDealer(d.id);tr.onclick=open;tr.onkeydown=e=>{if(e.target===tr&&e.key==='Enter'){e.preventDefault();open()}};
      tr.innerHTML='<td><div class="homeDealer"><span class="homeAvatar">'+esc(String(d.name||'?').slice(0,2).toUpperCase())+'</span><div><b>'+esc(d.name)+'</b><small>'+esc(d.phone||'')+'</small></div></div></td><td>'+esc(d.city||'—')+'</td><td>'+esc(last?last.date:'—')+'</td><td class="'+(debtOf(d.id)>0?'danger':'ok')+'"><b>'+money(debtOf(d.id))+'</b></td><td><button class="secondary miniBtn">Открыть →</button></td>';
      tr.querySelector('button').onclick=e=>{e.stopPropagation();open()};body.appendChild(tr);
    }
    document.getElementById('homeEmpty')?.classList.toggle('hidden',arr.length>0);
  };

  const status=document.getElementById('syncStatus'),indicator=document.getElementById('connectionIndicator');
  const updateStatus=()=>{
    if(!indicator)return;
    const text=status?.textContent||'';
    const configured=!!state.sync?.url,enabled=!!state.sync?.enabled;
    const ok=configured&&!!status?.querySelector('.serverOk'),bad=configured&&!!status?.querySelector('.serverBad');
    indicator.dataset.status=ok?'online':bad?'offline':'idle';
    indicator.textContent=!configured?'Сервер не настроен':bad?'Нет связи с сервером':ok?(enabled?'Сервер подключён':'Автосинхронизация выключена'):enabled?'Подключение к серверу…':'Автосинхронизация выключена';
    indicator.title=text||'Открыть настройки общего сервера';
  };
  if(status)new MutationObserver(updateStatus).observe(status,{subtree:true,childList:true,characterData:true});

  const DRAFT_KEY='uchetNewMatRosOpenSale8926';
  function cancelNewMatRosDraft8946(){
    let draft=null;try{draft=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null')}catch(_){}
    if(!draft){document.getElementById('nmDraftBanner8926')?.classList.add('hidden');return}
    const count=(draft.ceilings||[]).length,dealer=draft.dealerName||'дилера';
    if(!confirm('Отменить ошибочную выгрузку NewMatRos для «'+dealer+'»?\n\nПотолков в открытой продаже: '+count+'. Продажа и долг созданы не будут.'))return;
    try{
      const copy={...draft,cancelledAt:Date.now(),cancelledReason:'user'};
      localStorage.setItem(DRAFT_KEY+'-cancelled-'+copy.cancelledAt,JSON.stringify(copy));
      localStorage.removeItem(DRAFT_KEY);
    }catch(e){alert('Не удалось отменить выгрузку: '+e.message);return}
    document.getElementById('nmDraftBanner8926')?.classList.add('hidden');
    document.getElementById('nmDraftModal8926')?.classList.add('hidden');
    try{if(typeof clearNewMatRosNotification==='function')clearNewMatRosNotification()}catch(_){}
    const s=document.getElementById('nmStatus');if(s)s.textContent='Ошибочная выгрузка NewMatRos отменена. Продажа и долг не созданы.';
  }
  window.cancelNewMatRosDraft8946=cancelNewMatRosDraft8946;

  function enhanceNewMatRosNotices(){
    const workspace=document.getElementById('workspaceNotices');
    for(const id of ['nmDraftBanner8926','nmLiveBanner']){
      const el=document.getElementById(id);if(el&&workspace&&el.parentElement!==workspace)workspace.appendChild(el);
    }
    const banner=document.getElementById('nmDraftBanner8926');if(!banner)return;
    const actions=banner.querySelector('.actions');
    const open=banner.querySelector('#nmDraftOpen8926');
    if(open){
      if(!open.classList.contains('nmDraftOpenRed8946')){open.classList.remove('primary','secondary','dangerBtn');open.classList.add('nmDraftOpenRed8946')}
      if(open.textContent!=='Открыть продажу')open.textContent='Открыть продажу';
    }
    if(actions&&!banner.querySelector('#nmDraftCancel8926')){
      const cancel=document.createElement('button');cancel.id='nmDraftCancel8926';cancel.type='button';cancel.className='secondary nmDraftCancel8946';cancel.textContent='Отмена';cancel.onclick=cancelNewMatRosDraft8946;actions.appendChild(cancel);
    }
  }
  const noticeObserver=new MutationObserver(enhanceNewMatRosNotices);noticeObserver.observe(document.body,{childList:true,subtree:true});enhanceNewMatRosNotices();

  const closeReceiptContextMenu=()=>document.getElementById('dealerReceiptContextMenu8946')?.remove();
  function showDealerReceiptContextMenu(e,id){
    e.preventDefault();e.stopPropagation();closeReceiptContextMenu();
    const op=(state.ops||[]).find(o=>String(o.id)===String(id)&&o.type==='sale');if(!op)return;
    const menu=document.createElement('div');menu.id='dealerReceiptContextMenu8946';menu.className='dealerReceiptContextMenu8946';
    menu.style.left=Math.min(e.clientX,window.innerWidth-250)+'px';menu.style.top=Math.min(e.clientY,window.innerHeight-120)+'px';
    const open=document.createElement('button');open.type='button';open.textContent='Открыть чек';open.onclick=()=>{closeReceiptContextMenu();showReceiptFromHistory(op.id)};
    const del=document.createElement('button');del.type='button';del.className='dangerMenuItem';del.textContent='Удалить чек';del.onclick=()=>{closeReceiptContextMenu();if(typeof archiveReceipt==='function')archiveReceipt(op.id);else alert('Архив чеков ещё загружается. Повтори действие через секунду.')};
    menu.append(open,del);document.body.appendChild(menu);
  }
  window.showDealerReceiptContextMenu8946=showDealerReceiptContextMenu;
  document.addEventListener('click',closeReceiptContextMenu);window.addEventListener('blur',closeReceiptContextMenu);

  function decorateDealerCard8946(id){
    const root=document.getElementById('dealerModalBody');if(!root)return;
    const summary=[...root.querySelectorAll(':scope > .grid > .card')].slice(0,3);
    if(summary.length===3){
      summary.forEach(c=>c.classList.add('dealerMetric8946'));
      summary[0].classList.add('dealerMetricSales8946');
      summary[1].classList.add('dealerMetricPaid8946');
      const debt=+debtOf(id)||0;summary[2].classList.add(debt>0?'dealerMetricDebt8946':'dealerMetricClear8946');
      const big=summary[2].querySelector('.big');if(big){big.classList.toggle('danger',debt>0);big.classList.toggle('ok',debt<=0)}
    }
    root.querySelectorAll('.dealerHistoryDetail tbody tr').forEach(row=>{
      const label=row.cells?.[1]?.textContent||'',match=label.match(/Накладная\s*№\s*(.+)/i);if(!match)return;
      const receiptNo=match[1].trim();
      const op=(state.ops||[]).find(o=>o.type==='sale'&&String(o.dealerId)===String(id)&&String(o.receiptNo)===receiptNo);if(!op)return;
      row.dataset.receiptId=String(op.id);row.title='Правая кнопка мыши: открыть или удалить чек';row.oncontextmenu=e=>showDealerReceiptContextMenu(e,op.id);
    });
  }
  function installDealerDecorator(){
    const current=typeof openDealer==='function'?openDealer:null;if(!current||current.__ui8946)return;
    const wrapped=function(id){const result=current.apply(this,arguments);decorateDealerCard8946(id);setTimeout(()=>decorateDealerCard8946(id),0);return result};wrapped.__ui8946=true;wrapped.__base=current;
    window.openDealer=wrapped;try{openDealer=wrapped}catch(_){}
  }
  installDealerDecorator();setTimeout(installDealerDecorator,1500);setTimeout(installDealerDecorator,5000);

  // 8.9.73: editable receipt item names, manual free-form positions and denser product table.
  const patchStyle8973=document.createElement('style');
  patchStyle8973.textContent=`
    #products .productTable th,#products .productTable td{padding:5px 6px!important;line-height:1.08!important}
    #products .productTable .compactGroup8973{width:78px!important;min-width:78px!important;max-width:78px!important}
    #products .productTable .compactArticle8973{width:82px!important;min-width:82px!important;max-width:82px!important}
    #products .productTable td.compactGroup8973,#products .productTable td.compactArticle8973{overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
    .receiptNameInput8973{width:100%;min-width:190px;padding:5px 6px;border:1px solid #b8c3d1;border-radius:6px;font:inherit;background:#fff}
    .receiptNameInput8973:focus{border-color:#75a8ec;box-shadow:0 0 0 2px #eaf2ff;outline:none}
    .manualReceiptGrid8973{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:10px;align-items:end}
    @media(max-width:760px){.manualReceiptGrid8973{grid-template-columns:1fr 1fr}.manualReceiptGrid8973 .name8973{grid-column:1/-1}}
    @media print{.receiptNameInput8973{border:0!important;box-shadow:none!important;padding:0!important;background:transparent!important;color:#111!important}}
  `;
  document.head.appendChild(patchStyle8973);

  function compactProductColumns8973(){
    const table=document.querySelector('#products .productTable');if(!table)return;
    const headers=[...table.querySelectorAll('thead th')];
    for(const [label,cls] of [['Группа','compactGroup8973'],['Артикул','compactArticle8973']]){
      const th=headers.find(x=>x.textContent.trim()===label);if(!th)continue;
      const key=th.dataset.colKey;th.classList.add(cls);
      table.querySelectorAll('tbody tr').forEach(row=>{const td=[...row.children].find(x=>x.dataset.colKey===key);if(td)td.classList.add(cls)});
    }
  }

  function recalcReceipt8973(op){
    op.total=(op.items||[]).reduce((s,i)=>s+(+i.total||0),0);
    op.profit=(op.items||[]).reduce((s,i)=>s+(+i.profit||0),0);
    op.updatedAt=Date.now();
  }
  function editReceiptItemName8973(opId,itemIndex,value){
    const op=(state.ops||[]).find(x=>String(x.id)===String(opId)&&x.type==='sale');
    const item=op&&op.items&&op.items[itemIndex];if(!item)return;
    const name=String(value||'').trim();
    if(!name){alert('Название товара не может быть пустым.');if(typeof refreshReceiptViews==='function')refreshReceiptViews(opId);return}
    if(item.name===name)return;
    item.name=name;recalcReceipt8973(op);save();
    if(typeof refreshReceiptViews==='function')refreshReceiptViews(opId);
  }
  window.editReceiptItemName8973=editReceiptItemName8973;

  let manualReceiptOpId8973=null,manualReceiptModal8973=null;
  function ensureManualReceiptModal8973(){
    if(manualReceiptModal8973)return manualReceiptModal8973;
    const modal=document.createElement('div');modal.id='manualReceiptModal8973';modal.className='modal hidden';
    modal.innerHTML='<div class="modalBox" style="max-width:820px"><div class="actions" style="justify-content:space-between"><h2 style="margin:0">Своя позиция в накладной</h2><button id="manualReceiptClose8973" class="secondary" type="button">Закрыть</button></div><p class="muted">Можно вписать любое название, количество и цену. Сумма накладной и долг пересчитаются автоматически.</p><div class="manualReceiptGrid8973"><label class="name8973">Название<input id="manualReceiptName8973" autocomplete="off" placeholder="Например: Монтаж световой линии"></label><label>Количество<input id="manualReceiptQty8973" type="number" min="0.001" step="any" value="1"></label><label>Ед.<input id="manualReceiptUnit8973" value="шт"></label><label>Цена, ₽<input id="manualReceiptPrice8973" type="number" min="0" step="0.01" value="0"></label></div><p id="manualReceiptTotal8973" style="font-weight:700"></p><p id="manualReceiptError8973" role="alert" style="color:#a22"></p><div class="actions"><button id="manualReceiptSave8973" class="primary" type="button">Добавить в накладную</button><button id="manualReceiptCancel8973" class="secondary" type="button">Отмена</button></div></div>';
    document.body.appendChild(modal);manualReceiptModal8973=modal;
    const $=id=>document.getElementById(id),close=()=>{modal.classList.add('hidden');manualReceiptOpId8973=null;$('manualReceiptError8973').textContent=''};
    const updateTotal=()=>{const q=Number($('manualReceiptQty8973').value)||0,p=Number($('manualReceiptPrice8973').value)||0;$('manualReceiptTotal8973').textContent='Сумма позиции: '+money(q*p)};
    $('manualReceiptClose8973').onclick=close;$('manualReceiptCancel8973').onclick=close;
    $('manualReceiptQty8973').oninput=updateTotal;$('manualReceiptPrice8973').oninput=updateTotal;
    modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close()}else if(e.key==='Enter'&&!e.shiftKey&&e.target.tagName!=='BUTTON'){e.preventDefault();$('manualReceiptSave8973').click()}});
    $('manualReceiptSave8973').onclick=()=>{
      const op=(state.ops||[]).find(x=>String(x.id)===String(manualReceiptOpId8973)&&x.type==='sale');if(!op){close();return}
      const name=$('manualReceiptName8973').value.trim(),qty=Number($('manualReceiptQty8973').value),price=Number($('manualReceiptPrice8973').value),unit=$('manualReceiptUnit8973').value.trim()||'шт';
      if(!name)return $('manualReceiptError8973').textContent='Укажи название.';
      if(!Number.isFinite(qty)||qty<=0)return $('manualReceiptError8973').textContent='Количество должно быть больше 0.';
      if(!Number.isFinite(price)||price<0)return $('manualReceiptError8973').textContent='Цена не может быть отрицательной.';
      const total=Math.round((qty*price+Number.EPSILON)*100)/100;
      op.items=op.items||[];op.items.push({stockTracked:false,productId:null,article:'',name,qty,unit,price,buyPrice:0,total,profit:total,manualEntry:true,source:'manual'});
      recalcReceipt8973(op);const id=op.id;save();close();if(typeof refreshReceiptViews==='function')refreshReceiptViews(id);
    };
    updateTotal();return modal;
  }
  function openReceiptManualAdd8973(opId){
    const op=(state.ops||[]).find(x=>String(x.id)===String(opId)&&x.type==='sale');if(!op)return alert('Накладная не найдена.');
    const modal=ensureManualReceiptModal8973(),$=id=>document.getElementById(id);manualReceiptOpId8973=op.id;
    $('manualReceiptName8973').value='';$('manualReceiptQty8973').value='1';$('manualReceiptUnit8973').value='шт';$('manualReceiptPrice8973').value='0';$('manualReceiptError8973').textContent='';$('manualReceiptTotal8973').textContent='Сумма позиции: '+money(0);
    modal.classList.remove('hidden');setTimeout(()=>$('manualReceiptName8973').focus(),30);
  }
  window.openReceiptManualAdd8973=openReceiptManualAdd8973;

  function decorateReceipt8973(root){
    if(window.__release8973Installed)return;
    if(!root||!root.matches?.('[data-receipt-op-id]'))return;
    const opId=root.dataset.receiptOpId,op=(state.ops||[]).find(x=>String(x.id)===String(opId)&&x.type==='sale');if(!op)return;
    const help=root.querySelector('.receiptEditHelp');
    const helpText='Название, количество и цену можно изменить прямо в накладной — сумма и долг пересчитаются автоматически.';
    if(help&&help.textContent!==helpText)help.textContent=helpText;
    const nameColumn=[...root.querySelectorAll('table thead th')].findIndex(th=>String(th.textContent||'').trim().toLocaleLowerCase('ru').includes('наименование'));
    if(nameColumn<0)return;
    const rows=[...root.querySelectorAll('table tbody tr')];
    rows.forEach((tr,idx)=>{
      const item=op.items?.[idx],cell=tr.children?.[nameColumn];if(!item||!cell||cell.querySelector('.receiptNameInput8973'))return;
      const input=document.createElement('input');input.type='text';input.className='receiptNameInput8973';input.value=item.name||'';input.title='Название можно менять произвольно';
      input.onchange=()=>editReceiptItemName8973(op.id,idx,input.value);
      input.ondblclick=()=>{input.focus();input.select()};
      input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();input.blur()}else if(e.key==='Escape'){e.preventDefault();input.value=item.name||'';input.blur()}};
      cell.replaceChildren(input);
    });
    const actions=root.querySelector('.actions');
    if(actions&&!actions.querySelector('.manualReceiptBtn8973')){
      const btn=document.createElement('button');btn.type='button';btn.className='secondary manualReceiptBtn8973';btn.textContent='＋ Своя позиция';btn.onclick=()=>openReceiptManualAdd8973(op.id);
      const danger=actions.querySelector('.dangerBtn');if(danger)actions.insertBefore(btn,danger);else actions.appendChild(btn);
    }
  }
  function decorateAllReceipts8973(){
    document.querySelectorAll('[data-receipt-op-id]').forEach(decorateReceipt8973);compactProductColumns8973();
  }
  let decorateQueued8973=false;
  const queueDecorate8973=()=>{if(decorateQueued8973)return;decorateQueued8973=true;requestAnimationFrame(()=>{decorateQueued8973=false;decorateAllReceipts8973()})};
  const receiptObserver8973=new MutationObserver(queueDecorate8973);receiptObserver8973.observe(document.body,{childList:true,subtree:true});
  queueDecorate8973();setTimeout(decorateAllReceipts8973,400);setTimeout(decorateAllReceipts8973,1500);

  renderHomeDashboard();updateStatus();
  document.documentElement.dataset.interfaceVersion='8.9.73';
})();
