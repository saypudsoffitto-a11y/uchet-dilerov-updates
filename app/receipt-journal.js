(()=>{
 'use strict';
 const status=op=>['recorded','unrecorded'].includes(op?.journalStatus)?op.journalStatus:null;
 const label=op=>({recorded:'Внесено в журнал',unrecorded:'Не внесено в журнал'})[status(op)]||'Без отметки';
 const rowClass=op=>status(op)?' journal-'+status(op):'';
 const cell=op=>'<td class="journalValue">'+label(op)+'</td>';
 function refresh(){
  for(const row of document.querySelectorAll('tr[data-op-id]')){
   const op=(state.ops||[]).find(o=>String(o.id)===row.dataset.opId&&o.type==='sale');if(!op)continue;
   row.classList.remove('journal-recorded','journal-unrecorded');if(status(op))row.classList.add('journal-'+status(op));
   const value=row.querySelector('.journalValue');if(value)value.textContent=label(op);
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
 window.receiptJournal={status,label,rowClass,cell,set,refresh};
 document.addEventListener('DOMContentLoaded',()=>{
  const previous=render;
  render=function(){const result=previous.apply(this,arguments);refresh();return result};
  refresh();
 },{once:true});
})();
