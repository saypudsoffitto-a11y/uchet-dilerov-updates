(()=>{
  let onlyDebtors=false;
  window.setHomeDebtFilter=value=>{
    onlyDebtors=!!value;
    for(const [id,active] of [['homeAll',!value],['homeDebtors',!!value]]){
      const b=document.getElementById(id);b.className=active?'primary':'secondary';b.setAttribute('aria-pressed',String(active));
    }
    renderHomeDashboard();
  };
  window.renderHomeDashboard=()=>{
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
