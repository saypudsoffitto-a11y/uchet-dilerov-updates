(()=>{
  'use strict';
  const core=window.receiptArchiveCore;
  const history=document.getElementById('history');
  const panel=document.createElement('details');panel.className='card archivePanel';panel.id='receiptArchivePanel';
  panel.innerHTML='<summary>Удалённые чеки <span id="receiptArchiveCount" class="tag">0</span></summary><p class="muted">Чеки сохранены в архиве и не входят в долг. Восстановление вернёт чек и его сумму в расчёты.</p><div class="tableWrap"><table><thead><tr><th>Чек</th><th>Дилер</th><th>Сумма</th><th>Удалён</th><th>Действие</th></tr></thead><tbody id="receiptArchiveRows"></tbody></table></div><p id="receiptArchiveEmpty" class="muted">Удалённых чеков нет.</p>';
  history.appendChild(panel);
  function commit(next,id){
    // A failed write must not remove the active receipt or change the visible debt.
    localStorage.setItem(KEY,JSON.stringify(next));state=next;
    document.querySelectorAll('[data-receipt-op-id]').forEach(el=>{if(String(el.dataset.receiptOpId)===String(id))el.remove()});
    document.getElementById('receiptViewModal')?.classList.add('hidden');
    document.getElementById('dealerModal')?.classList.add('hidden');
    render();
    if(!syncApplying&&state.sync?.enabled){clearTimeout(syncSaveTimer);syncSaveTimer=setTimeout(()=>syncPush(false),350)}
  }
  window.archiveReceipt=id=>{
    const op=state.ops.find(o=>String(o.id)===String(id)&&o.type==='sale');if(!op)return;
    if(!confirm('Удалить чек № '+op.receiptNo+' для «'+(op.dealer||'Дилер')+'» на '+money(op.total)+'?\n\nДолг уменьшится на эту сумму. Оплаты сохранятся. Чек можно будет восстановить: История → Удалённые чеки.'))return;
    try{commit(core.transition(state,id,true),id);go('history');panel.open=true}catch(e){alert('Не удалось удалить чек: '+e.message)}
  };
  window.restoreReceipt=id=>{
    const e=state.receiptStates?.[String(id)];if(!e?.archived)return;
    if(!confirm('Восстановить чек № '+e.receipt.receiptNo+' для «'+(e.receipt.dealer||'Дилер')+'»?\nДолг увеличится на '+money(e.receipt.total)+'.'))return;
    try{commit(core.transition(state,id,false),id);showReceiptFromHistory(id)}catch(e){alert('Не удалось восстановить чек: '+e.message)}
  };
  window.renderReceiptArchive=()=>{
    const entries=Object.entries(state.receiptStates||{}).filter(([,e])=>e.archived).sort((a,b)=>b[1].at-a[1].at);
    document.getElementById('receiptArchiveCount').textContent=entries.length;
    document.getElementById('receiptArchiveEmpty').classList.toggle('hidden',!!entries.length);
    const rows=document.getElementById('receiptArchiveRows');rows.replaceChildren();
    for(const [id,e] of entries){
      const tr=document.createElement('tr'),op=e.receipt;
      tr.innerHTML='<td>№ '+esc(op.receiptNo)+'<br><small class="muted">'+esc(op.date)+'</small></td><td>'+esc(op.dealer||'')+'</td><td>'+money(op.total)+'</td><td>'+esc(new Date(e.at).toLocaleString('ru-RU'))+'</td><td><button class="secondary miniBtn">Восстановить</button></td>';
      tr.querySelector('button').onclick=()=>restoreReceipt(id);rows.appendChild(tr);
    }
  };
  // Reconcile persisted archive state before the first render after an upgrade.
  const next=core.apply(JSON.parse(JSON.stringify(state)));
  if(JSON.stringify(next)!==JSON.stringify(state)){localStorage.setItem(KEY,JSON.stringify(next));state=next;render()}
  renderReceiptArchive();
})();
