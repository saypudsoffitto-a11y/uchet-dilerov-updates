// build-validation: 8.9.53-r4
(()=>{
  'use strict';
  if(window.__release8953Installed)return;
  window.__release8953Installed=true;

  const h=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rub=v=>'<span style="display:inline-block;white-space:nowrap">'+h((Number(v)||0).toLocaleString('ru-RU',{maximumFractionDigits:2})).replace(/ /g,'&nbsp;')+'&nbsp;₽</span>';

  /* 8.9.53 — утверждённая заметная активная кнопка и полноценная сетка таблиц. */
  const style=document.createElement('style');
  style.id='release8953Style';
  style.textContent=`
    @media screen {
      html nav button.active{
        transform:translateX(2px)!important;
        font-weight:800!important;
        border-width:2px!important;
        box-shadow:0 8px 20px rgba(36,76,132,.22),inset 0 0 0 1px rgba(255,255,255,.18)!important;
      }
      html nav button.active::before{
        content:'';position:absolute;left:-7px;top:7px;bottom:7px;width:4px;border-radius:999px;
        background:currentColor;box-shadow:0 0 0 2px rgba(255,255,255,.94),0 0 12px currentColor;
      }

      /* Неактивная «Главная» больше не выглядит выбранной постоянно. */
      html nav button[data-section="home"]:not(.active){background:#edf5ff!important;color:#193b78!important;border-color:#d7e8ff!important}

      html nav button[data-section="home"].active{background:#0f6efb!important;color:#fff!important;border-color:#075dd8!important}
      html nav button[data-section="dealers"].active{background:#246ed8!important;color:#fff!important;border-color:#1758b7!important}
      html nav button[data-section="sales"].active{background:#159463!important;color:#fff!important;border-color:#0e7950!important}
      html nav button[data-section="payments"].active{background:#177cc5!important;color:#fff!important;border-color:#0f65a4!important}
      html nav button[data-section="debts"].active{background:#df3b50!important;color:#fff!important;border-color:#c6293d!important;box-shadow:0 8px 20px rgba(223,59,80,.30),inset 0 0 0 1px rgba(255,255,255,.20)!important}
      html nav button[data-section="history"].active{background:#6552d6!important;color:#fff!important;border-color:#5140ba!important}
      html nav button[data-section="products"].active,
      html nav button[data-section="groups"].active,
      html nav button[data-section="newmatros"].active,
      html nav button[data-section="sync"].active,
      html nav button[data-section="backup"].active,
      html nav button[data-section="updates"].active{background:#315f9f!important;color:#fff!important;border-color:#254d85!important}

      /* Вертикальные + горизонтальные разделители во всех рабочих таблицах. */
      html table{border-collapse:separate!important;border-spacing:0!important}
      html table th,html table td{
        border-right:1px solid #dce5f0!important;
        border-bottom:1px solid #dce5f0!important;
      }
      html table th:last-child,html table td:last-child{border-right:0!important}
      html table tbody tr:last-child td{border-bottom:0!important}

      html .backCloseGroup8953{display:flex!important;align-items:center!important;gap:7px!important;margin-left:auto!important}
      html .backBtn8953{white-space:nowrap!important;font-weight:700!important}
    }
  `;
  (document.head||document.documentElement).appendChild(style);

  /* Компактная JPEG-накладная: ниже по высоте, меньший заголовок, ₽ не переносится. */
  const decl=(n,one,few,many)=>{
    const a=Math.abs(Number(n)||0)%100,b=a%10;
    if(a>10&&a<20)return many;
    if(b===1)return one;
    if(b>=2&&b<=4)return few;
    return many;
  };
  const intWordsRu=value=>{
    let n=Math.max(0,Math.floor(Math.abs(Number(value)||0)));
    if(n===0)return 'ноль';
    const om=['','один','два','три','четыре','пять','шесть','семь','восемь','девять'];
    const of=['','одна','две','три','четыре','пять','шесть','семь','восемь','девять'];
    const teen=['десять','одиннадцать','двенадцать','тринадцать','четырнадцать','пятнадцать','шестнадцать','семнадцать','восемнадцать','девятнадцать'];
    const tens=['','','двадцать','тридцать','сорок','пятьдесят','шестьдесят','семьдесят','восемьдесят','девяносто'];
    const hundreds=['','сто','двести','триста','четыреста','пятьсот','шестьсот','семьсот','восемьсот','девятьсот'];
    const groups=[
      {one:'',few:'',many:'',female:false},
      {one:'тысяча',few:'тысячи',many:'тысяч',female:true},
      {one:'миллион',few:'миллиона',many:'миллионов',female:false},
      {one:'миллиард',few:'миллиарда',many:'миллиардов',female:false}
    ];
    const out=[];let gi=0;
    while(n>0&&gi<groups.length){
      const part=n%1000;n=Math.floor(n/1000);
      if(part){
        const words=[],hund=Math.floor(part/100),last=part%100;
        if(hund)words.push(hundreds[hund]);
        if(last>=10&&last<20)words.push(teen[last-10]);
        else{
          const t=Math.floor(last/10),o=last%10;
          if(t)words.push(tens[t]);
          if(o)words.push((groups[gi].female?of:om)[o]);
        }
        if(gi>0)words.push(decl(part,groups[gi].one,groups[gi].few,groups[gi].many));
        out.unshift(words.join(' '));
      }
      gi++;
    }
    return out.join(' ').replace(/\s+/g,' ').trim();
  };
  const moneyWordsRu=value=>{
    const n=Math.max(0,Number(value)||0);
    let r=Math.floor(n+1e-9),k=Math.round((n-r)*100);
    if(k>=100){r++;k=0}
    return intWordsRu(r)+' '+decl(r,'рубль','рубля','рублей')+' '+String(k).padStart(2,'0')+' '+decl(k,'копейка','копейки','копеек');
  };

  function compactReceiptImage8953(op,d){
    const rows=(op.items||[]).map((i,n)=>
      '<tr><td class="n">'+(n+1)+'</td><td class="name"><b>'+h(i.name||'Товар')+'</b></td><td class="qty">'+h(i.qty)+' '+h(i.unit||'шт')+'</td><td class="price">'+rub(i.price)+'</td><td class="sum">'+rub(i.total)+'</td></tr>'
    ).join('');
    return '<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>'+
      '*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff}body{display:inline-block;font-family:Arial,sans-serif;color:#172033}'+
      '.sheet{width:700px;padding:12px 14px 10px;background:#fff}h1{text-align:center;font-size:15px;line-height:1.15;margin:0 0 4px}'+
      '.date{text-align:center;color:#6d7a8f;font-size:10.5px;margin:0 0 6px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:3px 12px;font-size:11px;margin:0 0 6px}'+
      'table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:11.5px}th,td{border:1px solid #cfd7e3;padding:4px 5px;line-height:1.12;vertical-align:middle}'+
      'th{background:#f3f6fa;text-align:center;font-weight:700;color:#33445f}.n{width:36px;text-align:center}.name{width:auto;text-align:left;overflow-wrap:anywhere}'+
      '.qty{width:92px;text-align:center;white-space:nowrap}.price{width:100px;text-align:right;white-space:nowrap}.sum{width:106px;text-align:right;white-space:nowrap}'+
      '.total{margin-top:6px;text-align:right;font-size:14px;font-weight:800;white-space:nowrap}.words{margin-top:3px;font-size:10.5px;line-height:1.18}'+
      '.debt{margin-top:3px;font-size:11px;white-space:nowrap}.sign{margin-top:9px;font-size:11px}'+
      '</style></head><body><div class="sheet"><h1>ТОВАРНАЯ НАКЛАДНАЯ № '+h(op.receiptNo)+'</h1><div class="date">от '+h(op.date)+'</div>'+
      '<div class="meta"><div><b>Поставщик:</b> ____________________</div><div><b>Покупатель:</b> '+h(d?.name||op.dealer||'')+'</div>'+
      '<div></div><div><b>Телефон:</b> '+h(d?.phone||'—')+'</div></div>'+
      '<table><thead><tr><th>№</th><th>Наименование</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead><tbody>'+rows+'</tbody></table>'+
      '<div class="total">Итого: '+rub(op.total)+'</div><div class="words"><b>Сумма прописью:</b> '+h(moneyWordsRu(op.total))+'</div>'+
      '<div class="debt"><b>Остаток долга:</b> '+rub(debtOf(op.dealerId))+'</div><div class="sign"><b>Подпись:</b> ______________________________</div>'+
      '</div></body></html>';
  }

  window.sendWhatsApp=async id=>{
    const op=(state.ops||[]).find(x=>String(x.id)===String(id)&&x.type==='sale');
    const d=op&&(state.dealers||[]).find(x=>String(x.id)===String(op.dealerId));
    if(!op)return;
    if(!window.receiptAPI?.sendJpeg)return alert('Отправка JPEG доступна только в установленном приложении «Учёт дилеров».');
    const r=await window.receiptAPI.sendJpeg({
      phone:d?.phone||'',
      fileName:'Товарная_накладная_'+op.receiptNo+'.jpg',
      html:compactReceiptImage8953(op,d)
    });
    if(!r?.ok)return alert(r?.message||'Не удалось подготовить JPEG для WhatsApp');
    if(r.message)alert(r.message);
  };
  try{sendWhatsApp=window.sendWhatsApp}catch(_){}

  /* После успешной продажи форма полностью готова к следующему чеку. */
  function resetSaleForm8953(){
    try{
      const dealerSearch=document.getElementById('saleDealerSearch');
      const dealer=document.getElementById('saleDealer');
      const selected=document.getElementById('saleDealerSelected');
      const dealerList=document.getElementById('saleDealerList');
      const priceTypeEl=document.getElementById('priceType');
      const price=document.getElementById('salePrice');
      const group=document.getElementById('saleProductGroup');
      const productSearch=document.getElementById('saleProductSearch');
      const product=document.getElementById('saleProduct');
      const productList=document.getElementById('saleProductList');
      const photo=document.getElementById('selectedPhoto');
      const receipt=document.getElementById('receiptArea');

      if(dealerSearch)dealerSearch.value='';
      if(dealer)dealer.value='';
      if(selected)selected.textContent='Дилер не выбран';
      if(dealerList)dealerList.innerHTML='';
      if(priceTypeEl)priceTypeEl.value='retail';
      if(price)price.value='';
      if(group)group.value='';
      if(productSearch)productSearch.value='';
      if(product)product.value='';
      if(productList)productList.innerHTML='';
      if(photo)photo.innerHTML='';
      if(receipt)receipt.innerHTML='';
      try{saleDealerCursor=0}catch(_){}
      try{saleProductCursor=0}catch(_){}
      try{if(Array.isArray(cart))cart.length=0}catch(_){}
      try{if(typeof renderCart==='function')renderCart()}catch(_){}
      try{if(typeof renderSaleProducts==='function')renderSaleProducts()}catch(_){}
      try{if(typeof renderSaleDealers==='function')renderSaleDealers()}catch(_){}

      const sales=document.getElementById('sales');
      if(sales?.scrollIntoView)sales.scrollIntoView({block:'start'});
      setTimeout(()=>{try{dealerSearch?.focus();dealerSearch?.select()}catch(_){}},0);
    }catch(e){console.error('8.9.53 reset sale form',e)}
  }

  const previousSaveSale8953=typeof saveSale==='function'?saveSale:window.saveSale;
  if(typeof previousSaveSale8953==='function'&&!previousSaveSale8953.__reset8953){
    const wrappedSaveSale8953=function(){
      const before=(state.ops||[]).length;
      const out=previousSaveSale8953.apply(this,arguments);
      const created=(state.ops||[]).slice(before).some(x=>x&&x.type==='sale');
      if(created)resetSaleForm8953();
      return out;
    };
    wrappedSaveSale8953.__reset8953=true;
    wrappedSaveSale8953.__base=previousSaveSale8953;
    window.saveSale=wrappedSaveSale8953;
    try{saveSale=wrappedSaveSale8953}catch(_){}
  }

  /* История разделов + «Назад» рядом с «Закрыть» + Escape = один шаг назад. */
  const navStack8953=[];
  let suppressNavPush8953=false;
  const currentSection8953=()=>document.querySelector('main>section:not(.hidden)')?.id||'';

  const previousShow8953=typeof show==='function'?show:window.show;
  if(typeof previousShow8953==='function'&&!previousShow8953.__back8953){
    const wrappedShow8953=function(id,b){
      const current=currentSection8953();
      if(!suppressNavPush8953&&current&&id&&current!==id&&navStack8953[navStack8953.length-1]!==current){
        navStack8953.push(current);
        if(navStack8953.length>30)navStack8953.shift();
      }
      return previousShow8953.apply(this,arguments);
    };
    wrappedShow8953.__back8953=true;
    wrappedShow8953.__base=previousShow8953;
    window.show=wrappedShow8953;
    try{show=wrappedShow8953}catch(_){}

    const go8953=id=>{
      const b=document.querySelector('nav button[data-section="'+id+'"]');
      return wrappedShow8953(id,b);
    };
    window.go=go8953;
    try{go=go8953}catch(_){}
  }

  function visibleModal8953(){
    return [...document.querySelectorAll('.modal,#nmDraftModal8926,#nmReviewModal8923')]
      .filter(el=>el&&!el.classList.contains('hidden')&&(el.offsetParent!==null||el.getClientRects().length))
      .pop()||null;
  }
  function closeModal8953(modal){
    if(!modal)return false;
    const buttons=[...modal.querySelectorAll('button')];
    const close=buttons.find(b=>/^закрыть$/i.test((b.textContent||'').trim()))
      ||buttons.find(b=>/^отмена$/i.test((b.textContent||'').trim()));
    if(close){close.click();return true}
    modal.classList.add('hidden');return true;
  }
  function closeInline8953(){
    try{
      const pf=document.getElementById('paymentForm');
      if(pf&&!pf.classList.contains('hidden')&&typeof clearPayDealer==='function'){clearPayDealer();return true}
    }catch(_){}
    const entries=[
      ['newDealerForm',()=>typeof toggleNewDealerForm==='function'&&toggleNewDealerForm(false)],
      ['addProductForm',()=>typeof toggleAddProductForm==='function'&&toggleAddProductForm(false)],
      ['stockTransferPanel',()=>typeof toggleStockTransfer==='function'&&toggleStockTransfer(false)]
    ];
    for(const [id,fn] of entries){
      const el=document.getElementById(id);
      if(el&&!el.classList.contains('hidden')){fn();return true}
    }
    return false;
  }

  window.historyBack8953=()=>{
    const modal=visibleModal8953();
    if(modal)return closeModal8953(modal);
    if(closeInline8953())return true;
    const current=currentSection8953();
    let prev='';
    while(navStack8953.length&&!prev){
      const candidate=navStack8953.pop();
      if(candidate&&candidate!==current&&document.getElementById(candidate))prev=candidate;
    }
    if(!prev)return false;
    const goFn=window.go;
    if(typeof goFn!=='function')return false;
    suppressNavPush8953=true;
    try{goFn(prev)}finally{suppressNavPush8953=false}
    return true;
  };

  function enhanceBackButtons8953(){
    const headers=[
      ...document.querySelectorAll('.modal .modalBox > .actions,#nmDraftModal8926 .nmDraftHead,#nmReviewModal8923 .nmDraftHead')
    ];
    for(const header of headers){
      if(header.querySelector('.backBtn8953'))continue;
      const close=[...header.querySelectorAll(':scope > button')].find(b=>/^закрыть$/i.test((b.textContent||'').trim()));
      if(!close)continue;
      const group=document.createElement('div');group.className='actions backCloseGroup8953';
      const back=document.createElement('button');back.type='button';back.className='secondary backBtn8953';back.textContent='← Назад';
      back.onclick=e=>{e.preventDefault();e.stopPropagation();window.historyBack8953()};
      header.insertBefore(group,close);
      group.append(back,close);
    }
  }

  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape'||e.defaultPrevented)return;
    const acted=window.historyBack8953();
    if(!acted)return;
    e.preventDefault();e.stopPropagation();
    if(typeof e.stopImmediatePropagation==='function')e.stopImmediatePropagation();
  },true);

  const observer8953=new MutationObserver(enhanceBackButtons8953);
  observer8953.observe(document.body,{childList:true,subtree:true});
  enhanceBackButtons8953();

  window.__release8953={
    compactReceiptImage:compactReceiptImage8953,
    resetSaleForm:resetSaleForm8953,
    historyBack:window.historyBack8953
  };
  document.documentElement.dataset.interfaceVersion='8.9.53';
})();
