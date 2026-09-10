(()=>{
  'use strict';
  if(window.__uchetRuntime8930)return;

  function install(){
    if(window.__uchetRuntime8930)return true;
    if(typeof state==='undefined'||typeof save!=='function'||typeof norm!=='function')return false;
    if(!window.__uchetPatch8914)return false;
    window.__uchetRuntime8930=true;

    const now=()=>Date.now();
    const idKey=id=>String(id);
    const asStamp=v=>{
      if(Number.isFinite(+v)&&+v>0)return +v;
      const p=Date.parse(String(v||''));
      return Number.isFinite(p)?p:0;
    };
    const itemStamp=x=>Math.max(asStamp(x&&x.updatedAt),asStamp(x&&x.ts),asStamp(x&&x.id));
    const tombstones=(x,key)=>x&&x[key]&&typeof x[key]==='object'?x[key]:{};
    const mergeTombstones=(a,b)=>{
      const out={};
      for(const src of [a||{},b||{}])for(const [k,v] of Object.entries(src))out[k]=Math.max(+out[k]||0,+v||0);
      return out;
    };
    const mergeNewest=(remote,local,deleted)=>{
      const m=new Map();
      for(const x of remote||[])m.set(idKey(x.id),x);
      for(const x of local||[]){
        const k=idKey(x.id),prev=m.get(k);
        if(!prev||itemStamp(x)>itemStamp(prev))m.set(k,x);
      }
      for(const [k,x] of [...m]){
        const deletedAt=+deleted[k]||0;
        if(deletedAt&&deletedAt>=itemStamp(x))m.delete(k);
      }
      return [...m.values()];
    };

    state.deletedDealers=tombstones(state,'deletedDealers');
    state.deletedProducts=tombstones(state,'deletedProducts');
    localStorage.setItem(KEY,JSON.stringify(state));

    const dealerForOp=op=>{
      const active=(state.dealers||[]).find(x=>x.id==op?.dealerId);
      if(active)return active;
      return {id:op?.dealerId,name:op?.dealer||'Удалённый дилер',phone:op?.dealerPhone||'',city:op?.dealerCity||''};
    };
    const snapshotDealer=(op,d)=>{
      if(!op||!d)return;
      if(!op.dealer)op.dealer=d.name||'';
      if(!op.dealerPhone)op.dealerPhone=d.phone||'';
      if(!op.dealerCity)op.dealerCity=d.city||'';
    };

    deleteDealerFromList=function(id){
      if(typeof hideDealerContextMenu==='function')hideDealerContextMenu();
      const d=(state.dealers||[]).find(x=>x.id==id);if(!d)return;
      const related=(state.ops||[]).filter(o=>o.dealerId==id);
      if(!confirm('Удалить карточку дилера «'+d.name+'» из списка?'))return;
      const detail=related.length
        ?'Карточка исчезнет из списка, но '+related.length+' старых продаж/чеков/оплат останутся в истории. Подтвердить удаление карточки?'
        :'Карточка будет удалена из списка. Подтвердить окончательное удаление?';
      if(!confirm(detail))return;
      related.forEach(o=>snapshotDealer(o,d));
      state.deletedDealers=state.deletedDealers||{};
      state.deletedDealers[idKey(id)]=now();
      state.dealers=state.dealers.filter(x=>x.id!=id);
      save();
      if(typeof closeDealerModal==='function')closeDealerModal();
    };

    const originalAddDealer=window.addDealer;
    if(typeof originalAddDealer==='function')addDealer=function(){
      const before=new Set((state.dealers||[]).map(x=>idKey(x.id)));
      const result=originalAddDealer.apply(this,arguments);
      const d=(state.dealers||[]).find(x=>!before.has(idKey(x.id)));
      if(d){d.updatedAt=now();if(state.deletedDealers)delete state.deletedDealers[idKey(d.id)];save()}
      return result;
    };

    const originalSaveDealerEdit=window.saveDealerEdit;
    if(typeof originalSaveDealerEdit==='function')saveDealerEdit=function(id){
      const d=(state.dealers||[]).find(x=>x.id==id);if(d)d.updatedAt=now();
      return originalSaveDealerEdit.apply(this,arguments);
    };

    const originalSaveDealerPhoto=window.saveDealerPhoto;
    if(typeof originalSaveDealerPhoto==='function')saveDealerPhoto=async function(id,e){
      const d=(state.dealers||[]).find(x=>x.id==id);if(d)d.updatedAt=now();
      return await originalSaveDealerPhoto.apply(this,arguments);
    };

    const wrapOpCreator=name=>{
      const original=window[name];if(typeof original!=='function')return;
      window[name]=function(){
        const ids=new Set((state.ops||[]).map(o=>idKey(o.id)));
        const result=original.apply(this,arguments);
        const fresh=(state.ops||[]).filter(o=>!ids.has(idKey(o.id)));
        let changed=false;
        for(const op of fresh){const d=(state.dealers||[]).find(x=>x.id==op.dealerId);if(d){snapshotDealer(op,d);op.updatedAt=now();changed=true}}
        if(changed)save();
        return result;
      };
    };
    wrapOpCreator('saveSale');wrapOpCreator('makePayment');wrapOpCreator('confirmInitialDebt');

    showReceiptFromHistory=function(id){
      const op=(state.ops||[]).find(x=>x.id==id);if(!op)return;
      const d=dealerForOp(op);
      receiptViewBody.innerHTML=renderReceiptHtml(op,d);
      receiptViewModal.classList.remove('hidden');
    };
    refreshReceiptViews=function(opId){
      const op=(state.ops||[]).find(x=>x.id==opId);if(!op)return;
      const d=dealerForOp(op),html=renderReceiptHtml(op,d);
      if(receiptArea.querySelector('[data-receipt-op-id="'+opId+'"]'))receiptArea.innerHTML=html;
      if(receiptViewBody.querySelector('[data-receipt-op-id="'+opId+'"]'))receiptViewBody.innerHTML=html;
    };
    const originalSendWhatsApp=window.sendWhatsApp;
    if(typeof originalSendWhatsApp==='function')sendWhatsApp=async function(id){
      const op=(state.ops||[]).find(x=>x.id==id);if(!op)return;
      const d=dealerForOp(op),phone=d.phone||op.dealerPhone||'';
      if(!window.whatsappAPI||!window.whatsappAPI.send)return alert('Отправка через WhatsApp Desktop доступна только в установленном приложении Windows.');
      const r=await window.whatsappAPI.send({phone,text:receiptText(op)});
      if(!r||!r.ok)alert((r&&r.message)||'Не удалось открыть WhatsApp Desktop. Проверь, что приложение WhatsApp установлено на компьютере.');
    };
    showDebtReport=function(dealerId,paymentId){
      const p=paymentId?(state.ops||[]).find(x=>x.id==paymentId&&x.type==='payment'):(state.ops||[]).filter(x=>x.dealerId==dealerId&&x.type==='payment').sort((a,b)=>opTime(b)-opTime(a))[0];
      const ref=p||(state.ops||[]).find(x=>x.dealerId==dealerId);
      const d=ref?dealerForOp(ref):(state.dealers||[]).find(x=>x.id==dealerId);if(!d)return;
      const before=p?debtBeforePayment(p):debtOf(dealerId),paid=p?(+p.total||0):0,after=p?(Number.isFinite(+p.afterDebt)?+p.afterDebt:before-paid):debtOf(dealerId),date=p?p.date:new Date().toLocaleString('ru-RU');
      debtReportBody.innerHTML='<div class="receipt" id="debtReportPrint"><h2>ОТЧЁТ ПО ДОЛГУ</h2><p><b>Дилер:</b> '+esc(d.name)+'</p><p><b>Дата:</b> '+esc(date)+'</p><div class="grid" style="grid-template-columns:repeat(3,1fr)"><div class="card">Долг до оплаты<div class="big">'+money(before)+'</div></div><div class="card">Оплачено<div class="big ok">'+money(paid)+'</div></div><div class="card">Остаток<div class="big danger">'+money(after)+'</div></div></div><p style="margin-top:18px"><b>Текущий долг:</b> '+money(debtOf(dealerId))+'</p><div class="actions" style="margin-top:18px"><button class="primary" onclick="printDebtReport()">Распечатать / сохранить PDF</button><button class="primary" onclick="sendDebtReportWhatsApp('+dealerId+','+(p?p.id:'null')+')">Отправить в WhatsApp</button><button class="secondary" onclick="downloadDebtReport('+dealerId+','+(p?p.id:'null')+')">Скачать отчёт</button></div></div>';
      debtReportModal.classList.remove('hidden');
    };
    debtReportText=function(dealerId,paymentId){
      const p=paymentId?(state.ops||[]).find(x=>x.id==paymentId&&x.type==='payment'):(state.ops||[]).filter(x=>x.dealerId==dealerId&&x.type==='payment').sort((a,b)=>opTime(b)-opTime(a))[0];
      const ref=p||(state.ops||[]).find(x=>x.dealerId==dealerId),d=ref?dealerForOp(ref):(state.dealers||[]).find(x=>x.id==dealerId);
      const before=p?debtBeforePayment(p):debtOf(dealerId),paid=p?(+p.total||0):0,after=p?(Number.isFinite(+p.afterDebt)?+p.afterDebt:before-paid):debtOf(dealerId);
      return 'Отчёт по долгу\nДилер: '+(d?.name||'')+'\nДата: '+(p?.date||new Date().toLocaleString('ru-RU'))+'\nДолг до оплаты: '+money(before)+'\nОплачено: '+money(paid)+'\nОстаток: '+money(after)+'\nТекущий долг: '+money(debtOf(dealerId));
    };
    sendDebtReportWhatsApp=async function(dealerId,paymentId){
      const p=paymentId?(state.ops||[]).find(x=>x.id==paymentId):(state.ops||[]).find(x=>x.dealerId==dealerId),d=p?dealerForOp(p):(state.dealers||[]).find(x=>x.id==dealerId);
      const phone=d?.phone||p?.dealerPhone||'';if(!phone)return alert('У дилера не сохранён номер WhatsApp');
      if(!window.whatsappAPI||!window.whatsappAPI.send)return alert('Отправка через WhatsApp Desktop доступна только в установленном приложении Windows.');
      const r=await window.whatsappAPI.send({phone,text:debtReportText(dealerId,paymentId)});if(!r||!r.ok)alert((r&&r.message)||'Не удалось открыть WhatsApp Desktop.');
    };

    delProduct=function(id){
      const p=(state.products||[]).find(x=>x.id==id);if(!p)return;
      const used=(state.ops||[]).some(o=>o.type==='sale'&&Array.isArray(o.items)&&o.items.some(i=>i.productId==id));
      if(used){
        if(!confirm('Товар «'+p.name+'» уже есть в накладных. Убрать его из активного списка и оставить старые документы?'))return;
        if(!confirm('Подтверди ещё раз: товар будет архивирован, а старые накладные и чеки сохранятся.'))return;
        p.archived=true;p.updatedAt=now();save();return;
      }
      if(!confirm('Удалить товар «'+p.name+'»?'))return;
      if(!confirm('Подтверди ещё раз: удалить товар без возможности восстановления?'))return;
      state.deletedProducts=state.deletedProducts||{};
      state.deletedProducts[idKey(id)]=now();
      state.products=state.products.filter(x=>x.id!=id);
      save();
    };
    function hideProductContextMenu(){document.getElementById('productContextMenu8930')?.remove()}
    function showProductMenu(e,id){
      e.preventDefault();e.stopPropagation();hideProductContextMenu();
      const m=document.createElement('div');m.id='productContextMenu8930';m.className='saleContextMenu';
      m.style.left=Math.min(e.clientX,window.innerWidth-270)+'px';m.style.top=Math.min(e.clientY,window.innerHeight-120)+'px';
      m.innerHTML='<button type="button" data-act="edit">Изменить карточку товара</button><button type="button" data-act="delete" style="color:#b42318">Удалить товар</button>';
      m.querySelector('[data-act="edit"]').onclick=()=>{hideProductContextMenu();editProduct(id)};
      m.querySelector('[data-act="delete"]').onclick=()=>{hideProductContextMenu();delProduct(id)};
      document.body.appendChild(m);
    }
    showSaleProductContextMenu=function(e,id){showProductMenu(e,id)};
    document.addEventListener('contextmenu',e=>{
      const row=e.target.closest?.('#productRows tr');if(!row)return;
      const attr=row.getAttribute('onclick')||'';const m=attr.match(/editProduct\((\d+)\)/);if(m)showProductMenu(e,+m[1]);
    },true);
    document.addEventListener('click',hideProductContextMenu);
    window.addEventListener('blur',hideProductContextMenu);

    mergeSyncState=function(remote,local){
      remote=norm(remote||{});local=norm(local||{});
      const deletedDealers=mergeTombstones(tombstones(remote,'deletedDealers'),tombstones(local,'deletedDealers'));
      const deletedProducts=mergeTombstones(tombstones(remote,'deletedProducts'),tombstones(local,'deletedProducts'));
      remote.deletedDealers=deletedDealers;
      remote.deletedProducts=deletedProducts;
      remote.dealers=mergeNewest(remote.dealers,local.dealers,deletedDealers);
      remote.groups=mergeNewest(remote.groups,local.groups,{});
      remote.products=mergeNewest(remote.products,local.products,deletedProducts);
      remote.ops=mergeNewest(remote.ops,local.ops,{}).sort((a,b)=>opTime(a)-opTime(b));
      remote.receiptSeq=Math.max(+remote.receiptSeq||1,+local.receiptSeq||1);
      remote.update=local.update||remote.update;
      remote.newmatros=local.newmatros||remote.newmatros;
      remote.sync=local.sync||remote.sync;
      return norm(remote);
    };

    const originalSaveProductEdit=window.saveProductEdit;
    if(typeof originalSaveProductEdit==='function')saveProductEdit=function(){
      const id=+document.getElementById('editProductId')?.value;
      const p=(state.products||[]).find(x=>x.id==id);if(p)p.updatedAt=now();
      return originalSaveProductEdit.apply(this,arguments);
    };
    const originalEditReceiptItem=window.editReceiptItem;
    if(typeof originalEditReceiptItem==='function')editReceiptItem=function(opId){
      const op=(state.ops||[]).find(x=>x.id==opId);if(op)op.updatedAt=now();
      return originalEditReceiptItem.apply(this,arguments);
    };

    if(window.assistantAudio&&typeof window.assistantAudio.speak==='function'&&!window.__voice8930){
      window.__voice8930=true;
      const cloudSpeak=window.assistantAudio.speak.bind(window.assistantAudio);
      window.assistantAudio.speak=async text=>{
        try{
          const c=window.audioAPI&&await window.audioAPI.config();
          if(c&&c.mode==='cloud')return cloudSpeak(text);
          if(!('speechSynthesis' in window))return cloudSpeak(text);
          const voices=speechSynthesis.getVoices()||[],ru=voices.filter(v=>/^ru[-_]/i.test(v.lang)||/russian|рус/i.test(v.name));
          const saved=localStorage.getItem('uchetVoiceSelected8917')||'';
          const rank=v=>{const n=String(v.name||'').toLowerCase();let score=0;if(v.name===saved)score+=1000;if(/natural|neural|online/.test(n))score+=200;if(/svetlana|светлана|irina|ирина|alena|алена|dariya|дарья/.test(n))score+=80;if(/microsoft|google/.test(n))score+=20;return score};
          const voice=ru.sort((a,b)=>rank(b)-rank(a))[0];
          if(!voice)return cloudSpeak(text);
          speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(String(text));u.voice=voice;u.lang=voice.lang||'ru-RU';u.rate=.96;u.pitch=1;speechSynthesis.speak(u);
        }catch(_){return cloudSpeak(text)}
      };
    }

    const header=document.querySelector('header');
    let back=document.getElementById('backBtn8930');
    const stack=[];let goingBack=false;
    const currentSection=()=>document.querySelector('main>section:not(.hidden)')?.id||'';
    const originalShow=window.show;
    if(header&&!back){
      back=document.createElement('button');back.id='backBtn8930';back.type='button';back.className='secondary';back.textContent='← Назад';
      back.style.position='absolute';back.style.left='242px';back.style.top='14px';back.disabled=true;
      const title=document.getElementById('pageTitle');if(title)title.style.marginLeft='105px';
      header.insertBefore(back,header.firstChild);
    }
    const updateBack=()=>{if(back)back.disabled=!stack.length};
    if(typeof originalShow==='function')show=function(id,b){
      const cur=currentSection();if(!goingBack&&cur&&cur!==id)stack.push(cur);
      const r=originalShow.call(this,id,b);updateBack();return r;
    };
    if(back)back.onclick=()=>{
      const id=stack.pop();if(!id)return updateBack();
      goingBack=true;const b=document.querySelector('nav button[data-section="'+id+'"]');originalShow.call(window,id,b);goingBack=false;updateBack();
    };

    document.documentElement.dataset.uchetRuntime='8.9.30';
    return true;
  }

  let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>60)clearInterval(timer)},100);
})();
