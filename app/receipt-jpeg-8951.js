(()=>{
  const esc8951=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num8951=v=>(+v||0).toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2});
  const qty8951=v=>(+v||0).toLocaleString('ru-RU',{maximumFractionDigits:3});
  const pick8951=(n,a,b,c)=>{n=Math.abs(n)%100;const n1=n%10;return n>10&&n<20?c:n1>1&&n1<5?b:n1===1?a:c};
  function words9998951(n,female=false){
    const o=female?['','одна','две','три','четыре','пять','шесть','семь','восемь','девять']:['','один','два','три','четыре','пять','шесть','семь','восемь','девять'];
    const teens=['десять','одиннадцать','двенадцать','тринадцать','четырнадцать','пятнадцать','шестнадцать','семнадцать','восемнадцать','девятнадцать'];
    const tens=['','','двадцать','тридцать','сорок','пятьдесят','шестьдесят','семьдесят','восемьдесят','девяносто'];
    const hund=['','сто','двести','триста','четыреста','пятьсот','шестьсот','семьсот','восемьсот','девятьсот'];
    let out=[],h=Math.floor(n/100),r=n%100; if(h)out.push(hund[h]);
    if(r>=10&&r<20)out.push(teens[r-10]);
    else{let t=Math.floor(r/10),u=r%10;if(t)out.push(tens[t]);if(u)out.push(o[u])}
    return out.join(' ');
  }
  function intWords8951(n){
    n=Math.max(0,Math.floor(Number(n)||0));if(n===0)return 'ноль';
    let out=[];
    const mil=Math.floor(n/1000000)%1000,th=Math.floor(n/1000)%1000,rest=n%1000;
    if(mil){out.push(words9998951(mil),pick8951(mil,'миллион','миллиона','миллионов'))}
    if(th){out.push(words9998951(th,true),pick8951(th,'тысяча','тысячи','тысяч'))}
    if(rest)out.push(words9998951(rest));
    return out.filter(Boolean).join(' ');
  }
  function amountWords8951(value){
    const total=Math.max(0,Number(value)||0),rub=Math.floor(total),kop=Math.round((total-rub)*100)%100;
    const words=intWords8951(rub);
    return words.charAt(0).toUpperCase()+words.slice(1)+' '+pick8951(rub,'рубль','рубля','рублей')+' '+String(kop).padStart(2,'0')+' '+pick8951(kop,'копейка','копейки','копеек');
  }
  function dateOnly8951(v){
    const s=String(v||'').trim();
    const m=s.match(/\d{1,2}\.\d{1,2}\.\d{4}/);return m?m[0]:s;
  }
  function receiptHtml8951(op,d){
    const items=Array.isArray(op?.items)?op.items:[];
    const rows=items.map((i,n)=>'<tr><td class="n">'+(n+1)+'</td><td class="name">'+esc8951(i.name||'')+'</td><td class="money">'+num8951(i.price)+'</td><td class="qty">'+qty8951(i.qty)+'</td><td class="money">'+num8951(i.total??((+i.price||0)*(+i.qty||0)))+'</td></tr>').join('');
    const total=Number(op?.total)||items.reduce((s,i)=>s+(Number(i.total)||((+i.price||0)*(+i.qty||0))),0);
    return `<!doctype html><html><head><meta charset="utf-8"><style>
      *{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Arial,"Segoe UI",sans-serif}
      body{width:980px;padding:22px 26px 20px}
      h1{font-size:25px;text-align:center;margin:0 0 18px;font-weight:800}
      .meta{font-size:15px;line-height:1.35;margin-bottom:16px}
      .metaRow{display:grid;grid-template-columns:125px 1fr;gap:8px;margin:2px 0}
      table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:15px}
      th,td{border:1px solid #333;padding:4px 6px;line-height:1.15;vertical-align:middle}
      th{font-weight:700;text-align:center}
      th:nth-child(1){width:55px}th:nth-child(2){width:auto}th:nth-child(3){width:120px}th:nth-child(4){width:120px}th:nth-child(5){width:130px}
      td.n{text-align:center}td.name{white-space:normal;overflow-wrap:anywhere}td.money,td.qty{text-align:right;white-space:nowrap}
      .totalRow td{font-weight:700}.totalLabel{text-align:right}
      .words{font-size:15px;margin:12px 0 20px}
      .sign{font-size:15px;margin-top:8px}.line{display:inline-block;width:310px;border-bottom:1px solid #222;transform:translateY(-3px);margin-left:8px}
    </style></head><body>
      <h1>ТОВАРНЫЙ ЧЕК № ${esc8951(op?.receiptNo||'')} от ${esc8951(dateOnly8951(op?.date||''))}</h1>
      <div class="meta">
        <div class="metaRow"><b>Поставщик:</b><span>____________________________</span></div>
        <div class="metaRow"><b>Адрес:</b><span></span></div>
        <div class="metaRow"><b>Телефон:</b><span></span></div>
        <div class="metaRow"><b>ИНН:</b><span></span></div>
        <div class="metaRow"><b>Покупатель:</b><span>${esc8951(d?.name||op?.dealer||'')}</span></div>
      </div>
      <table><thead><tr><th>№</th><th>Наименование</th><th>Цена</th><th>Кол-во</th><th>Сумма</th></tr></thead>
      <tbody>${rows}<tr class="totalRow"><td colspan="4" class="totalLabel">Итого</td><td class="money">${num8951(total)}</td></tr></tbody></table>
      <div class="words">Сумма прописью: ${esc8951(amountWords8951(total))}</div>
      <div class="sign">Подпись <span class="line"></span></div>
    </body></html>`;
  }
  window.sendWhatsApp=async function(id){
    const op=(state.ops||[]).find(x=>String(x.id)===String(id)&&x.type==='sale');if(!op)return;
    const d=(state.dealers||[]).find(x=>String(x.id)===String(op.dealerId));
    if(!window.receiptAPI?.sendJpeg)return alert('Отправка JPEG доступна только в установленном приложении Windows.');
    const r=await window.receiptAPI.sendJpeg({phone:d?.phone||'',fileName:`Товарный_чек_${op.receiptNo}.jpg`,html:receiptHtml8951(op,d)});
    if(!r?.ok)return alert(r?.message||'Не удалось подготовить JPEG для WhatsApp');
    if(r.message)alert(r.message);
  };
  window.receiptJpegHtml8951=receiptHtml8951;
})();
