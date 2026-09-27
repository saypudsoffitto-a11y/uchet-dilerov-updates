(()=>{
 'use strict';
 const originalSave=window.save;
 window.save=function(...args){
  let before;try{before=JSON.parse(localStorage.getItem(KEY)||'null');}catch(_){}
  if(before)window.CatalogPending8972.recordCatalog(state,before);
  return originalSave.apply(this,args);
 };
 // All computers edit the common catalog. Keep legacy role transfer out of the normal workflow.
 const style=document.createElement('style');style.textContent='#transferMaster8962,#computerTarget8962{display:none!important}';document.head.appendChild(style);
})();
