(()=>{
 'use strict';
 const status=op=>['recorded','unrecorded'].includes(op?.journalStatus)?op.journalStatus:null;
 const label=op=>({recorded:'Внесено в журнал',unrecorded:'Не внесено в журнал'})[status(op)]||'Без отметки';
 const rowClass=op=>status(op)==='unrecorded'?' journal-unrecorded':'';
 const hasUnrecorded=dealerId=>(state.ops||[]).some(op=>op.type==='sale'&&String(op.dealerId)===String(dealerId)&&status(op)==='unrecorded');
 function refresh(){
  for(const row of document.querySelectorAll('tr[data-op-id]')){
   const op=(state.ops||[]).find(o=>String(o.id)===row.dataset.opId&&o.type==='sale');if(!op)continue;
   row.classList.remove('journal-recorded','journal-unrecorded');if(status(op)==='unrecorded')row.classList.add('journal-unrecorded');
  }
  for(const row of document.querySelectorAll('#homeDealerRows tr[data-dealer-id]')){
   row.classList.remove('journal-recorded');
   row.classList.toggle('journal-unrecorded',hasUnrecorded(row.dataset.dealerId));
  }
 }
 function set(opId,value){
  if(!['recorded','unrecorded'].includes(value))return false;
  const op=(state.ops||[]).find(o=>String(o.id)===String(opId)&&o.type==='sale');if(!op)return false;
  if(status(op)===value)return true;
  const had=Object.hasOwn(op,'journalStatus'),previous=op.journalStatus;
  op.journalStatus=value;
  try{save()}catch(error){if(had)op.journalStatus=previous;else delete op.journalStatus;refresh();alert('Не удалось сохранить отметку журнала: '+error.message);return false;}
  refresh();return true;
 }
 window.receiptJournal={status,label,rowClass,hasUnrecorded,set,refresh};
 document.addEventListener('DOMContentLoaded',()=>{
  const previous=render;
  render=function(){const result=previous.apply(this,arguments);refresh();return result};
  refresh();
 },{once:true});
})();
