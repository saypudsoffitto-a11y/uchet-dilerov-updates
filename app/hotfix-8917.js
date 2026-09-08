(()=>{
  if(window.__uchetHotfix8917)return;
  window.__uchetHotfix8917=true;

  const css=document.createElement('style');
  css.textContent=`
    #nmLiveBanner{position:fixed;left:250px;right:24px;top:78px;z-index:68;background:#fff7e8;border:1px solid #efc875;border-radius:12px;padding:11px 14px;box-shadow:0 8px 24px #0002;display:flex;align-items:center;justify-content:space-between;gap:12px}
    #nmLiveBanner.hidden{display:none!important}
    #nmLiveBanner b{color:#8a5a00}
    .debtPayBtn{margin-left:8px;padding:7px 9px!important;font-size:12px!important}
    .voiceSelectRow{margin-top:12px;padding-top:12px;border-top:1px solid #e2e8e5}
    #productGroupFilterWrap{display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin:0 0 12px}
    #productGroupFilterWrap label{min-width:260px}
  `;
  document.head.appendChild(css);

  async function enableNewMatRosWatch(){
    try{
      if(!window.newmatrosAPI?.setWatch)return;
      const r=await window.newmatrosAPI.setWatch(true);
      if(typeof state!=='undefined'){
        state.newmatros=state.newmatros||{};
        state.newmatros.watching=!!r?.ok;
        try{localStorage.setItem(typeof KEY!=='undefined'?KEY:'uchet_dilerov_v8',JSON.stringify(state))}catch(_){ }
      }
      const s=document.getElementById('nmStatus');
      if(s)s.textContent=r?.ok?'Наблюдение включено автоматически: '+(r.folder||'папка NewMatRos'):'Наблюдение не включено: '+(r?.error||'папка NewMatRos не найдена');
    }catch(e){console.error('NewMatRos autowatch 8.9.17',e)}
  }

  function ensureNmBanner(){
    let b=document.getElementById('nmLiveBanner');if(b)return b;
    b=document.createElement('div');b.id='nmLiveBanner';b.className='hidden';
    b.innerHTML='<div><b>Новая выгрузка NewMatRos</b><div id="nmLiveBannerText" style="margin-top:3px"></div></div><div class="actions"><button id="nmLiveOpen" class="primary" type="button">Открыть</button><button id="nmLiveClose" class="secondary" type="button">Закрыть</button></div>';
    document.body.appendChild(b);
    b.querySelector('#nmLiveOpen').addEventListener('click',()=>{try{if(typeof go==='function')go('newmatros')}catch(_){ }b.classList.add('hidden')});
    b.querySelector('#nmLiveClose').addEventListener('click',()=>b.classList.add('hidden'));
    return b;
  }
  if(window.newmatrosAPI?.onIni){
    window.newmatrosAPI.onIni(payload=>{
      const b=ensureNmBanner();
      const t=b.querySelector('#nmLiveBannerText');
      if(t)t.textContent='Получен файл '+(payload?.name||'NewMatRos')+'. Нажми «Открыть», чтобы увидеть заказ и расчёт.';
      b.classList.remove('hidden');
    });
  }

  function patchDebtRows(){
    const body=document.getElementById('debtRows');if(!body)return false;
    [...body.querySelectorAll('tr')].forEach(row=>{
      if(row.querySelector('.debtPayBtn'))return;
      const on=String(row.getAttribute('onclick')||'');const m=on.match(/openDealer\((\d+)\)/);if(!m)return;
      const id=+m[1];
      const td=document.createElement('td');
      const btn=document.createElement('button');btn.type='button';btn.className='primary debtPayBtn';btn.textContent='Внести оплату';
      btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();try{if(typeof go==='function')go('payments');if(typeof selectPayDealer==='function')setTimeout(()=>selectPayDealer(id),30)}catch(err){console.error(err)}});
      td.appendChild(btn);row.appendChild(td);
    });
    const head=body.closest('table')?.querySelector('thead tr');if(head&&!head.querySelector('[data-pay-col="1"]')){const th=document.createElement('th');th.dataset.payCol='1';th.textContent='Оплата';head.appendChild(th)}
    return true;
  }
  const debtBody=document.getElementById('debtRows');
  if(debtBody){new MutationObserver(patchDebtRows).observe(debtBody,{childList:true,subtree:true});patchDebtRows()}

  function applyProductGroupFilter(){
    const sel=document.getElementById('productGroupFilter');const body=document.getElementById('productRows');if(!sel||!body)return;
    const wanted=sel.value;
    [...body.querySelectorAll('tr')].forEach(row=>{
      const group=String(row.children?.[0]?.textContent||'').trim();
      row.style.display=!wanted||group===wanted?'':'none';
    });
  }
  function addProductGroupFilter(){
    const sec=document.getElementById('products');if(!sec||document.getElementById('productGroupFilter'))return false;
    const search=document.getElementById('productListSearch');if(!search)return false;
    const wrap=document.createElement('div');wrap.id='productGroupFilterWrap';
    wrap.innerHTML='<label>Группа товаров<select id="productGroupFilter"><option value="">Все группы</option></select></label><button id="productGroupFilterClear" class="secondary" type="button">Сбросить группу</button>';
    search.insertAdjacentElement('afterend',wrap);
    const sel=wrap.querySelector('#productGroupFilter');
    const fill=()=>{
      const cur=sel.value;
      const names=(typeof state!=='undefined'&&Array.isArray(state.groups)?state.groups:[]).map(g=>String(g.name||'').trim()).filter(Boolean).sort((a,b)=>a.localeCompare(b,'ru',{numeric:true,sensitivity:'base'}));
      sel.innerHTML='<option value="">Все группы</option>'+names.map(n=>'<option value="'+n.replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'">'+n.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</option>').join('');
      if(names.includes(cur))sel.value=cur;
    };
    fill();
    sel.addEventListener('change',applyProductGroupFilter);
    wrap.querySelector('#productGroupFilterClear').addEventListener('click',()=>{sel.value='';applyProductGroupFilter()});
    const body=document.getElementById('productRows');if(body)new MutationObserver(()=>{fill();applyProductGroupFilter()}).observe(body,{childList:true,subtree:true});
    applyProductGroupFilter();return true;
  }

  function preferredRussianVoice(){
    if(!('speechSynthesis' in window))return null;
    const voices=speechSynthesis.getVoices()||[];
    const ru=voices.filter(v=>/^ru(-|_)?/i.test(v.lang)||/russian|рус/i.test(v.name));
    if(!ru.length)return null;
    const rank=v=>{
      const n=String(v.name||'').toLowerCase();let s=0;
      if(/natural|online|neural/.test(n))s+=100;
      if(/svetlana|светлана/.test(n))s+=70;
      if(/irina|ирина/.test(n))s+=60;
      if(/pavel|павел/.test(n))s+=50;
      if(/microsoft/.test(n))s+=20;
      if(v.localService===false)s+=10;
      return s;
    };
    return ru.sort((a,b)=>rank(b)-rank(a))[0]||null;
  }
  if('speechSynthesis' in window&&!window.__uchetSpeakPatched8917){
    window.__uchetSpeakPatched8917=true;
    const originalSpeak=speechSynthesis.speak.bind(speechSynthesis);
    speechSynthesis.speak=function(u){
      try{
        const saved=localStorage.getItem('uchetVoiceSelected8917');
        const voices=speechSynthesis.getVoices()||[];
        let v=saved?voices.find(x=>x.name===saved):null;
        if(!v)v=preferredRussianVoice();
        if(v){u.voice=v;u.lang=v.lang||'ru-RU'}
        u.rate=.96;u.pitch=1;
      }catch(_){ }
      return originalSpeak(u);
    };
  }

  function addVoiceSelector(){
    const sec=document.getElementById('assistantSettings');if(!sec||document.getElementById('voiceNaturalSelect'))return false;
    const card=sec.querySelector('.card')||sec;
    const row=document.createElement('div');row.className='voiceSelectRow';
    row.innerHTML='<label>Голос помощника<select id="voiceNaturalSelect"><option value="">Автоматически — лучший русский голос</option></select></label><p class="muted" style="margin:6px 0 0">Показываются русские голоса, установленные в Windows. Если доступен Natural/Neural, программа выберет его в первую очередь.</p>';
    card.appendChild(row);
    const sel=row.querySelector('select');
    const fill=()=>{
      const cur=localStorage.getItem('uchetVoiceSelected8917')||'';
      const voices=(speechSynthesis.getVoices()||[]).filter(v=>/^ru(-|_)?/i.test(v.lang)||/russian|рус/i.test(v.name));
      sel.innerHTML='<option value="">Автоматически — лучший русский голос</option>'+voices.map(v=>'<option value="'+String(v.name).replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'">'+v.name+' · '+v.lang+'</option>').join('');
      sel.value=voices.some(v=>v.name===cur)?cur:'';
    };
    fill();speechSynthesis.addEventListener?.('voiceschanged',fill);
    sel.addEventListener('change',()=>{if(sel.value)localStorage.setItem('uchetVoiceSelected8917',sel.value);else localStorage.removeItem('uchetVoiceSelected8917')});
    return true;
  }

  enableNewMatRosWatch();
  let tries=0;const timer=setInterval(()=>{tries++;patchDebtRows();addVoiceSelector();addProductGroupFilter();applyProductGroupFilter();if(tries>60)clearInterval(timer)},250);
})();