(()=>{
 'use strict';
 const records=new WeakMap(),prefix='uchet_table_layout_v1:';
 const selector='main table,#dealerModalBody table,#receiptViewBody table';
 const read=key=>{try{return JSON.parse(localStorage.getItem(prefix+key)||'{}')||{}}catch{return {}}};
 function persist(r){try{localStorage.setItem(prefix+r.key,JSON.stringify({order:r.order,widths:r.widths}))}catch{}}
 const children=row=>Array.from(row.children);
 function move(row,order){
  const map=new Map(children(row).map(cell=>[cell.dataset.colKey,cell]));
  const desired=order.map(k=>map.get(k)).filter(Boolean);
  if(desired.length===row.children.length&&desired.some((cell,i)=>row.children[i]!==cell))for(const cell of desired)row.appendChild(cell);
 }
 function paint(r){
  const {table,head,keys,order,widths}=r;
  move(head,order);
  for(const row of table.tBodies[0]?.rows||[]){
   if(row.cells.length!==keys.length||children(row).some(c=>c.colSpan>1))continue;
   children(row).forEach((cell,i)=>{if(!cell.dataset.colKey)cell.dataset.colKey=keys[i]});
   move(row,order);
  }
  for(const row of [head,...Array.from(table.tBodies[0]?.rows||[])])for(const cell of children(row)){
   const width=widths[cell.dataset.colKey];if(width>=24)for(const prop of ['width','min-width','max-width'])cell.style.setProperty(prop,width+'px','important');
  }
  const total=order.reduce((sum,k)=>sum+widths[k],0);
  if(total>0)table.style.setProperty('width',total+'px','important');
 }
 function reorder(table,order){const r=records.get(table);if(!r||order.length!==r.keys.length||new Set(order).size!==r.keys.length||order.some(k=>!r.keys.includes(k)))return false;r.order=order.slice();persist(r);paint(r);return true}
 function resize(table,key,width){const r=records.get(table);if(!r||!r.keys.includes(key)||!Number.isFinite(width))return false;r.widths[key]=Math.max(24,Math.round(width));persist(r);paint(r);return true}
 function setup(table){
  const head=table.tHead?.rows[0];if(!head||!table.tBodies[0]||head.cells.length<2)return;
  const prior=records.get(table);
  if(prior&&prior.head===head&&prior.headers.every(th=>th.parentElement===head)){paint(prior);return}
  const headers=children(head),keys=headers.map((th,i)=>(th.textContent.trim().replace(/\s+/g,'_')||'Действие')+'_'+i);
  const container=table.closest('[id]'),schema=keys.join('|');
  const key=(table.tBodies[0].id||container?.id||table.closest('section')?.id||'table')+':'+schema;
  const saved=read(key),order=Array.isArray(saved.order)?saved.order.filter(k=>keys.includes(k)):[];
  for(const k of keys)if(!order.includes(k))order.push(k);
  const widths={};headers.forEach((th,i)=>{const n=Number(saved.widths?.[keys[i]]);widths[keys[i]]=n>=24&&Number.isFinite(n)?n:Math.max(70,Math.round(th.getBoundingClientRect().width)||(/Наименование|Товар/.test(keys[i])?280:130))});
  const r={table,head,headers,keys,order,widths,key};records.set(table,r);table.dataset.columnLayout='true';
  // Existing per-screen storage is migrated once; the new stable key does not depend on table index or receipt number.
  if(!Array.isArray(saved.order)&&table.dataset.tableKey){try{const old=JSON.parse(localStorage.getItem('uchet_columns_'+table.dataset.tableKey)||'null');if(Array.isArray(old)&&old.length===keys.length&&old.every(k=>keys.includes(k)))r.order=old;const oldWidths=JSON.parse(localStorage.getItem('uchet_widths_'+table.dataset.tableKey)||'{}');for(const k of keys)if(Number(oldWidths[k])>=24)r.widths[k]=Number(oldWidths[k])}catch{}}
  headers.forEach((th,i)=>{
   const k=keys[i];th.dataset.colKey=k;th.draggable=true;th.title='Перетащите заголовок, чтобы переставить столбец. Потяните правую границу, чтобы изменить ширину.';
   th.addEventListener('dragstart',e=>{if(e.target.closest?.('.colResize')){e.preventDefault();return}th.classList.add('dragging');e.dataTransfer.setData('application/x-uchet-column',key);e.dataTransfer.setData('text/plain',k)});
   th.addEventListener('dragover',e=>{e.preventDefault();th.classList.add('dragOver')});
   th.addEventListener('dragleave',()=>th.classList.remove('dragOver'));
   th.addEventListener('dragend',()=>{th.classList.remove('dragging');headers.forEach(h=>h.classList.remove('dragOver'))});
   th.addEventListener('drop',e=>{e.preventDefault();th.classList.remove('dragOver');if(e.dataTransfer.getData('application/x-uchet-column')!==key)return;const from=e.dataTransfer.getData('text/plain'),a=r.order.indexOf(from),b=r.order.indexOf(k);if(a<0||b<0||a===b)return;const next=r.order.slice();next.splice(a,1);next.splice(b,0,from);reorder(table,next)});
   const handle=document.createElement('span');handle.className='colResize';handle.title='Потяните границу столбца';handle.setAttribute('aria-hidden','true');th.appendChild(handle);
   handle.addEventListener('pointerdown',e=>{
    e.preventDefault();e.stopPropagation();th.draggable=false;document.body.classList.add('resizingCol');const start=e.clientX,width=r.widths[k];
    const move=e=>{r.widths[k]=Math.max(24,Math.round(width+e.clientX-start));paint(r)};
    const finish=()=>{document.removeEventListener('pointermove',move,true);document.removeEventListener('pointerup',finish,true);document.removeEventListener('pointercancel',finish,true);window.removeEventListener('blur',finish);document.body.classList.remove('resizingCol');th.draggable=true;persist(r)};
    document.addEventListener('pointermove',move,true);document.addEventListener('pointerup',finish,true);document.addEventListener('pointercancel',finish,true);window.addEventListener('blur',finish,{once:true});
   });
  });
  paint(r);
 }
 function scan(){document.querySelectorAll('main table').forEach((table,i)=>{if(!table.dataset.tableKey)table.dataset.tableKey=(table.closest('section')?.id||'table')+'_'+i});document.querySelectorAll(selector).forEach(setup)}
 window.tableLayout={scan,reorder,resize,keys:table=>records.get(table)?.keys.slice()||[]};
 let queued=false;
 new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;scan()})}).observe(document.body,{childList:true,subtree:true});
 scan();
})();
