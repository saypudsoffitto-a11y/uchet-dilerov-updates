(()=>{
  'use strict';
  if(window.__release8947Installed)return;

  const DRAFT_KEY='uchetNewMatRosOpenSale8926';
  const MIGRATION_FLAG='productRestoreMigrationVersion';
  const MIGRATION_VERSION=8947;
  const round2=n=>Math.round(((+n||0)+Number.EPSILON)*100)/100;
  const clone=x=>JSON.parse(JSON.stringify(x));
  const normText=v=>String(v??'').normalize('NFKC').replace(/\u00a0/g,' ').trim().replace(/\s+/g,' ').replace(/ё/g,'е').toLocaleLowerCase('ru-RU');

  function installSeparateSaleLines(){
    if(typeof addToCart!=='function'||typeof state==='undefined'||typeof cart==='undefined')return false;
    if(addToCart.__separateLines8947)return true;
    const addToCart8947=function(qty){
      const p=state.products.find(x=>x.id==saleProduct.value),q=+(qty||1),price=+salePrice.value;
      if(!p)return alert('Выбери товар');
      if(!Number.isFinite(q)||q<=0)return alert('Количество должно быть больше 0');
      if(price<=0)return alert('Укажи цену');
      cart.push({
        lineId:'sale-line-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),
        productId:p.id,article:p.article||'',name:p.name,qty:q,unit:p.unit||'шт',price,
        buyPrice:+p.buyPrice||0,total:price*q,profit:(price-(+p.buyPrice||0))*q
      });
      renderCart();
    };
    addToCart8947.__separateLines8947=true;
    window.addToCart=addToCart8947;
    try{addToCart=addToCart8947}catch(_){}
    return true;
  }

  function recalcReceipt(op){
    op.total=round2((op.items||[]).reduce((s,i)=>s+(+i.total||0),0));
    op.profit=round2((op.items||[]).reduce((s,i)=>s+(+i.profit||0),0));
    op.updatedAt=Date.now();
  }

  function persistReceiptEdit(op){
    const entry=state.receiptStates?.[String(op.id)];
    if(entry&&!entry.archived){
      entry.version=(+entry.version||0)+1;
      entry.at=Date.now();
      entry.receipt=clone(op);
    }
    save();
  }

  window.removeReceiptItem8947=function(opId,itemIndex){
    const op=state.ops.find(x=>String(x.id)===String(opId)&&x.type==='sale');
    if(!op||!Array.isArray(op.items)||!op.items[itemIndex])return alert('Позиция не найдена. Открой чек заново.');
    if(op.items.length<=1)return alert('В чеке осталась одна позиция. Для полного удаления используй кнопку «Удалить чек», чтобы чек попал в архив и его можно было восстановить.');
    const item=op.items[itemIndex];
    if(!confirm('Удалить из чека только позицию «'+(item.name||'Товар')+'» · '+(+item.qty||0)+' '+(item.unit||'шт')+'?\n\nОстальные товары и сам чек останутся. Сумма чека и долг пересчитаются.'))return;

    if(item.stockTracked===true&&item.productId!=null){
      const p=state.products.find(x=>String(x.id)===String(item.productId));
      if(p)p.stock=Math.round(((+p.stock||0)+(+item.qty||0))*1e6)/1e6;
    }
    op.items.splice(itemIndex,1);
    recalcReceipt(op);
    persistReceiptEdit(op);

    try{if(typeof refreshReceiptViews==='function')refreshReceiptViews(op.id)}catch(e){console.error('8.9.47 refresh receipt',e)}
    try{
      const modal=document.getElementById('dealerModal');
      if(modal&&!modal.classList.contains('hidden')&&typeof openDealer==='function')openDealer(op.dealerId);
    }catch(e){console.error('8.9.47 refresh dealer',e)}
  };

  function installReceiptItemButtons(){
    if(typeof renderReceiptHtml!=='function')return false;
    if(renderReceiptHtml.__itemDelete8947)return true;
    const base=renderReceiptHtml;
    const wrapped=function(op,d){
      const html=base.apply(this,arguments);
      try{
        const tpl=document.createElement('template');tpl.innerHTML=String(html||'').trim();
        const root=tpl.content.firstElementChild;if(!root)return html;
        const table=root.querySelector('table'),head=table?.querySelector('thead tr'),rows=[...(table?.querySelectorAll('tbody tr')||[])];
        if(head&&!head.querySelector('.receiptItemAction8947')){
          const th=document.createElement('th');th.className='receiptItemAction8947';th.textContent='Действие';head.appendChild(th);
        }
        rows.forEach((tr,idx)=>{
          if(tr.querySelector('.receiptItemAction8947'))return;
          const td=document.createElement('td');td.className='receiptItemAction8947';
          const btn=document.createElement('button');btn.type='button';btn.className='dangerBtn miniBtn';btn.textContent='Удалить товар';
          btn.setAttribute('onclick','removeReceiptItem8947('+JSON.stringify(op.id)+','+idx+')');
          td.appendChild(btn);tr.appendChild(td);
        });
        return root.outerHTML;
      }catch(e){console.error('8.9.47 receipt buttons',e);return html}
    };
    wrapped.__itemDelete8947=true;wrapped.__base=base;
    window.renderReceiptHtml=wrapped;
    try{renderReceiptHtml=wrapped}catch(_){}
    return true;
  }

  const closeDealerItemMenu=()=>document.getElementById('dealerItemContext8947')?.remove();

  function showDealerItemMenu8947(e,opId,itemIndex){
    e.preventDefault();e.stopPropagation();closeDealerItemMenu();
    const op=state.ops.find(x=>String(x.id)===String(opId)&&x.type==='sale');
    const item=op?.items?.[itemIndex];if(!op||!item)return;
    const menu=document.createElement('div');menu.id='dealerItemContext8947';menu.className='saleContextMenu';
    menu.style.left=Math.min(e.clientX,window.innerWidth-280)+'px';menu.style.top=Math.min(e.clientY,window.innerHeight-170)+'px';
    const title=document.createElement('div');title.className='dealerItemMenuTitle8947';title.textContent=(item.name||'Товар')+' · '+(+item.qty||0)+' '+(item.unit||'шт');
    const open=document.createElement('button');open.type='button';open.textContent='Открыть чек';open.onclick=()=>{closeDealerItemMenu();showReceiptFromHistory(op.id)};
    const remove=document.createElement('button');remove.type='button';remove.className='dangerMenuItem';remove.textContent=op.items.length>1?'Удалить товар из чека':'Удалить товар — последний в чеке';remove.disabled=op.items.length<=1;remove.onclick=()=>{closeDealerItemMenu();window.removeReceiptItem8947(op.id,itemIndex)};
    const del=document.createElement('button');del.type='button';del.className='dangerMenuItem';del.textContent='Удалить весь чек';del.onclick=()=>{closeDealerItemMenu();if(typeof archiveReceipt==='function')archiveReceipt(op.id)};
    menu.append(title,open,remove,del);document.body.appendChild(menu);
  }

  function tagDealerHistoryRows8947(dealerId){
    const root=document.getElementById('dealerModalBody');if(!root)return;
    const counters=new Map();
    root.querySelectorAll('.dealerHistoryDetail tbody tr').forEach(row=>{
      const type=row.cells?.[1]?.textContent||'';const match=type.match(/Накладная\s*№\s*(.+)/i);if(!match)return;
      const receiptNo=match[1].trim();
      const op=(state.ops||[]).find(o=>o.type==='sale'&&String(o.dealerId)===String(dealerId)&&String(o.receiptNo)===receiptNo);if(!op)return;
      const k=String(op.id),idx=counters.get(k)||0;counters.set(k,idx+1);
      if(!op.items?.[idx])return;
      row.dataset.receiptId=k;row.dataset.receiptItemIndex=String(idx);
      row.title='Правая кнопка: открыть чек, удалить этот товар или удалить весь чек';
      row.oncontextmenu=e=>showDealerItemMenu8947(e,op.id,idx);
    });
  }

  function installDealerItemContext(){
    if(typeof openDealer!=='function')return false;
    if(openDealer.__itemContext8947)return true;
    const base=openDealer;
    const wrapped=function(id){const result=base.apply(this,arguments);setTimeout(()=>tagDealerHistoryRows8947(id),0);return result};
    wrapped.__itemContext8947=true;wrapped.__base=base;
    window.openDealer=wrapped;try{openDealer=wrapped}catch(_){}
    document.addEventListener('click',closeDealerItemMenu);window.addEventListener('blur',closeDealerItemMenu);
    return true;
  }

  function loadDraft(){try{return JSON.parse(localStorage.getItem(DRAFT_KEY)||'null')}catch(_){return null}}
  function saveDraft(d){if(d)localStorage.setItem(DRAFT_KEY,JSON.stringify(d));else localStorage.removeItem(DRAFT_KEY)}

  window.removeNewMatRosCeiling8947=function(key,index){
    const draft=loadDraft();if(!draft||!Array.isArray(draft.ceilings)||!draft.ceilings.length)return;
    let idx=draft.ceilings.findIndex(c=>String(c?.key||'')===String(key||''));
    if(idx<0)idx=+index;
    if(idx<0||idx>=draft.ceilings.length)return alert('Потолок не найден. Закрой и снова открой продажу.');
    const c=draft.ceilings[idx];
    const label='Потолок '+(idx+1)+(c.ceilingIndex?' · индекс '+c.ceilingIndex:'')+(c.area?' · '+c.area+' м²':'');
    if(!confirm('Удалить только «'+label+'» из открытой продажи NewMatRos?\n\nОстальные потолки останутся. После удаления можно заново выгрузить правильный потолок.'))return;
    try{
      const backupKey=DRAFT_KEY+'-removed-8947-'+Date.now();
      localStorage.setItem(backupKey,JSON.stringify({removedAt:Date.now(),dealerName:draft.dealerName||'',ceiling:c}));
    }catch(_){}
    draft.ceilings.splice(idx,1);
    if(draft.ceilings.length){
      draft.updatedAt=Date.now();saveDraft(draft);
      const open=document.getElementById('nmDraftOpen8926');if(open)open.click();
    }else{
      saveDraft(null);
      document.getElementById('nmDraftModal8926')?.classList.add('hidden');
      document.getElementById('nmDraftBanner8926')?.classList.add('hidden');
    }
    const s=document.getElementById('nmStatus');if(s)s.textContent='Потолок удалён из открытой продажи. Можно выгрузить правильный потолок заново.';
  };

  function enhanceNewMatRosDraft(){
    const modal=document.getElementById('nmDraftModal8926');if(!modal)return;
    const blocks=[...modal.querySelectorAll('.nmCeiling')];
    blocks.forEach((block,idx)=>{
      const head=block.querySelector('.nmCeilingHead');if(!head||head.querySelector('.nmDeleteCeiling8947'))return;
      const draft=loadDraft(),ceiling=draft?.ceilings?.[idx],key=String(ceiling?.key||'');
      const right=document.createElement('div');right.className='nmCeilingRight8947';
      const total=[...head.children].find(el=>el.tagName==='B'&&el.parentElement===head);if(total)right.appendChild(total);
      const del=document.createElement('button');del.type='button';del.className='dangerBtn miniBtn nmDeleteCeiling8947';del.textContent='Удалить потолок';
      del.onclick=e=>{e.preventDefault();e.stopPropagation();window.removeNewMatRosCeiling8947(key,idx)};
      right.appendChild(del);head.appendChild(right);
    });
  }

  function installNewMatRosCeilingDelete(){
    if(document.getElementById('release8947Style')){enhanceNewMatRosDraft();return true}
    const style=document.createElement('style');style.id='release8947Style';style.textContent=`
      .nmCeilingRight8947{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end}
      .nmDeleteCeiling8947{white-space:nowrap}
      .receiptItemAction8947{white-space:nowrap;width:1%}
      .dealerItemMenuTitle8947{padding:8px 11px 7px;font-size:12px;font-weight:800;color:#36506f;border-bottom:1px solid #e6eaf0;margin-bottom:4px;white-space:normal;max-width:300px}
      #dealerItemContext8947 button:disabled{opacity:.45;cursor:not-allowed}
      @media(max-width:760px){.nmCeilingHead{align-items:flex-start}.nmCeilingRight8947{align-items:flex-end;flex-direction:column}}
    `;document.head.appendChild(style);
    const observer=new MutationObserver(enhanceNewMatRosDraft);observer.observe(document.body,{childList:true,subtree:true});
    enhanceNewMatRosDraft();
    window.__release8947DraftObserver=observer;
    return true;
  }

  async function restoreMissingBundledProducts8947(){
    if(typeof state==='undefined'||(+state[MIGRATION_FLAG]||0)>=MIGRATION_VERSION)return;
    if(!window.stockAPI?.loadBundledProducts||typeof parseSemicolonCsv!=='function'||typeof ensureGroupByName!=='function')return;
    try{
      const payload=await window.stockAPI.loadBundledProducts();
      if(!payload||payload.canceled||!payload.text)return;
      const rows=parseSemicolonCsv(payload.text);
      const current=new Set((state.products||[]).map(p=>normText(p.article)+'||'+normText(p.name)));
      let added=0;
      for(let idx=0;idx<rows.length;idx++){
        const r=rows[idx];if(!r||r.length<2)continue;
        const article=String(r[0]||'').trim(),name=String(r[1]||'').trim();
        if(!name||/наименован/i.test(name))continue;
        const key=normText(article)+'||'+normText(name);if(current.has(key))continue;
        const extraInfo=String(r[2]||'').trim(),oldAux=typeof csvNum==='function'?csvNum(r[3]):(+String(r[3]||'').replace(',','.')||0);
        const groupName=String(r[4]||'Без группы').trim()||'Без группы';
        const stock=typeof csvNum==='function'?csvNum(r[5]):(+String(r[5]||'').replace(',','.')||0);
        const unit=String(r[6]||'').trim(),price=(typeof csvNum==='function'?csvNum(r[7]):(+String(r[7]||'').replace(',','.')||0))||Math.max(oldAux,0);
        const g=ensureGroupByName(groupName);
        state.products.push({
          id:Date.now()+idx+Math.floor(Math.random()*1000000),groupId:g.id,name,article,buyPrice:0,
          retailPrice:price,wholesalePrice:price,photo:'',stock,unit,extraInfo,oldAux,
          source:'Склад CSV · восстановлено 8.9.47',archived:false,restoredAt8947:Date.now()
        });
        current.add(key);added++;
      }
      state[MIGRATION_FLAG]=MIGRATION_VERSION;
      state.productRestore8947={at:Date.now(),added};
      save();
      if(added&&window.stockImportStatus)stockImportStatus.textContent='8.9.47: восстановлено пропавших карточек товаров: '+added+'. Существующие цены и карточки не изменялись.';
    }catch(e){console.error('8.9.47 restore missing products',e)}
  }


  function installSaleReset8948(){
    if(typeof saveSale!=='function')return false;
    if(saveSale.__resetAfterSave8948)return true;
    const base=saveSale;
    const wrapped=function(){
      const beforeOps=Array.isArray(state?.ops)?state.ops.length:0;
      const result=base.apply(this,arguments);
      const created=Array.isArray(state?.ops)&&state.ops.length>beforeOps
        ? state.ops.slice(beforeOps).find(x=>x&&x.type==='sale')
        : null;
      if(!created)return result;

      // Only reset the input form after a sale was actually saved.
      // The saved receipt remains in history/debt, while the sale page returns
      // to its clean starting state for the next customer / next receipt.
      try{
        if(window.saleDealerSearch)saleDealerSearch.value='';
        if(window.saleDealer)saleDealer.value='';
        if(window.saleDealerSelected)saleDealerSelected.textContent='Дилер не выбран';
        if(window.saleDealerList)saleDealerList.innerHTML='';
        if(typeof saleDealerCursor!=='undefined')saleDealerCursor=0;

        if(window.priceType)priceType.value='retail';
        if(window.salePrice)salePrice.value='';
        if(window.saleProductGroup)saleProductGroup.value='';
        if(window.saleProductSearch)saleProductSearch.value='';
        if(window.saleProduct)saleProduct.value='';
        if(window.saleProductList)saleProductList.innerHTML='';
        if(window.selectedPhoto)selectedPhoto.innerHTML='';
        if(typeof saleProductCursor!=='undefined')saleProductCursor=0;

        // The completed receipt is persisted already; clear only the current
        // work surface so the next sale starts from a clean page.
        if(window.receiptArea)receiptArea.innerHTML='';
        if(Array.isArray(cart)&&cart.length){cart.length=0;try{renderCart()}catch(_){}}
        try{renderSaleProducts()}catch(_){}
        try{renderSaleDealers()}catch(_){}

        const sales=document.getElementById('sales');
        if(sales&&typeof sales.scrollIntoView==='function')sales.scrollIntoView({block:'start'});
        setTimeout(()=>{try{saleDealerSearch?.focus();saleDealerSearch?.select()}catch(_){}},0);
      }catch(e){console.error('8.9.48 reset sale form',e)}
      return result;
    };
    wrapped.__resetAfterSave8948=true;
    wrapped.__base=base;
    window.saveSale=wrapped;
    try{saveSale=wrapped}catch(_){}
    return true;
  }


  function installBackNavigation8948(){
    if(window.__backNavigation8948Installed)return true;
    if(typeof show!=='function')return false;

    const stack=[];
    let suppressPush=false;
    const currentSection=()=>document.querySelector('main>section:not(.hidden)')?.id||'';

    const baseShow=show;
    const wrappedShow=function(id,b){
      const current=currentSection();
      if(!suppressPush&&current&&id&&current!==id){
        if(stack[stack.length-1]!==current)stack.push(current);
        if(stack.length>30)stack.shift();
      }
      return baseShow.apply(this,arguments);
    };
    wrappedShow.__backNav8948=true;
    wrappedShow.__base=baseShow;
    window.show=wrappedShow;
    try{show=wrappedShow}catch(_){}

    // Rebind go because the original function resolves the lexical show()
    // that existed before this late runtime module.
    const go8948=function(id){
      const b=document.querySelector('nav button[data-section="'+id+'"]');
      return wrappedShow(id,b);
    };
    window.go=go8948;
    try{go=go8948}catch(_){}

    function visibleModal(){
      const all=[...document.querySelectorAll('.modal, #nmDraftModal8926, #nmReviewModal8923')];
      return all.reverse().find(el=>el&&!el.classList.contains('hidden')&&el.getClientRects().length>0)||null;
    }

    function closeModal(modal){
      if(!modal)return false;
      const buttons=[...modal.querySelectorAll('button')];
      const close=buttons.find(b=>/^закрыть$/i.test((b.textContent||'').trim()))
        || buttons.find(b=>/^отмена$/i.test((b.textContent||'').trim()));
      if(close){close.click();return true}
      modal.classList.add('hidden');
      return true;
    }

    function closeInlineState(){
      try{
        if(window.paymentForm&&!paymentForm.classList.contains('hidden')&&typeof clearPayDealer==='function'){
          clearPayDealer();return true;
        }
      }catch(_){}
      for(const [id,fn] of [
        ['newDealerForm',()=>typeof toggleNewDealerForm==='function'&&toggleNewDealerForm(false)],
        ['addProductForm',()=>typeof toggleAddProductForm==='function'&&toggleAddProductForm(false)],
        ['stockTransferPanel',()=>typeof toggleStockTransfer==='function'&&toggleStockTransfer(false)]
      ]){
        const el=document.getElementById(id);
        if(el&&!el.classList.contains('hidden')){fn();return true}
      }
      return false;
    }

    window.historyBack8948=function(){
      const modal=visibleModal();
      if(modal)return closeModal(modal);
      if(closeInlineState())return true;

      const current=currentSection();
      let prev='';
      while(stack.length&&!prev){
        const candidate=stack.pop();
        if(candidate&&candidate!==current&&document.getElementById(candidate))prev=candidate;
      }
      if(!prev)prev='home';
      if(prev===current)return false;
      suppressPush=true;
      try{go8948(prev)}finally{suppressPush=false}
      return true;
    };

    function enhanceBackButtons(){
      const headers=[
        ...document.querySelectorAll('.modal .modalBox > .actions, #nmDraftModal8926 .nmDraftHead, #nmReviewModal8923 .nmDraftHead')
      ];
      headers.forEach(header=>{
        if(header.querySelector('.backBtn8948'))return;
        const close=[...header.querySelectorAll(':scope > button')].find(b=>/^закрыть$/i.test((b.textContent||'').trim()));
        if(!close)return;
        const group=document.createElement('div');
        group.className='actions backCloseGroup8948';
        const back=document.createElement('button');
        back.type='button';
        back.className='secondary backBtn8948';
        back.textContent='← Назад';
        back.onclick=e=>{e.preventDefault();e.stopPropagation();window.historyBack8948()};
        header.insertBefore(group,close);
        group.append(back,close);
      });
    }

    const style=document.createElement('style');
    style.id='backNavigation8948Style';
    style.textContent='.backCloseGroup8948{display:flex!important;align-items:center!important;gap:7px!important;margin-left:auto!important}.backBtn8948{white-space:nowrap!important;font-weight:700!important}';
    document.head.appendChild(style);

    // Capture Escape before inline input handlers so one key press performs
    // exactly one Back action (it must not close a modal and then leave the section).
    document.addEventListener('keydown',e=>{
      if(e.key!=='Escape'||e.defaultPrevented)return;
      e.preventDefault();
      e.stopPropagation();
      if(typeof e.stopImmediatePropagation==='function')e.stopImmediatePropagation();
      window.historyBack8948();
    },true);

    const observer=new MutationObserver(enhanceBackButtons);
    observer.observe(document.body,{childList:true,subtree:true});
    enhanceBackButtons();

    window.__backNavigation8948Installed=true;
    window.__backNavigation8948Stack=stack;
    return true;
  }

  function install(){
    const a=installSeparateSaleLines();
    const b=installReceiptItemButtons();
    const c=installDealerItemContext();
    const d=installSaleReset8948();
    const e=installBackNavigation8948();
    installNewMatRosCeilingDelete();
    if(a&&b&&c&&d&&e){
      window.__release8947Installed=true;
      document.documentElement.dataset.releaseFix='8.9.47';
      restoreMissingBundledProducts8947();
      try{if(typeof render==='function')render()}catch(_){}
      try{
        const active=document.querySelector('[data-receipt-op-id]');
        if(active){const id=active.getAttribute('data-receipt-op-id');if(typeof refreshReceiptViews==='function')refreshReceiptViews(id)}
      }catch(_){}
      return true;
    }
    return false;
  }

  let tries=0;
  const timer=setInterval(()=>{tries++;if(install()||tries>180)clearInterval(timer)},100);
})();
