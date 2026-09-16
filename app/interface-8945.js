(()=>{
  let onlyDebtors=false;
  const paths=['<circle cx="12" cy="8" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3M3 7a3 3 0 0 1 3-3M21 7a3 3 0 0 0-3-3"/>','<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"/>','<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 5V3h8v2M10 10h3a2 2 0 0 1 0 4h-3M10 10v7M8 15h7"/>','<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v12c0 4 16 4 16 0V5M4 11c0 4 16 4 16 0"/>'];
  document.querySelectorAll('.metricIcon').forEach((el,i)=>el.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+paths[i]+'</svg>');
  document.querySelector('#products .sectionHint').textContent='Поиск, цены и остатки товаров. Столбцы можно перемещать и изменять по ширине.';
  document.getElementById('productListSearch').placeholder='Поиск товара по названию, артикулу или группе';
  window.setHomeDebtFilter=value=>{
    onlyDebtors=!!value;
    for(const [id,active] of [['homeAll',!value],['homeDebtors',!!value]]){
      const b=document.getElementById(id);b.className=active?'primary':'secondary';b.setAttribute('aria-pressed',String(active));
    }
    renderHomeDashboard();
  };
  window.renderHomeDashboard=()=>{
    if(!document.getElementById('home').classList.contains('hidden'))document.getElementById('pageTitle').textContent='Главная';
    const now=new Date(),today=o=>{const d=new Date(opTime(o));return d.toDateString()===now.toDateString()};
    document.getElementById('todaySales').textContent=state.ops.filter(o=>o.type==='sale'&&today(o)).length;
    document.getElementById('todayPayments').textContent=money(state.ops.filter(o=>o.type==='payment'&&today(o)).reduce((s,o)=>s+(+o.total||0),0));
    const query=document.getElementById('homeSearch').value.trim().toLocaleLowerCase('ru');
    const arr=state.dealers.filter(d=>(d.name+' '+(d.phone||'')).toLocaleLowerCase('ru').includes(query)&&(!onlyDebtors||debtOf(d.id)>0)).sort((a,b)=>lastDealerActivity(b.id)-lastDealerActivity(a.id)||String(a.name).localeCompare(String(b.name),'ru'));
    const body=document.getElementById('homeDealerRows');body.replaceChildren();
    for(const d of arr){
      const last=state.ops.filter(o=>o.type==='sale'&&o.dealerId==d.id).sort((a,b)=>opTime(b)-opTime(a))[0];
      const tr=document.createElement('tr');tr.className='clickable';tr.tabIndex=0;
      const open=()=>openDealer(d.id);tr.onclick=open;tr.onkeydown=e=>{if(e.target===tr&&e.key==='Enter'){e.preventDefault();open()}};
      tr.innerHTML='<td><div class="homeDealer"><span class="homeAvatar">'+esc(String(d.name||'?').slice(0,2).toUpperCase())+'</span><div><b>'+esc(d.name)+'</b><small>'+esc(d.phone||'')+'</small></div></div></td><td>'+esc(d.city||'—')+'</td><td>'+esc(last?last.date:'—')+'</td><td class="'+(debtOf(d.id)>0?'danger':'ok')+'"><b>'+money(debtOf(d.id))+'</b></td><td><button class="secondary miniBtn">Открыть →</button></td>';
      tr.querySelector('button').onclick=e=>{e.stopPropagation();open()};body.appendChild(tr);
    }
    document.getElementById('homeEmpty').classList.toggle('hidden',arr.length>0);
  };
  const status=document.getElementById('syncStatus'),indicator=document.getElementById('connectionIndicator');
  const updateStatus=()=>{
    const text=status?.textContent||'';
    const configured=!!state.sync?.url,enabled=!!state.sync?.enabled;
    const ok=configured&&!!status?.querySelector('.serverOk'),bad=configured&&!!status?.querySelector('.serverBad');
    indicator.dataset.status=ok?'online':bad?'offline':'idle';
    indicator.textContent=!configured?'Сервер не настроен':bad?'Нет связи с сервером':ok?(enabled?'Сервер подключён':'Автосинхронизация выключена'):enabled?'Подключение к серверу…':'Автосинхронизация выключена';
    indicator.title=text||'Открыть настройки общего сервера';
  };
  if(status)new MutationObserver(updateStatus).observe(status,{subtree:true,childList:true,characterData:true});
  renderHomeDashboard();updateStatus();
  document.documentElement.dataset.interfaceVersion='8.9.45';
})();
