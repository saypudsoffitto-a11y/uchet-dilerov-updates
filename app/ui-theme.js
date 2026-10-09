(()=>{
  'use strict';
  const storageKey='uchet-ui-theme',root=document.documentElement;
  const valid=value=>['colorful','multicolor','dark'].includes(value)?value:'standard';
  let theme='standard';
  try{theme=valid(localStorage.getItem(storageKey))}catch{}
  function apply(value){
    theme=valid(value);root.dataset.uiTheme=theme;root.dataset.uiCompact='true';
    const select=document.getElementById('uiThemeSelect');if(select)select.value=theme;
    const status=document.getElementById('uiThemeStatus');
    if(status)status.textContent=({standard:'Стандартная тема',colorful:'Современная зелёная тема',multicolor:'Цветное меню',dark:'Тёмная графитовая — тема № 4'})[theme];
  }
  // Apply the stored appearance before the page is painted. No business state is read.
  apply(theme);
  window.addEventListener('storage',event=>{
    if(event.key===storageKey||event.key===null)apply(event.newValue);
  });
  function install(){
    const products=document.getElementById('products'),filter=document.getElementById('productGroupFilter');
    const search=document.getElementById('productListSearch'),sort=products?.querySelector('.sortBar');
    if(products&&filter&&search&&sort){
      const group=filter.closest('label'),toolbar=document.createElement('div');
      toolbar.className='uiProductFilters';products.insertBefore(toolbar,group);
      const searchLabel=document.createElement('label');searchLabel.textContent='Поиск товара';
      searchLabel.appendChild(search);toolbar.append(group,searchLabel,sort);
    }
    const settings=document.getElementById('settings');
    if(settings&&!document.getElementById('uiAppearanceCard')){
      const card=document.createElement('div');card.id='uiAppearanceCard';card.className='card appearanceCard';
      card.innerHTML='<div class="appearanceHeading"><h3>Оформление</h3><span class="themeSwatches" aria-hidden="true"><i></i><i></i><i></i><i></i></span></div><label for="uiThemeSelect">Тема интерфейса</label><select id="uiThemeSelect" aria-describedby="uiThemeHelp"><option value="standard">Стандартная</option><option value="colorful">Современная зелёная</option><option value="multicolor">Цветное меню</option><option value="dark">Тёмная графитовая — № 4</option></select><p id="uiThemeHelp" class="muted">Применяется сразу и сохраняется на этом компьютере после перезапуска.</p><p id="uiThemeStatus" class="appearanceStatus" role="status" aria-live="polite"></p>';
      settings.insertBefore(card,settings.querySelector('.card'));apply(theme);
      card.querySelector('select').addEventListener('change',event=>{
        apply(event.target.value);
        try{localStorage.setItem(storageKey,theme)}catch{
          document.getElementById('uiThemeStatus').textContent='Тема применена. Не удалось сохранить выбор: локальное хранилище недоступно.';
        }
      });
    }
    const menuSelector='.finalMenu,.dealerContextMenu,.saleContextMenu,.productContextMenu8948,.dealerReceiptContextMenu8946,#dealerOpMenu8967';
    const prepared=new WeakSet();let menuOrigin=null;
    document.addEventListener('contextmenu',()=>{menuOrigin=document.activeElement},true);
    function decorate(menu){
      if(prepared.has(menu))return;prepared.add(menu);menu.classList.add('uiContextMenu');menu.setAttribute('role','menu');
      const items=()=>Array.from(menu.querySelectorAll('button')).filter(b=>!b.disabled&&!b.hidden);
      for(const item of items()){item.setAttribute('role','menuitem');item.tabIndex=-1}
      // Keep the existing action callbacks and confirmation dialogs intact.
      menu.addEventListener('keydown',event=>{
        const buttons=items(),index=buttons.indexOf(document.activeElement);if(!buttons.length)return;
        let next;
        if(event.key==='ArrowDown')next=(index+1)%buttons.length;
        if(event.key==='ArrowUp')next=(index+buttons.length-1)%buttons.length;
        if(event.key==='Home')next=0;
        if(event.key==='End')next=buttons.length-1;
        if(next!==undefined){event.preventDefault();event.stopPropagation();buttons[next].focus()}
        if(event.key==='Escape'||event.key==='Tab'){
          menu.remove();if(event.key==='Escape'){event.preventDefault();menuOrigin?.focus?.()}
        }
      });
      // Re-clamp after the unified spacing has changed the menu dimensions.
      const x=parseFloat(menu.style.left)||0,y=parseFloat(menu.style.top)||0;
      menu.style.left=Math.max(4,Math.min(x,innerWidth-menu.offsetWidth-4))+'px';
      menu.style.top=Math.max(4,Math.min(y,innerHeight-menu.offsetHeight-4))+'px';
      items()[0]?.focus();
    }
    function inspect(node){
      if(node.nodeType!==1)return;
      if(node.matches(menuSelector))decorate(node);
      for(const menu of node.querySelectorAll(menuSelector))decorate(menu);
    }
    const observer=new MutationObserver(records=>{
      for(const record of records)for(const node of record.addedNodes)inspect(node);
    });
    observer.observe(document.body,{childList:true,subtree:true});
    for(const menu of document.querySelectorAll(menuSelector))decorate(menu);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
