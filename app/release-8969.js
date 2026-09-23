(()=>{
  'use strict';
  if(window.__release8969Installed)return;
  window.__release8969Installed=true;

  const norm8969=v=>String(v??'').normalize('NFKC').replace(/\u00a0/g,' ').replace(/ё/g,'е').toLocaleUpperCase('ru-RU').replace(/[–—]/g,'-').replace(/\s+/g,' ').trim();
  const h8969=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const now8969=()=>Date.now();

  function rollWidth8969(data){
    try{if(typeof nmFindRollWidth==='function'){const n=+nmFindRollWidth(data)||0;if(n)return n}}catch(_){}
    const z=data?.['Заказ']||{};
    for(const key of ['ШиринаПолотна','ШиринаРулона','ШиринаМатериала','МатериалШирина','ШиринаПленки','ШиринаПлёнки','Ширина']){
      const m=String(z[key]??'').replace(',','.').match(/(\d+(?:\.\d+)?)/);if(!m)continue;
      let n=+m[1];if(n>1000)n/=1000;else if(n>10)n/=100;if(n>=1&&n<=10)return n;
    }
    return 0;
  }
  function filmDesc8969(data){
    const z=data?.['Заказ']||{};
    return norm8969([z['МатериалКаталог'],z['МатериалМатериал'],z['МатериалЦвет']].filter(Boolean).join(' '));
  }
  function filmGroup8969(p){
    const g=(state.groups||[]).find(x=>String(x.id)===String(p?.groupId));
    return norm8969(g?.name||'');
  }
  function isFilm8969(p){
    const n=norm8969(p?.name),g=filmGroup8969(p);
    return /ПОЛОТН/.test(g)||/МАТ|ЛАК|САТИН|ПЛЕН|ПЛЁН|ПОЛОТН|BAUF|БАУФ/.test(n);
  }
  function family8969(text){
    if(/BAUF|БАУФ|ГЕРМАН/.test(text))return 'bauf';
    if(/PREMIUM|ПРЕМИУМ/.test(text))return 'premium';
    return '';
  }
  function texture8969(text){
    if(/ЛАК/.test(text))return 'lak';
    if(/САТИН/.test(text))return 'satin';
    if(/МАТ/.test(text))return 'mat';
    return '';
  }
  function widthBucket8969(width){
    if(width>0&&width<=3.60)return 'narrow';
    if(width>=3.80&&width<=5.05)return 'wide';
    if(width>=5.70&&width<=5.90)return '580';
    return '';
  }
  function scoreFilm8969(p,desc,width){
    if(!p||p.archived||!isFilm8969(p))return -99999;
    const n=norm8969(p.name),fam=family8969(desc),pfam=family8969(n),tex=texture8969(desc),ptex=texture8969(n),bucket=widthBucket8969(width);
    if(fam==='bauf'&&pfam!=='bauf')return -99999;
    if(fam==='premium'&&pfam==='bauf')return -99999;
    if(fam==='premium'&&pfam!=='premium')return -99999;
    if(tex&&ptex&&tex!==ptex)return -99999;
    let s=0;
    if(tex&&ptex===tex)s+=100;
    if(/303/.test(desc)&&/303/.test(n))s+=45;
    if(fam&&pfam===fam)s+=160;
    if(bucket==='narrow'){
      if(/ДО\s*-?\s*360|ДО\s*3[,.]?60|\b360\b/.test(n))s+=180;
      if(/380|400|500|580|5[,.]?00/.test(n))s-=130;
    }else if(bucket==='wide'){
      if(/380\s*-?\s*500|400\s*-?\s*500|ОТ\s*380|ОТ\s*400|380.*500|400.*500/.test(n))s+=190;
      if(fam==='bauf'&&(/\b500\s*СМ\b|\b500\b|5[,.]?00/.test(n)))s+=220;
      if(/ДО\s*-?\s*360|\b580\b|5[,.]?80/.test(n))s-=160;
    }else if(bucket==='580'){
      if(/\b580\b|5[,.]?80/.test(n))s+=240;
      if(/ДО\s*-?\s*360|380\s*-?\s*500|400\s*-?\s*500/.test(n))s-=170;
    }
    return s;
  }
  function findFilmCard8969(data){
    const width=rollWidth8969(data),desc=filmDesc8969(data),fam=family8969(desc);
    const ranked=(state.products||[]).filter(p=>p&&!p.archived&&isFilm8969(p)).map(p=>({p,score:scoreFilm8969(p,desc,width)})).filter(x=>x.score>-90000).sort((a,b)=>b.score-a.score||String(a.p.name||'').localeCompare(String(b.p.name||''),'ru'));
    const best=ranked[0];
    const threshold=fam?220:150;
    if(!best||best.score<threshold)return {card:null,width,desc,family:fam};
    const price=+best.p.retailPrice||+best.p.wholesalePrice||0;
    if(!(price>0))return {card:null,width,desc,family:fam};
    return {card:best.p,price,width,desc,family:fam,score:best.score};
  }

  /* NewMatRos must always use the live product-card price. BAUF may never fall back to Premium. */
  const baseNmBuildItems8969=typeof nmBuildItems==='function'?nmBuildItems:window.nmBuildItems;
  if(typeof baseNmBuildItems8969==='function'&&!baseNmBuildItems8969.__priceCard8969){
    const wrappedNmBuildItems8969=function(data){
      const items=baseNmBuildItems8969.apply(this,arguments)||[];
      const mat=items.find(i=>i&&i.article==='NM-MAT');if(!mat)return items;
      const found=findFilmCard8969(data);
      if(found.card){
        mat.price=found.price;
        mat.total=(+mat.qty||0)*found.price;
        mat.productId=found.card.id;
        mat.priceSource='Карточка товара';
        mat.priceProductName=found.card.name;
      }else if(found.family==='bauf'){
        // Wrong Premium pricing is more dangerous than a blocked sale.
        mat.price=0;mat.total=0;mat.productId=null;mat.priceProductName='';
        mat.priceSource='Карточка BAUF для этой ширины не найдена';
      }
      return items;
    };
    wrappedNmBuildItems8969.__priceCard8969=true;
    wrappedNmBuildItems8969.__base=baseNmBuildItems8969;
    window.nmBuildItems=wrappedNmBuildItems8969;
    try{nmBuildItems=wrappedNmBuildItems8969}catch(_){}
  }
  window.__filmCard8969={find:findFilmCard8969,score:scoreFilm8969,width:rollWidth8969};

  /* Product edits: numeric revision stamp + immediate catalogue push from the master. */
  function forceCatalogPush8969(){
    try{
      if(!state.sync?.enabled||!state.sync?.url)return;
      setTimeout(()=>{
        try{
          if(window.masterSync8962?.push)window.masterSync8962.push(true);
          else if(typeof syncPush==='function')syncPush(true);
        }catch(e){console.error('8.9.69 product sync push',e)}
      },80);
    }catch(_){}
  }
  const baseSaveProductEdit8969=typeof saveProductEdit==='function'?saveProductEdit:window.saveProductEdit;
  if(typeof baseSaveProductEdit8969==='function'&&!baseSaveProductEdit8969.__syncStamp8969){
    const wrappedSaveProductEdit8969=function(){
      const id=String(document.getElementById('editProductId')?.value||arguments[0]||'');
      const out=baseSaveProductEdit8969.apply(this,arguments);
      const p=(state.products||[]).find(x=>String(x.id)===id);
      if(p){p.updatedAt=now8969();localStorage.setItem(KEY,JSON.stringify(state));forceCatalogPush8969();}
      return out;
    };
    wrappedSaveProductEdit8969.__syncStamp8969=true;
    window.saveProductEdit=wrappedSaveProductEdit8969;
    try{saveProductEdit=wrappedSaveProductEdit8969}catch(_){}
  }
  const baseAddProduct8969=typeof addProduct==='function'?addProduct:window.addProduct;
  if(typeof baseAddProduct8969==='function'&&!baseAddProduct8969.__syncStamp8969){
    const wrappedAddProduct8969=async function(){
      const before=new Set((state.products||[]).map(p=>String(p.id)));
      const out=await baseAddProduct8969.apply(this,arguments);
      const p=(state.products||[]).find(x=>!before.has(String(x.id)));
      if(p){p.updatedAt=now8969();localStorage.setItem(KEY,JSON.stringify(state));forceCatalogPush8969();}
      return out;
    };
    wrappedAddProduct8969.__syncStamp8969=true;
    window.addProduct=wrappedAddProduct8969;
    try{addProduct=wrappedAddProduct8969}catch(_){}
  }

  /* Price list: keep Group, but move it to the far right. */
  function movePriceGroupRight8969(){
    const table=document.querySelector('#pricelist8962 .priceTable8962');if(!table)return;
    const head=table.querySelector('thead tr');
    if(head&&head.children.length===5&&norm8969(head.children[0].textContent)==='ГРУППА')head.appendChild(head.children[0]);
    table.querySelectorAll('tbody tr').forEach(row=>{
      if(row.children.length===5&&row.dataset.groupMoved8969!=='1'){
        row.appendChild(row.children[0]);row.dataset.groupMoved8969='1';
      }
    });
  }
  const baseRenderPrice8969=window.renderPriceList8962;
  if(typeof baseRenderPrice8969==='function'&&!baseRenderPrice8969.__groupRight8969){
    const wrapped=function(){const out=baseRenderPrice8969.apply(this,arguments);movePriceGroupRight8969();return out};
    wrapped.__groupRight8969=true;window.renderPriceList8962=wrapped;
  }
  const priceRoot8969=document.getElementById('pricelist8962');
  if(priceRoot8969)new MutationObserver(movePriceGroupRight8969).observe(priceRoot8969,{childList:true,subtree:true});
  movePriceGroupRight8969();

  /* History search works both on dealer list and inside one dealer's receipts. */
  function historySearchBlob8969(op){
    return norm8969([op?.dealer,op?.dealerPhone,op?.date,op?.receiptNo,op?.note,op?.method,...(op?.items||[]).flatMap(i=>[i?.article,i?.name,i?.qty,i?.unit])].filter(v=>v!==undefined&&v!==null).join(' '));
  }
  function ensureHistorySearch8969(){
    const root=document.getElementById('history');if(!root||document.getElementById('historySearch8969'))return;
    const input=document.createElement('input');input.id='historySearch8969';input.className='search';input.placeholder='Поиск дилера, телефона, № чека или товара…';input.autocomplete='off';
    const wrap=document.createElement('div');wrap.className='historySearchWrap8969';wrap.appendChild(input);
    const hint=root.querySelector('.sectionHint');
    if(hint)hint.insertAdjacentElement('afterend',wrap);else root.prepend(wrap);
    input.addEventListener('input',filterHistory8969);
  }
  function filterHistory8969(){
    const q=norm8969(document.getElementById('historySearch8969')?.value||'');
    const rows=[...document.querySelectorAll('#historyRows tr')];
    for(const row of rows){
      if(!q){row.hidden=false;continue}
      let blob=norm8969(row.innerText||row.textContent||'');
      const openDealer=(row.getAttribute('ondblclick')||'').match(/openHistoryDealer8967\((\d+)\)/);
      if(openDealer){
        const id=openDealer[1],d=(state.dealers||[]).find(x=>String(x.id)===id);
        const sales=(state.ops||[]).filter(o=>o?.type==='sale'&&String(o.dealerId)===id);
        blob+=' '+norm8969([d?.name,d?.phone,d?.city,d?.company].filter(Boolean).join(' '))+' '+sales.map(historySearchBlob8969).join(' ');
      }
      const openReceipt=(row.getAttribute('ondblclick')||'').match(/showReceiptFromHistory\((\d+)\)/);
      if(openReceipt){const op=(state.ops||[]).find(o=>String(o.id)===openReceipt[1]);if(op)blob+=' '+historySearchBlob8969(op);}
      row.hidden=!blob.includes(q);
    }
  }
  ensureHistorySearch8969();
  const baseRenderHistory8969=typeof renderHistory==='function'?renderHistory:window.renderHistory;
  if(typeof baseRenderHistory8969==='function'&&!baseRenderHistory8969.__search8969){
    const wrappedRenderHistory8969=function(){const out=baseRenderHistory8969.apply(this,arguments);ensureHistorySearch8969();filterHistory8969();return out};
    wrappedRenderHistory8969.__search8969=true;window.renderHistory=wrappedRenderHistory8969;
    try{renderHistory=wrappedRenderHistory8969}catch(_){}
  }
  const historyRows8969=document.getElementById('historyRows');
  if(historyRows8969)new MutationObserver(()=>setTimeout(filterHistory8969,0)).observe(historyRows8969,{childList:true,subtree:true});
  filterHistory8969();

  /* Slightly stronger contrast, without changing the approved layout. */
  const style=document.createElement('style');style.id='release8969Style';style.textContent=`
    @media screen {
      html body nav button:not(.active){box-shadow:inset 0 0 0 1px rgba(32,74,126,.06)!important}
      html body nav button[data-section="dealers"]:not(.active){background:#e4f0ff!important;border-color:#c3daf8!important;color:#14396f!important}
      html body nav button[data-section="sales"]:not(.active){background:#dcf3e8!important;border-color:#bfe4d2!important;color:#0c6847!important}
      html body nav button[data-section="payments"]:not(.active){background:#e1efff!important;border-color:#c3dcf7!important;color:#0f559f!important}
      html body nav button[data-section="debts"]:not(.active){background:#ffe1e6!important;border-color:#f7c1cb!important;color:#a91d31!important}
      html body nav button[data-section="history"]:not(.active){background:#e8e3ff!important;border-color:#cec5fb!important;color:#4938ad!important}
      html body nav button[data-section="products"]:not(.active),html body nav button[data-section="pricelist"]:not(.active),html body nav button[data-section="groups"]:not(.active),html body nav button[data-section="newmatros"]:not(.active),html body nav button[data-section="sync"]:not(.active),html body nav button[data-section="backup"]:not(.active),html body nav button[data-section="updates"]:not(.active){background:#f3f7fc!important;border-color:#d1ddea!important;color:#15375f!important}
      html body .historySearchWrap8969{max-width:760px;margin:0 0 12px!important}
      html body #historySearch8969{width:100%!important;min-height:34px!important;padding:6px 10px!important}
    }
  `;(document.head||document.documentElement).appendChild(style);

  document.documentElement.dataset.interfaceVersion='8.9.69';
  document.documentElement.dataset.uchetRuntime='8.9.69';
})();
