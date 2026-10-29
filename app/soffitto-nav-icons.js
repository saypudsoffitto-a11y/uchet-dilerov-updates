// Decorative SVGs only: keep navigation labels, callbacks and badges intact.
(()=>{
  'use strict';
  const icons={
    home:['#8ec5ff','<path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9" fill="var(--sf-ni)" fill-opacity=".17"/><path d="M9 20v-6h6v6"/><path d="M10 9h4" stroke="#f5cc73"/>'],
    dealers:['#8ec5ff','<rect x="3" y="3" width="18" height="18" rx="4" fill="var(--sf-ni)" fill-opacity=".13"/><circle cx="10" cy="9" r="2.5" fill="var(--sf-ni)" stroke="none"/><path d="M5.8 17.5v-1a4.2 4.2 0 0 1 8.4 0v1" fill="var(--sf-ni)" stroke="none"/><path d="M17 8h1.5M17 12h1.5M17 16h1.5"/>'],
    sales:['#80ddbb','<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z" fill="var(--sf-ni)" fill-opacity=".13"/><path d="M8 7h8M8 11h5"/><path d="M14 16h6m-3-3v6" stroke="#b5f2d9"/>'],
    payments:['#f5cc73','<path d="M3 12v6c0 3 12 3 12 0v-6" fill="var(--sf-ni)" fill-opacity=".22"/><ellipse cx="9" cy="12" rx="6" ry="2.7" fill="var(--sf-ni)" fill-opacity=".35"/><path d="M3 15c2 2 10 2 12 0"/><circle cx="17" cy="7" r="4.5" fill="var(--sf-ni)" fill-opacity=".2"/><path d="M15.3 7.2 16.5 8.5l2.3-2.6" stroke="#b5f2d9"/>'],
    debts:['#f5cc73','<path d="M4 5h12v15H4z" fill="var(--sf-ni)" fill-opacity=".14"/><path d="M7 9h5M7 13h3M7 17h2"/><circle cx="17" cy="15" r="5" fill="#39404a" stroke="#eda08a"/><path d="M17 12.5v3l2 1" stroke="#eda08a"/>'],
    history:['#c3b2f1','<circle cx="12" cy="12" r="9" fill="var(--sf-ni)" fill-opacity=".13"/><path d="M12 6.5v6l4 2"/><circle cx="12" cy="12" r="1" fill="var(--sf-ni)" stroke="none"/>'],
    products:['#8ec5ff','<path d="m3 7 9-4 9 4-9 4z" fill="var(--sf-ni)" fill-opacity=".3"/><path d="M3 7v10l9 4 9-4V7M12 11v10" fill="var(--sf-ni)" fill-opacity=".1"/><path d="m7.5 5 9 4v4" stroke="#f5cc73"/>'],
    pricelist:['#80ddbb','<path d="M5 3h10l4 4v14H5z" fill="var(--sf-ni)" fill-opacity=".13"/><path d="M15 3v5h4M8 11h7M8 15h4M8 18h4"/><path d="M16 15v4m-1.5-2h3" stroke="#f5cc73"/>'],
    groups:['#c3b2f1','<rect x="3" y="3" width="7" height="7" rx="1.5" fill="var(--sf-ni)" fill-opacity=".22"/><rect x="14" y="3" width="7" height="7" rx="1.5" fill="var(--sf-ni)" fill-opacity=".22"/><path d="M6.5 14h11M12 10v4M6.5 14v3M17.5 14v3"/><rect x="3" y="17" width="7" height="4" rx="1" fill="var(--sf-ni)" fill-opacity=".22"/><rect x="14" y="17" width="7" height="4" rx="1" fill="var(--sf-ni)" fill-opacity=".22"/>'],
    newmatros:['#74d8d9','<path d="M3 7h17l-4-4M21 17H4l4 4"/><path d="M20 7v5M4 17v-5" stroke="#8ec5ff"/>'],
    sync:['#8ec5ff','<rect x="3" y="3" width="18" height="7" rx="2" fill="var(--sf-ni)" fill-opacity=".13"/><rect x="3" y="14" width="18" height="7" rx="2" fill="var(--sf-ni)" fill-opacity=".13"/><path d="M7 6.5h.1M7 17.5h.1" stroke="#80ddbb" stroke-width="2.5"/><path d="M12 6.5h5M12 17.5h5M12 10v4"/>'],
    backup:['#c3b2f1','<path d="M6 17H5a4 4 0 0 1-.6-8 7 7 0 0 1 13.2-1A4.5 4.5 0 0 1 19 17h-1" fill="var(--sf-ni)" fill-opacity=".13"/><path d="M12 11v10m-3-3 3 3 3-3" stroke="#8ec5ff"/>'],
    updates:['#80ddbb','<path d="M20 9a8 8 0 0 0-14-3L3 9m0-5v5h5M4 15a8 8 0 0 0 14 3l3-3m0 5v-5h-5"/><path d="M12 8v8m-3-3 3 3 3-3" stroke="#b5f2d9"/>'],
    warehouse:['#f5cc73','<path d="m3 9 9-6 9 6v12H3z" fill="var(--sf-ni)" fill-opacity=".14"/><path d="M7 21V11h10v10M7 15h10M7 18h10"/><path d="M10 7h4" stroke="#eda08a"/>'],
    settings:['#b4c6d8','<path d="m9 3-.5 2-2 1-2-.5-2 3 1.5 1.5v3L2.5 15l2 3 2-.5 2 1 .5 2h4l.5-2 2-1 2 .5 2-3-1.5-2v-3L20 8.5l-2-3-2 .5-2-1-.5-2z" fill="var(--sf-ni)" fill-opacity=".13"/><circle cx="11.5" cy="12" r="3" fill="#c3b2f1" fill-opacity=".3" stroke="#c3b2f1"/>']
  };
  function install(){
    const nav=document.querySelector('nav');if(!nav)return;
    function decorate(button){
      const icon=icons[button.dataset.section];if(!icon)return;
      let well=button.querySelector('.navIcon');
      if(!well){well=document.createElement('span');well.className='navIcon';button.prepend(well)}
      well.classList.add('soffittoNavIcon');well.setAttribute('aria-hidden','true');
      well.style.setProperty('--sf-ni',icon[0]);
      well.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" focusable="false" stroke-linecap="round" stroke-linejoin="round">'+icon[1]+'</svg>';
    }
    for(const button of nav.querySelectorAll('button[data-section]'))decorate(button);
    // The preload adds the price-list button after the initial document loads.
    new MutationObserver(records=>{
      for(const record of records)for(const node of record.addedNodes){
        if(node.nodeType===1&&node.matches('button[data-section]'))decorate(node);
      }
    }).observe(nav,{childList:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
