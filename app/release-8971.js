(()=>{
  'use strict';
  if(window.__release8971ProductCreate)return;
  window.__release8971ProductCreate=true;

  const byId=id=>document.getElementById(id);
  const num=value=>{
    const n=Number(String(value??'').replace(/\s/g,'').replace(',','.'));
    return Number.isFinite(n)?n:0;
  };
  const clone=value=>JSON.parse(JSON.stringify(value));

  function productStatus8971(text,bad=false){
    const root=byId('products');
    if(!root)return;
    let el=byId('productCreateStatus8971');
    if(!el){
      el=document.createElement('div');
      el.id='productCreateStatus8971';
      el.style.cssText='margin:0 0 12px;padding:9px 11px;border-radius:9px;font-weight:700;font-size:13px';
      const actions=root.querySelector(':scope > .actions');
      (actions||root.querySelector('h2'))?.insertAdjacentElement('afterend',el);
    }
    el.textContent=text;
    el.style.background=bad?'#fff2f0':'#eef8f2';
    el.style.border='1px solid '+(bad?'#f4b8b1':'#cde8d7');
    el.style.color=bad?'#9f2a20':'#176b3a';
  }

  function ensureOptionalGroup8971(){
    const select=byId('pgroup');
    if(!select)return;
    let empty=[...select.options].find(o=>o.value==='');
    if(!empty){
      empty=document.createElement('option');
      empty.value='';
      select.prepend(empty);
    }
    if(empty.textContent!=='Без группы (необязательно)')empty.textContent='Без группы (необязательно)';
  }

  function persist8971(){
    localStorage.setItem(KEY,JSON.stringify(state));
    if(typeof render==='function')render();
    else if(typeof renderProducts==='function')renderProducts();
    ensureOptionalGroup8971();
  }

  async function syncProduct8971(snapshot){
    if(!snapshot||!state?.sync?.enabled||!state?.sync?.url||!window.masterSync8962?.push)return;
    const id=String(snapshot.id);
    try{
      const first=await window.masterSync8962.push(true);
      if(first){productStatus8971('Товар «'+(snapshot.name||'')+'» создан и отправлен на сервер.');return;}

      // On a computer without a sync baseline the legacy push first performs a pull.
      // That pull can replace the just-created local catalogue. Restore the exact card,
      // persist it, then retry now that the baseline exists.
      const current=(state.products||[]).find(p=>String(p.id)===id);
      if(!current||JSON.stringify(current)!==JSON.stringify(snapshot)){
        state.products=Array.isArray(state.products)?state.products:[];
        const index=state.products.findIndex(p=>String(p.id)===id);
        if(index>=0)state.products[index]=clone(snapshot);else state.products.push(clone(snapshot));
        persist8971();
      }
      await new Promise(resolve=>setTimeout(resolve,120));
      const second=await window.masterSync8962.push(true);
      if(second)productStatus8971('Товар «'+(snapshot.name||'')+'» создан и отправлен на сервер.');
      else productStatus8971('Товар «'+(snapshot.name||'')+'» создан локально. Сервер пока не подтвердил синхронизацию.',true);
    }catch(e){
      const exists=(state.products||[]).some(p=>String(p.id)===id);
      if(!exists){state.products.push(clone(snapshot));persist8971();}
      productStatus8971('Товар создан локально. Синхронизация: '+String(e?.message||'ошибка сервера'),true);
    }
  }

  window.addProduct=async function(){
    const group=byId('pgroup'),nameEl=byId('pname'),articleEl=byId('particle'),buyEl=byId('pbuy'),retailEl=byId('pretail'),wholesaleEl=byId('pwholesale'),unitEl=byId('punit'),photoEl=byId('pphoto');
    if(!nameEl)return alert('Форма товара не загрузилась. Закрой и снова открой раздел «Товары».');
    const name=String(nameEl.value||'').trim();
    if(!name){nameEl.focus();return alert('Укажи название товара');}

    let id=Date.now();
    while((state.products||[]).some(p=>String(p.id)===String(id)))id++;
    let photo='';
    let photoError=false;
    if(photoEl?.files?.[0]&&typeof imageToDataURL==='function'){
      try{photo=await imageToDataURL(photoEl.files[0])}catch(_){photoError=true;}
    }
    const row={
      id,
      groupId:num(group?.value),
      name,
      article:String(articleEl?.value||'').trim(),
      buyPrice:Math.max(0,num(buyEl?.value)),
      retailPrice:Math.max(0,num(retailEl?.value)),
      wholesalePrice:Math.max(0,num(wholesaleEl?.value)),
      unit:unitEl?.value||'шт',
      photo,
      archived:false,
      updatedAt:Date.now()
    };
    state.products=Array.isArray(state.products)?state.products:[];
    state.products.push(row);

    if(nameEl)nameEl.value='';
    if(articleEl)articleEl.value='';
    if(buyEl)buyEl.value='';
    if(retailEl)retailEl.value='';
    if(wholesaleEl)wholesaleEl.value='';
    if(unitEl)unitEl.value='шт';
    if(photoEl)photoEl.value='';
    if(group)group.value='';
    const search=byId('productListSearch');
    if(search)search.value='';

    persist8971();
    if(typeof toggleAddProductForm==='function')toggleAddProductForm(false);
    if(typeof renderProducts==='function')renderProducts();
    productStatus8971(photoError?'Товар «'+name+'» создан без фотографии — файл фото не удалось прочитать.':'Товар «'+name+'» создан.');
    void syncProduct8971(clone(row));
    return row;
  };
  try{addProduct=window.addProduct}catch(_){}

  window.saveProductEdit=function(){
    const id=num(byId('editProductId')?.value);
    const p=(state.products||[]).find(x=>Number(x.id)===id);
    if(!p)return alert('Карточка товара не найдена');
    const name=String(byId('editPname')?.value||'').trim();
    if(!name)return alert('Укажи название товара');
    p.name=name;
    p.groupId=num(byId('editPgroup')?.value);
    p.article=String(byId('editParticle')?.value||'').trim();
    p.buyPrice=Math.max(0,num(byId('editPbuy')?.value));
    p.retailPrice=Math.max(0,num(byId('editPretail')?.value));
    p.wholesalePrice=Math.max(0,num(byId('editPwholesale')?.value));
    p.unit=byId('editPunit')?.value||p.unit||'шт';
    if(typeof pendingEditPhoto!=='undefined'&&pendingEditPhoto!==null)p.photo=pendingEditPhoto;
    p.updatedAt=Date.now();
    const snapshot=clone(p);
    persist8971();
    if(typeof closeProductModal==='function')closeProductModal();
    if(typeof renderProducts==='function')renderProducts();
    productStatus8971('Карточка «'+name+'» сохранена.');
    void syncProduct8971(snapshot);
    return snapshot;
  };
  try{saveProductEdit=window.saveProductEdit}catch(_){}

  const group=byId('pgroup');
  if(group)new MutationObserver(ensureOptionalGroup8971).observe(group,{childList:true});
  ensureOptionalGroup8971();
  document.documentElement.dataset.productCreateFix='8.9.71';
  document.documentElement.dataset.interfaceVersion='8.9.71';
})();
