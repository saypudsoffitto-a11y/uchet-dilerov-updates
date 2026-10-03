'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function harness(){
 const row=dataset=>{const classes=new Set(['clickable']);return {dataset,classList:{add:x=>classes.add(x),remove:(...xs)=>xs.forEach(x=>classes.delete(x)),toggle:(x,on)=>on?classes.add(x):classes.delete(x),contains:x=>classes.has(x)}}};
 const receipts=[row({opId:'11'}),row({opId:'12'}),row({opId:'13'})],dealers=[row({dealerId:'1'}),row({dealerId:'2'})];
 let saved,fail=false;const alerts=[];
 const ctx={window:null,state:{ops:[{id:11,type:'sale',dealerId:1,total:120},{id:12,type:'sale',dealerId:'1',total:240},{id:13,type:'sale',dealerId:2,total:60},{id:14,type:'payment',dealerId:2,journalStatus:'unrecorded',total:10}]},document:{querySelectorAll:s=>s.startsWith('#home')?dealers:receipts,addEventListener(){}},save(){if(fail)throw Error('disk full');saved=JSON.stringify(ctx.state)},alert:s=>alerts.push(s)};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(require.resolve('../../app/receipt-journal.js'),'utf8'),ctx);
 return {ctx,api:ctx.receiptJournal,receipts,dealers,alerts,persisted:()=>JSON.parse(saved),fail:()=>{fail=true}};
}
test('manual marks affect only the selected receipt and dealer; last outstanding receipt clears home highlight',()=>{
 const h=harness();h.api.refresh();assert.ok(h.receipts.concat(h.dealers).every(r=>!r.classList.contains('journal-unrecorded')));assert.equal(h.ctx.state.ops[0].journalStatus,undefined);
 assert.equal(h.api.set(11,'unrecorded'),true);assert.equal(h.receipts[0].classList.contains('journal-unrecorded'),true);assert.equal(h.receipts[1].classList.contains('journal-unrecorded'),false);assert.equal(h.dealers[0].classList.contains('journal-unrecorded'),true);assert.equal(h.dealers[1].classList.contains('journal-unrecorded'),false);
 h.api.set(12,'unrecorded');h.api.set(11,'recorded');assert.equal(h.receipts[0].classList.contains('journal-unrecorded'),false);assert.equal(h.receipts[0].classList.contains('journal-recorded'),false);assert.equal(h.dealers[0].classList.contains('journal-unrecorded'),true);
 h.api.set(12,'recorded');assert.ok(h.receipts.concat(h.dealers).every(r=>!r.classList.contains('journal-unrecorded')&&!r.classList.contains('journal-recorded')));assert.equal(h.api.rowClass(h.ctx.state.ops[0]),'');assert.equal(h.persisted().ops[1].journalStatus,'recorded');assert.equal(h.persisted().ops[0].total,120);
});
test('synced receipt changes and archive removal update derived dealer flags without persisting a separate dealer flag',()=>{
 const h=harness();h.ctx.state.ops[0].journalStatus='unrecorded';h.ctx.state.ops[2].journalStatus='unrecorded';h.api.refresh();assert.ok(h.dealers.every(r=>r.classList.contains('journal-unrecorded')));
 h.ctx.state.ops=h.ctx.state.ops.filter(o=>o.id!==11);h.api.refresh();assert.equal(h.dealers[0].classList.contains('journal-unrecorded'),false);assert.equal(h.dealers[1].classList.contains('journal-unrecorded'),true);
 h.ctx.state.ops.find(o=>o.id===13).journalStatus='recorded';h.api.refresh();assert.ok(h.dealers.every(r=>!r.classList.contains('journal-unrecorded')));
});
test('failed persistence restores the previous manual status and row colors; payment and unknown IDs are rejected',()=>{
 const h=harness();h.api.set(11,'unrecorded');h.fail();assert.equal(h.api.set(11,'recorded'),false);assert.equal(h.ctx.state.ops[0].journalStatus,'unrecorded');assert.equal(h.receipts[0].classList.contains('journal-unrecorded'),true);assert.equal(h.dealers[0].classList.contains('journal-unrecorded'),true);assert.equal(h.api.set(12,'unrecorded'),false);assert.equal(Object.hasOwn(h.ctx.state.ops[1],'journalStatus'),false);assert.equal(h.api.set(14,'recorded'),false);assert.equal(h.api.set(999,'unrecorded'),false);assert.equal(h.api.set(11,'invalid'),false);assert.equal(h.alerts.length,2);
});
