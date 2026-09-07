(()=>{
  if(window.__uchetUiFix8915)return;
  window.__uchetUiFix8915=true;

  const css=document.createElement('style');
  css.textContent=`
    #dealerModal{z-index:500!important}
    #dealerModal .modalBox{position:relative;z-index:501;pointer-events:auto!important}
    #dealerModal #dealerEditPanel,#dealerModal #dealerEditPanel label{pointer-events:auto!important}
    #dealerModal #dealerEditPanel input,#dealerModal #dealerEditPanel textarea,#dealerModal #dealerEditPanel select,
    #paymentForm input,#paymentForm textarea,#paymentForm select{
      pointer-events:auto!important;user-select:text!important;-webkit-user-select:text!important;cursor:text!important;position:relative;z-index:2
    }
    #dealerModal #dealerEditPanel select,#paymentForm select{cursor:pointer!important}
    .dealerModalCloseX{position:absolute;right:12px;top:10px;z-index:10;width:30px;height:30px;padding:0!important;border-radius:50%!important;background:#eef2f0!important;color:#294039!important;font-size:23px!important;font-weight:500!important;line-height:28px!important;text-align:center!important;box-shadow:none!important}
    .dealerModalCloseX:hover{background:#dfe8e4!important}
  `;
  document.head.appendChild(css);

  const editableSelector='#dealerEditPanel input:not([type="file"]),#dealerEditPanel textarea,#dealerEditPanel select,#paymentForm input:not([type="file"]),#paymentForm textarea,#paymentForm select';

  function armField(el){
    if(!el||!el.matches||!el.matches(editableSelector))return;
    try{
      el.style.pointerEvents='auto';
      el.style.userSelect='text';
      el.style.webkitUserSelect='text';
      el.tabIndex=0;
    }catch(_){ }
  }

  function focusField(el){
    armField(el);
    const attempt=()=>{
      try{
        if(el.closest('#dealerEditPanel')){
          el.removeAttribute('readonly');
          el.disabled=false;
        }
        el.focus({preventScroll:true});
      }catch(_){ }
    };
    attempt();
    requestAnimationFrame(attempt);
    setTimeout(attempt,40);
  }

  // Делегирование работает и для полей, которые создаются динамически после открытия карточки дилера.
  ['pointerdown','mousedown','click'].forEach(type=>{
    document.addEventListener(type,e=>{
      const t=e.target&&e.target.closest?e.target.closest(editableSelector):null;
      if(!t)return;
      armField(t);
      if(type==='pointerdown'||type==='mousedown')setTimeout(()=>focusField(t),0);
    },true);
  });

  const observer=new MutationObserver(records=>{
    records.forEach(r=>r.addedNodes.forEach(node=>{
      if(!(node instanceof Element))return;
      if(node.matches&&node.matches(editableSelector))armField(node);
      node.querySelectorAll?.(editableSelector).forEach(armField);
    }));
    ensureDealerCloseX();
  });
  observer.observe(document.body,{childList:true,subtree:true});

  function ensureDealerCloseX(){
    const box=document.querySelector('#dealerModal .modalBox');
    if(!box||box.querySelector('.dealerModalCloseX'))return;
    const b=document.createElement('button');
    b.type='button';
    b.className='dealerModalCloseX';
    b.title='Закрыть карточку';
    b.setAttribute('aria-label','Закрыть карточку');
    b.textContent='×';
    b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(typeof closeDealerModal==='function')closeDealerModal();else document.getElementById('dealerModal')?.classList.add('hidden')});
    box.appendChild(b);
  }
  ensureDealerCloseX();

  const originalToggleDealerEdit=window.toggleDealerEdit;
  if(typeof originalToggleDealerEdit==='function'){
    window.toggleDealerEdit=function(id,force){
      const r=originalToggleDealerEdit.apply(this,arguments);
      setTimeout(()=>{
        document.querySelectorAll('#dealerEditPanel input:not([type="file"]),#dealerEditPanel textarea,#dealerEditPanel select').forEach(armField);
        const first=document.getElementById('dealerEditName');
        if(first&&!document.getElementById('dealerEditPanel')?.classList.contains('hidden'))focusField(first);
      },20);
      return r;
    };
  }

  // После сохранения карточка дилера сразу закрывается, без повторного открытия той же формы.
  const originalSaveDealerEdit=window.saveDealerEdit;
  if(typeof originalSaveDealerEdit==='function'){
    window.saveDealerEdit=function(id){
      const d=(state.dealers||[]).find(x=>x.id==id);
      const byId=x=>document.getElementById(x);
      if(!d||!byId('dealerEditName'))return originalSaveDealerEdit.apply(this,arguments);
      d.name=byId('dealerEditName').value.trim()||d.name;
      d.phone=byId('dealerEditPhone')?.value.trim()||'';
      d.city=byId('dealerEditCity')?.value.trim()||'';
      d.company=byId('dealerEditCompany')?.value.trim()||'';
      d.fio=byId('dealerEditFio')?.value.trim()||'';
      d.address=byId('dealerEditAddress')?.value.trim()||'';
      d.email=byId('dealerEditEmail')?.value.trim()||'';
      d.www=byId('dealerEditWww')?.value.trim()||'';
      d.clientGroup=byId('dealerEditGroup')?.value.trim()||'';
      d.paymentMethod=byId('dealerEditPay')?.value.trim()||'';
      d.shippingMethod=byId('dealerEditShip')?.value.trim()||'';
      d.note=byId('dealerEditNote')?.value.trim()||'';
      save();
      if(typeof closeDealerModal==='function')closeDealerModal();
      else document.getElementById('dealerModal')?.classList.add('hidden');
    };
  }

  // После успешной оплаты возвращаемся к списку дилеров, чтобы карточка выбранного клиента не оставалась открытой.
  const originalMakePayment=window.makePayment;
  if(typeof originalMakePayment==='function'){
    window.makePayment=function(){
      const before=(state.ops||[]).length;
      const r=originalMakePayment.apply(this,arguments);
      if((state.ops||[]).length>before){
        try{if(typeof clearPayDealer==='function')clearPayDealer()}catch(_){ }
        try{if(typeof closeDealerModal==='function')closeDealerModal()}catch(_){ }
      }
      return r;
    };
  }
})();