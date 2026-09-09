(()=>{
  if(window.__uchetRuntime8924)return;
  window.__uchetRuntime8924=true;

  // Core NewMatRos dealer matcher. It is loaded before the review runtime.
  if(typeof window.nmFindDealer!=='function'){
    window.nmFindDealer=function(data){
      const z=data?.['Заказ']||{};
      const c=data?.['Контрагент']||{};
      const digits=v=>String(v||'').replace(/\D/g,'').replace(/^8(?=\d{10}$)/,'7');
      const text=v=>String(v||'').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/gi,' ').replace(/\s+/g,' ').trim();
      const rawPhone=String(c['Телефон']||c['ТелефонМобильный']||c['МобильныйТелефон']||c['Мобильный']||z['Телефон']||'').trim();
      const phone=digits(rawPhone);
      const names=[c['Наименование'],c['ФИО'],c['Компания'],c['Контрагент'],z['Контрагент'],z['НаименованиеКонтрагента']].map(v=>String(v||'').trim()).filter(Boolean);
      const primaryName=names[0]||'Дилер NewMatRos';
      const wantedNames=[...new Set(names.map(text).filter(Boolean))];
      const dealers=(typeof state!=='undefined'&&Array.isArray(state.dealers))?state.dealers:[];
      let dealer=null;
      if(phone)dealer=dealers.find(d=>digits(d.phone)===phone)||null;
      if(!dealer&&wantedNames.length){
        dealer=dealers.find(d=>{
          const own=[d.name,d.company,d.fio].map(text).filter(Boolean);
          return wantedNames.some(n=>own.includes(n));
        })||null;
      }
      if(!dealer&&wantedNames.length){
        const fuzzy=dealers.filter(d=>{
          const own=[d.name,d.company,d.fio].map(text).filter(Boolean);
          return wantedNames.some(n=>n.length>=4&&own.some(o=>o.length>=4&&(o.includes(n)||n.includes(o))));
        });
        if(fuzzy.length===1)dealer=fuzzy[0];
      }
      return {dealer,name:dealer?.name||primaryName,rawPhone};
    };
  }

  const old=document.getElementById('runtime8921Badge');
  if(old)old.textContent='исправления 8.9.25 активны';
  document.documentElement.dataset.uchetRuntime='8.9.25';
})();
