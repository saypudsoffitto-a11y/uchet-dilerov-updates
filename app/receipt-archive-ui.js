(()=>{
  'use strict';
  const core=window.receiptArchiveCore;
  const history=document.getElementById('history');
  const panel=document.createElement('details');panel.className='card archivePanel';panel.id='receiptArchivePanel';
  panel.innerHTML='<summary>Удалённые чеки <span id="receiptArchiveCount" class="tag">0</span></summary><p class="muted">Чеки сохранены в архиве и не входят в долг. Восстановление вернёт чек и его сумму в расчёты.</p><div class="tableWrap"><table><thead><tr><th>Чек</th><th>Дилер</th><th>Сумма</th><th>Удалён</th><th>Действие</th></tr></thead><tbody id="receiptArchiveRows"></tbody></table></div><p id="receiptArchiveEmpty" class="muted">Удалённых чеков нет.</p>';

  const sortBar=history.querySelector('.sortBar');
  if(sortBar)history.insertBefore(panel,sortBar);else history.appendChild(panel);

  const archiveNav=document.createElement('div');archiveNav.className='actions';archiveNav.style.margin='0 0 14px';
  archiveNav.innerHTML='<button id="openDeletedReceipts" type="button" class="secondary">Удалённые чеки <span id="deletedReceiptsButtonCount" class="tag">0</span></button><button id="openDeletedReceiptItems" type="button" class="secondary">Удалённые позиции <span id="deletedReceiptItemsButtonCount" class="tag">0</span></button>';
  history.insertBefore(archiveNav,panel);
  document.getElementById('openDeletedReceipts').onclick=()=>{panel.open=true;panel.scrollIntoView({behavior:'smooth',block:'start'})};

  const itemPanel=document.createElement('details');itemPanel.className='card archivePanel';itemPanel.id='receiptItemArchivePanel';itemPanel.style.marginTop='12px';
  itemPanel.innerHTML='<summary>Удалённые позиции из чеков <span id="receiptItemArchiveCount" class="tag">0</span></summary><p class="muted">Удалённая позиция не входит в сумму чека и долг дилера. Её можно восстановить.</p><div class="tableWrap"><table><thead><tr><th>Чек</th><th>Дилер</th><th>Товар</th><th>Сумма</th><th>Удалён</th><th>Действие</th></tr></thead><tbody id="receiptItemArchiveRows"></tbody></table></div><p id="receiptItemArchiveEmpty" class="muted">Удалённых позиций нет.</p>';
  panel.insertAdjacentElement('afterend',itemPanel);
  document.getElementById('openDeletedReceiptItems').onclick=()=>{itemPanel.open=true;itemPanel.scrollIntoView({behavior:'smooth',block:'start'})};

  const style=document.createElement('style');
  style.textContent='.receiptLineAction{white-space:nowrap}.receiptLineDelete{padding:6px 8px;font-size:12px}@media print{.receiptLineAction{display:none!important}}';
  document.head.appendChild(style);

  function commit(next,id,options={}){
    localStorage.setItem(KEY,JSON.stringify(next));state=next;
    document.querySelectorAll('[data-receipt-op-id]').forEach(el=>{if(String(el.dataset.receiptOpId)===String(id)&&options.removeReceipt)el.remove()});
    if(options.removeReceipt)document.getElementById('receiptViewModal')?.classList.add('hidden');
    if(!options.keepDealerOpen&&options.removeReceipt)document.getElementById('dealerModal')?.classList.add('hidden');
    render();
    enhanceReceipts();
    if(!syncApplying&&state.sync?.enabled){clearTimeout(syncSaveTimer);syncSaveTimer=setTimeout(()=>syncPush(false),350)}
  }

  window.archiveReceipt=id=>{
    const op=state.ops.find(o=>String(o.id)===String(id)&&o.type==='sale');if(!op)return;
    if(!confirm('Удалить чек № '+op.receiptNo+' для «'+(op.dealer||'Дилер')+'» на '+money(op.total)+'?\n\nДолг уменьшится на эту сумму. Оплаты сохранятся. Чек можно будет восстановить: История → Удалённые чеки.'))return;
    try{
      const dealerId=op.dealerId;
      commit(core.transition(state,id,true),id,{keepDealerOpen:true,removeReceipt:true});
      if(dealerId!=null&&typeof openDealer==='function')openDealer(dealerId);
    }catch(e){alert('Не удалось удалить чек: '+e.message)}
  };

  window.restoreReceipt=id=>{
    const e=state.receiptStates?.[String(id)];if(!e?.archived)return;
    if(!confirm('Восстановить чек № '+e.receipt.receiptNo+' для «'+(e.receipt.dealer||'Дилер')+'»?\nДолг увеличится на '+money(e.receipt.total)+'.'))return;
    try{commit(core.transition(state,id,false),id);showReceiptFromHistory(id)}catch(e){alert('Не удалось восстановить чек: '+e.message)}
  };

  window.deleteReceiptItem=(receiptId,itemIndex)=>{
    const op=state.ops.find(o=>String(o.id)===String(receiptId)&&o.type==='sale');
    const item=op?.items?.[itemIndex];if(!op||!item)return;
    const amount=Number.isFinite(+item.total)?+item.total:(+item.qty||0)*(+item.price||0);
    if(!confirm('Удалить из чека № '+op.receiptNo+' позицию «'+(item.name||'Товар')+'» на '+money(amount)+'?\n\nОстальные товары останутся в этом же чеке, а долг уменьшится на сумму позиции. Позицию можно будет восстановить в История → Удалённые позиции.'))return;
    try{
      const dealerId=op.dealerId;
      commit(core.deleteItem(state,receiptId,itemIndex),receiptId,{keepDealerOpen:true});
      if(document.getElementById('dealerModal')&&!document.getElementById('dealerModal').classList.contains('hidden')&&typeof openDealer==='function')openDealer(dealerId);
      if(typeof refreshReceiptViews==='function')refreshReceiptViews(receiptId);
      renderReceiptItemArchive();
    }catch(e){alert('Не удалось удалить товар из чека: '+e.message)}
  };

  window.restoreReceiptItem=entryKey=>{
    const e=state.receiptItemStates?.[entryKey];if(!e?.archived)return;
    const amount=Number.isFinite(+e.item.total)?+e.item.total:(+e.item.qty||0)*(+e.item.price||0);
    if(!confirm('Восстановить «'+(e.item.name||'Товар')+'» в чек № '+e.receiptNo+'?\nДолг увеличится на '+money(amount)+'.'))return;
    try{
      commit(core.restoreItem(state,entryKey),e.receiptId);
      if(typeof refreshReceiptViews==='function')refreshReceiptViews(e.receiptId);
      renderReceiptItemArchive();
    }catch(err){alert('Не удалось восстановить товар: '+err.message)}
  };

  function renderReceiptItemArchive(){
    const entries=Object.entries(state.receiptItemStates||{}).filter(([,e])=>e.archived).sort((a,b)=>(+b[1].at||0)-(+a[1].at||0));
    const count=document.getElementById('receiptItemArchiveCount');if(count)count.textContent=entries.length;
    const buttonCount=document.getElementById('deletedReceiptItemsButtonCount');if(buttonCount)buttonCount.textContent=entries.length;
    const empty=document.getElementById('receiptItemArchiveEmpty');if(empty)empty.classList.toggle('hidden',!!entries.length);
    const rows=document.getElementById('receiptItemArchiveRows');if(!rows)return;rows.replaceChildren();
    for(const [entryKey,e] of entries){
      const amount=Number.isFinite(+e.item.total)?+e.item.total:(+e.item.qty||0)*(+e.item.price||0);
      const tr=document.createElement('tr');
      tr.innerHTML='<td>№ '+esc(e.receiptNo||'')+'</td><td>'+esc(e.dealer||'')+'</td><td>'+esc(e.item.name||'Товар')+'<br><small class="muted">'+esc(e.item.article||'')+' · '+esc(e.item.qty??'')+' '+esc(e.item.unit||'шт')+'</small></td><td>'+money(amount)+'</td><td>'+esc(new Date(e.at).toLocaleString('ru-RU'))+'</td><td><button class="secondary miniBtn">Восстановить</button></td>';
      tr.querySelector('button').onclick=()=>restoreReceiptItem(entryKey);rows.appendChild(tr);
    }
  }

  window.renderReceiptArchive=()=>{
    const entries=Object.entries(state.receiptStates||{}).filter(([,e])=>e.archived).sort((a,b)=>b[1].at-a[1].at);
    document.getElementById('receiptArchiveCount').textContent=entries.length;
    const buttonCount=document.getElementById('deletedReceiptsButtonCount');if(buttonCount)buttonCount.textContent=entries.length;
    document.getElementById('receiptArchiveEmpty').classList.toggle('hidden',!!entries.length);
    const rows=document.getElementById('receiptArchiveRows');rows.replaceChildren();
    for(const [id,e] of entries){
      const tr=document.createElement('tr'),op=e.receipt;
      tr.innerHTML='<td>№ '+esc(op.receiptNo)+'<br><small class="muted">'+esc(op.date)+'</small></td><td>'+esc(op.dealer||'')+'</td><td>'+money(op.total)+'</td><td>'+esc(new Date(e.at).toLocaleString('ru-RU'))+'</td><td><button class="secondary miniBtn">Восстановить</button></td>';
      tr.querySelector('button').onclick=()=>restoreReceipt(id);rows.appendChild(tr);
    }
    renderReceiptItemArchive();
  };

  function enhanceReceipts(){
    document.querySelectorAll('[data-receipt-op-id]').forEach(receipt=>{
      const receiptId=receipt.dataset.receiptOpId;
      const op=state.ops.find(o=>String(o.id)===String(receiptId)&&o.type==='sale');if(!op)return;
      const table=receipt.querySelector('table');if(!table)return;
      const head=table.querySelector('thead tr');
      if(head&&!head.querySelector('[data-line-action-head]')){
        const th=document.createElement('th');th.dataset.lineActionHead='1';th.className='receiptLineAction';th.textContent='Действие';head.appendChild(th);
      }
      [...table.querySelectorAll('tbody tr')].forEach((tr,index)=>{
        if(tr.querySelector('[data-line-action]'))return;
        const td=document.createElement('td');td.dataset.lineAction='1';td.className='receiptLineAction';
        const btn=document.createElement('button');btn.type='button';btn.className='dangerBtn receiptLineDelete';btn.textContent='Удалить товар';
        btn.disabled=(op.items||[]).length<=1;
        btn.title=btn.disabled?'В чеке одна позиция — используй «Удалить чек»':'Удалить только эту позицию из чека';
        btn.onclick=()=>deleteReceiptItem(receiptId,index);
        td.appendChild(btn);tr.appendChild(td);
      });
    });
  }

  const originalDealerHistoryRows=window.dealerHistoryRows;
  if(typeof originalDealerHistoryRows==='function'){
    window.dealerHistoryRows=(ops,d)=>{
      let rows=[];
      (ops||[]).forEach(o=>{
        if(o.type==='sale'){
          rows.push('<tr class="clickable" data-document-row="true" data-receipt-id="'+esc(o.id)+'" ondblclick="showReceiptFromHistory('+Number(o.id)+')"><td>'+esc(o.date)+'</td><td>'+esc('Накладная № '+(o.receiptNo||''))+'</td><td>'+esc((o.items||[]).length)+' поз.</td><td>'+money(o.total)+'</td><td><button class="secondary miniBtn" onclick="showReceiptFromHistory('+Number(o.id)+')">Открыть чек</button></td></tr>');
        }else if(o.type==='payment'){
          rows.push('<tr><td>'+esc(o.date)+'</td><td>Оплата</td><td>'+esc(o.method||'Оплата')+(o.note?' · '+esc(o.note):'')+'</td><td>'+money(o.total)+'</td><td><button class="secondary miniBtn" onclick="showDebtReport('+d.id+','+o.id+')">Отчёт по долгу</button></td></tr>');
        }else if(o.type==='initial_debt'){
          rows.push('<tr><td>'+esc(o.date)+'</td><td>Начальный долг</td><td>'+esc(o.note||'Перенесено из прежнего учёта')+'</td><td>'+money(o.total)+'</td><td></td></tr>');
        }else{
          rows.push('<tr><td>'+esc(o.date)+'</td><td>'+dealerOpType(o)+'</td><td>'+dealerOpDescription(o)+'</td><td>'+money(o.total)+'</td><td></td></tr>');
        }
      });
      return rows.join('');
    };
  }

  const originalMergeSyncState=window.mergeSyncState;
  if(typeof originalMergeSyncState==='function')window.mergeSyncState=(remote,local)=>core.merge(remote||{},local||{},originalMergeSyncState(remote,local));

  let pendingSyncPush=false;
  const originalSyncPush=window.syncPush;
  if(typeof originalSyncPush==='function'){
    window.syncPush=function(manual){
      if(syncBusy){pendingSyncPush=true;return Promise.resolve()}
      let p;try{p=originalSyncPush(manual)}catch(e){throw e}
      return Promise.resolve(p).finally(()=>{if(pendingSyncPush&&!syncBusy){pendingSyncPush=false;setTimeout(()=>window.syncPush(false),120)}});
    };
    setInterval(()=>{if(pendingSyncPush&&!syncBusy&&state.sync?.enabled&&state.sync?.url){pendingSyncPush=false;window.syncPush(false)}},500);
  }

  const observer=new MutationObserver(()=>enhanceReceipts());
  observer.observe(document.body,{childList:true,subtree:true});

  const next=core.apply(JSON.parse(JSON.stringify(state)));
  if(JSON.stringify(next)!==JSON.stringify(state)){localStorage.setItem(KEY,JSON.stringify(next));state=next;render()}
  renderReceiptArchive();
  enhanceReceipts();
})();
