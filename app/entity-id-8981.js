(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory;
  else root.nextEntityId=factory(root.crypto,root.localStorage,()=>state);
})(typeof window==='object'?window:globalThis,(crypto,storage,getState)=>{
  'use strict';
  const key='uchet_entity_ids_8981';
  let recent=[];try{recent=JSON.parse(storage.getItem(key)||'[]');}catch(_){}
  const issued=new Set(recent.map(String));
  return ()=>{
    const s=getState(),known=new Set(issued);
    // Existing numeric IDs stay intact, including archived and deleted records.
    for(const field of ['dealers','groups','products','ops'])for(const row of s[field]||[])known.add(String(row.id));
    for(const field of ['deletedDealers','deletedProducts','receiptStates'])for(const id of Object.keys(s[field]||{}))known.add(id);
    for(let attempt=0;attempt<16;attempt++){
      const words=crypto.getRandomValues(new Uint32Array(2));
      // 53 random bits remain exact in legacy numeric handlers and JSON.
      // IDs no longer depend on a PC's clock or another PC's receipt sequence.
      const id=(words[0]&0x1fffff)*0x100000000+words[1];
      if(!id||known.has(String(id)))continue;
      const next=[...recent,id].slice(-4096);
      storage.setItem(key,JSON.stringify(next));
      recent=next;issued.add(String(id));return id;
    }
    throw new Error('Не удалось создать уникальный номер записи. Данные не изменены; повторите сохранение.');
  };
});
