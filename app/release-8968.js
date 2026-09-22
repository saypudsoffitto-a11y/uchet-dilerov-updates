(()=> {
  'use strict';
  if(window.__release8968Installed)return;
  window.__release8968Installed=true;

  const esc8968=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money8968=v=>esc8968((Number(v)||0).toLocaleString('ru-RU',{maximumFractionDigits:2}))+'&nbsp;₽';

  function receiptJpegHtml8968(op,d){
    const rows=(op.items||[]).map((i,n)=>'<tr><td>'+(n+1)+'</td><td class="name">'+esc8968(i.name||'')+'</td><td>'+esc8968((Number(i.qty)||0).toLocaleString('ru-RU',{maximumFractionDigits:3})+' '+(i.unit||'шт'))+'</td><td>'+money8968(i.price)+'</td><td>'+money8968(i.total)+'</td></tr>').join('');
    return '<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0;background:#fff;color:#111;font-family:Arial,sans-serif}.sheet{width:700px;padding:24px 26px;background:#fff}h1{font-size:18px;text-align:center;margin:0 0 14px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:5px 18px;font-size:12px;margin-bottom:12px}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:11px}th,td{border:1px solid #333;padding:5px 6px;vertical-align:middle}th:nth-child(1),td:nth-child(1){width:36px;text-align:center}th:nth-child(3),td:nth-child(3){width:92px}th:nth-child(4),td:nth-child(4){width:92px;white-space:nowrap}th:nth-child(5),td:nth-child(5){width:100px;white-space:nowrap}.name{white-space:normal;overflow-wrap:anywhere}.total{text-align:right;font-size:14px;font-weight:700;margin-top:10px}.sign{display:flex;justify-content:space-between;margin-top:16px;padding-top:10px;border-top:1px solid #888;font-size:11px}</style></head><body><div class="sheet"><h1>ТОВАРНАЯ НАКЛАДНАЯ № '+esc8968(op.receiptNo)+' от '+esc8968(op.date)+'</h1><div class="meta"><div><b>Поставщик:</b> ____________________</div><div><b>Покупатель:</b> '+esc8968(d?.name||op.dealer||'')+'</div></div><table><thead><tr><th>№</th><th>Наименование</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead><tbody>'+rows+'</tbody></table><div class="total">Итого: '+money8968(op.total)+'</div><div class="sign"><span>Отпустил: ____________________</span><span>Получил: ____________________</span></div></div></body></html>';
  }

  async function sendReceiptJpeg8968(id){
    const op=(state.ops||[]).find(x=>String(x.id)===String(id)&&x.type==='sale');
    if(!op)return;
    const d=(state.dealers||[]).find(x=>String(x.id)===String(op.dealerId));
    if(!window.receiptAPI?.sendJpeg)return alert('Отправка JPEG доступна только в установленном приложении.');
    const result=await window.receiptAPI.sendJpeg({
      phone:d?.phone||'',
      fileName:'Товарная_накладная_'+op.receiptNo+'.jpg',
      html:receiptJpegHtml8968(op,d)
    });
    if(!result?.ok)return alert(result?.message||'Не удалось подготовить JPEG для WhatsApp');
    if(result.message)alert(result.message);
  }

  window.buildReceiptImage8968=receiptJpegHtml8968;
  window.sendWhatsApp=sendReceiptJpeg8968;
  try{sendWhatsApp=sendReceiptJpeg8968}catch(_){}

  /* После любых перерисовок чеков кнопка остаётся JPEG-действием. */
  function lockReceiptButtons8968(root){
    if(!root)return;
    root.querySelectorAll('.receipt[data-receipt-op-id]').forEach(receipt=>{
      const id=receipt.dataset.receiptOpId;
      receipt.querySelectorAll('button').forEach(button=>{
        if(button.textContent.trim()==='Отправить в WhatsApp'){
          button.setAttribute('onclick','sendWhatsApp('+Number(id)+')');
          button.dataset.sendFormat='jpeg';
        }
      });
    });
  }
  ['receiptArea','receiptViewBody'].forEach(id=>{
    const root=document.getElementById(id);
    if(!root)return;
    lockReceiptButtons8968(root);
    new MutationObserver(()=>lockReceiptButtons8968(root)).observe(root,{childList:true,subtree:true});
  });

  document.documentElement.dataset.interfaceVersion='8.9.68';
  document.documentElement.dataset.uchetRuntime='8.9.68';
  document.documentElement.dataset.uchetUi='8.9.68';
})();