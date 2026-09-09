(()=>{
 if(window.__inputFocus8928)return;window.__inputFocus8928=true;
 let last=null;
 const editable=el=>el&&el.isConnected&&!el.disabled&&!el.readOnly&&el.matches?.('input:not([type="file"]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]),textarea,select')&&el.getClientRects().length>0&&!el.closest('[inert]');
 const remember=el=>{if(editable(el))last={el,start:el.selectionStart,end:el.selectionEnd,direction:el.selectionDirection}};
 document.addEventListener('focusin',e=>remember(e.target),true);
 document.addEventListener('selectionchange',()=>remember(document.activeElement));
 window.windowAPI?.onRestoreInput(()=>{if(!last||!document.hasFocus()||!editable(last.el))return;const active=document.activeElement;if(active!==document.body&&active!==last.el)return;const {el,start,end,direction}=last;el.focus({preventScroll:true});if(typeof start==='number')try{el.setSelectionRange(start,end,direction)}catch{}});
 // Never enable disabled fields or strip readonly, and never schedule late
 // focus retries that can take the cursor back from the next clicked field.
 window.forceInputFocus=(el,selectAll)=>{if(!editable(el))return;el.focus({preventScroll:true});if(selectAll&&typeof el.select==='function')el.select();remember(el)};
 window.confirm=message=>!!window.windowAPI.showDialog('confirm',String(message));
 window.alert=message=>{window.windowAPI.showDialog('alert',String(message))};
 document.documentElement.dataset.uchetRuntime='8.9.29';
 const badge=document.getElementById('runtime8921Badge');if(badge)badge.textContent='исправления 8.9.29 активны';
})();
