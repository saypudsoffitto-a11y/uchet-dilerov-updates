(()=>{
  'use strict';
  let confirming=false;
  const dealer=id=>(state.dealers||[]).find(d=>String(d.id)===String(id));
  async function remove(target,id,operationId,expectedName){
    if(confirming)return false;
    const d=dealer(id);
    if(!d||expectedName!=null&&d.name!==expectedName)return alert('Карточка изменилась. Откройте дилера заново.');
    const op=operationId==null?null:(state.ops||[]).find(o=>String(o.id)===String(operationId)&&String(o.dealerId)===String(id)&&o.type==='initial_debt');
    if(target==='operation'&&!op)return false;
    const count=(state.ops||[]).filter(o=>String(o.dealerId)===String(id)).length;
    const description=target==='operation'?'Удалить сумму из тетради '+money(op.total)+'?':target==='history'?'Очистить всю историю дилера? Продажи, оплаты, суммы из тетради и архивные чеки будут удалены. Долг станет нулевым; карточка останется.':'Удалить дилера полностью, вместе с продажами, оплатами, суммами из тетради и архивными чеками, даже при наличии долга?';
    if(!confirm('Дилер: «'+d.name+'»\n'+description+'\n'+(target==='operation'?'':'Операций: '+count+'; текущий долг: '+money(debtOf(id))+'.\n')+'Удаление распространится на сервер и все подключённые компьютеры. Складские остатки сохранятся. Отменить эту команду после отправки нельзя.'))return false;
    confirming=true;
    try{
      // A recovery copy is separate from the live shared database.
      const backup=JSON.stringify(state);
      localStorage.setItem('uchet_before_permanent_delete_8989',backup);
      if(window.updateAPI?.saveBackup){const result=await window.updateAPI.saveBackup(backup);if(!result?.ok)throw Error('Не удалось сохранить резервную копию. Удаление отменено.');}
      const command={requestId:crypto.randomUUID(),target,dealerId:String(id),confirmed:true,preserveStock:true};
      if(op)command.operationId=String(op.id);
      const result=await window.masterSync8962.queueDeletion(command);
      if(result.ok){
        window.closeOpEdit8967?.();
        if(target==='dealer'){if(typeof closeDealerModal==='function')closeDealerModal();}
        else if(dealer(id))openDealer(id);
        alert(target==='dealer'?'Дилер и его история удалены из общей базы.':target==='history'?'История очищена. Долг обнулён.':'Сумма из тетради удалена. Долг пересчитан.');
      }else alert('Команда удаления сохранена. Она будет выполнена после подключения к серверу. До подтверждения сервера данные остаются на экране.');
      return result.ok;
    }catch(e){alert(e.message||String(e));return false;}
    finally{confirming=false;}
  }
  function refresh(){
    const body=document.getElementById('dealerModalBody'),id=body?.dataset.dealerId8989;
    if(id){if(dealer(id))openDealer(id);else if(typeof closeDealerModal==='function')closeDealerModal();}
    for(const rootId of ['receiptArea','receiptViewBody']){const root=document.getElementById(rootId);const opId=root?.querySelector('[data-receipt-op-id]')?.dataset.receiptOpId;if(opId&&!(state.ops||[]).some(o=>String(o.id)===String(opId))){root.innerHTML='';document.getElementById('receiptViewModal')?.classList.add('hidden');}}
    window.closeOpEdit8967?.();
  }
  window.permanentDeleteUI8989={refresh,dealer:(id,name)=>remove('dealer',id,null,name),history:id=>remove('history',id),operation:(id,dealerId)=>remove('operation',dealerId,id)};
  const previous=window.openDealer;
  if(typeof previous==='function'){
    window.openDealer=function(id){
      const result=previous.apply(this,arguments),d=dealer(id);
      const body=document.getElementById('dealerModalBody');if(body&&d)body.dataset.dealerId8989=String(id);
      const actions=document.querySelector('#dealerModalBody .dealerSummary .actions');
      if(d&&actions&&!actions.querySelector('.permanentDelete8989')){
        for(const [text,fn] of [['Очистить всю историю',()=>window.permanentDeleteUI8989.history(id)],['Удалить дилера полностью',()=>window.permanentDeleteUI8989.dealer(id,d.name)]]){
          const b=document.createElement('button');b.type='button';b.className='secondary permanentDelete8989';b.textContent=text;b.onclick=fn;actions.appendChild(b);
        }
      }
      return result;
    };
    try{openDealer=window.openDealer}catch(_){}
  }
})();
