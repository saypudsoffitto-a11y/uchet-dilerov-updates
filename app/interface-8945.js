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

  renderHomeDashboard();updateStatus();
  document.documentElement.dataset.interfaceVersion='8.9.46';
})();
