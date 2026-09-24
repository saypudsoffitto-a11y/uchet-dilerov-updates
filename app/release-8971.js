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
    try{
      const ok=await window.masterSync8962.push(true);
      productStatus8971(ok?'Карточка «'+snapshot.name+'» отправлена на сервер.':'Карточка «'+snapshot.name+'» сохранена на этом компьютере. Отправка на сервер не подтверждена.',!ok);
    }catch(e){productStatus8971('Карточка сохранена на этом компьютере. Синхронизация: '+String(e?.message||e),true);}
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
    const previousPending=clone(state.pendingProducts8972||{});
    window.CatalogPending8972.record(state,null,row);
    state.products.push(row);
    try{localStorage.setItem(KEY,JSON.stringify(state));}
    catch(e){state.products=state.products.filter(p=>p!==row);state.pendingProducts8972=previousPending;alert('Товар не сохранён: '+String(e?.message||e));return;}


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
    const filter=byId('productGroupFilter');if(filter)filter.value='';

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
    const before=clone(p),previousPending=clone(state.pendingProducts8972||{});
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
    window.CatalogPending8972.record(state,before,snapshot);
    try{localStorage.setItem(KEY,JSON.stringify(state));}
    catch(e){Object.keys(p).forEach(k=>delete p[k]);Object.assign(p,before);state.pendingProducts8972=previousPending;alert('Цена не сохранена: '+String(e?.message||e));return;}

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
  document.documentElement.dataset.productCreateFix='8.9.72';
  document.documentElement.dataset.interfaceVersion='8.9.72';
})();
