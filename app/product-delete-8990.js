(()=>{
  'use strict';
  if(window.productDeletion8990)return;
  const matches=(item,id)=>String(item?.productId)===String(id);
  function hasHistory(id){
    // Archived receipts and removed receipt lines still refer to the card.
    const receipts=Object.values(state.receiptStates||{}).map(entry=>entry?.receipt).filter(Boolean);
    return [...(state.ops||[]),...receipts].some(op=>(op.items||[]).some(item=>matches(item,id)))||
      Object.values(state.receiptItemStates||{}).some(entry=>matches(entry?.item,id));
  }
  function remove(id){
    const product=(state.products||[]).find(p=>String(p.id)===String(id));
    if(!product||product.archived)return;
    const used=hasHistory(id);
    const message=used?'Удалить товар «'+product.name+'» из списка? Старые чеки, движения и остаток сохранятся в архивной карточке.':'Удалить товар «'+product.name+'»?';
    if(!confirm(message))return;
    const next=JSON.parse(JSON.stringify(state));
    if(used){
      const card=next.products.find(p=>String(p.id)===String(id));
      card.archived=true;card.updatedAt=new Date().toISOString();
    }else{
      next.deletedProducts=next.deletedProducts||{};
      next.deletedProducts[String(product.id)]=Date.now();
      next.products=next.products.filter(p=>String(p.id)!==String(id));
    }
    try{
      if(typeof window.masterSync8962?.commitState!=='function')throw new Error('Модуль сохранения ещё не готов. Повторите удаление.');
      window.masterSync8962.commitState(next);
    }catch(error){
      alert('Не удалось сохранить удаление товара. Товар и чек не изменены. '+(error.message||String(error)));
      return false;
    }
    // A deleted card must not remain in an unposted sale draft.
    if(typeof cart!=='undefined'&&Array.isArray(cart))cart=cart.filter(item=>!matches(item,id));
    if(typeof document!=='undefined'){
      const selected=document.getElementById('saleProduct');
      if(selected&&String(selected.value)===String(id)){
        selected.value='';
        const photo=document.getElementById('selectedPhoto');if(photo)photo.innerHTML='';
        const price=document.getElementById('salePrice');if(price)price.value='';
        if(typeof closeQtyModal==='function')closeQtyModal();
      }
    }
    render();
    if(state.sync?.enabled&&typeof syncPush==='function'){
      clearTimeout(syncSaveTimer);
      syncSaveTimer=setTimeout(()=>syncPush(false),350);
    }
    return true;
  }
  window.productDeletion8990={hasHistory,remove};
  window.delProduct=remove;
  delProduct=remove;
})();
