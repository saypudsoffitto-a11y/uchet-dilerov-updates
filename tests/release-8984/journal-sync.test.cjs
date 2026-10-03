'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../../app/sync-core-8962'),P=require('../../server/master-protocol-8962');
const receipt={id:11,type:'sale',dealerId:1,total:120,profit:50,receiptNo:1,items:[{productId:1,qty:1,price:120,buyPrice:70,total:120,profit:50}]};
const state=()=>({dealers:[{id:1,name:'Test'}],products:[{id:1,name:'Product',stock:99,inventoryVersion:2,warehouseOpening:100}],groups:[],ops:[C.clone(receipt)]});
const device={id:'journal-client-00000001',name:'Journal client'};
test('journal uses the existing persistent operation protocol; retries never alter money or stock',()=>{
 const s=state(),marked={...receipt,journalStatus:'unrecorded'};
 let store={state:s,revision:1,computers:{shared:true,devices:{}}};
 const send=status=>({protocol:2,action:'changes',device,inventoryProtocol:2,changes:[{id:'11',before:C.clone(store.state.ops[0]),after:{...store.state.ops[0],journalStatus:status}}]});
 const body=send('unrecorded');store=P.update(store,body);store=P.update(store,body);
 assert.deepEqual(store.state.ops,[marked]);assert.equal(store.state.products[0].stock,99);
 store=P.update(store,send('recorded'));
 const reloaded=JSON.parse(JSON.stringify(store));assert.equal(reloaded.state.ops[0].journalStatus,'recorded');
 assert.deepEqual({...reloaded.state.ops[0],journalStatus:undefined},{...receipt,journalStatus:undefined});
});
test('independent journal and receipt edits rebase safely in both directions',()=>{
 const edited={...receipt,total:240,items:[{...receipt.items[0],qty:2,total:240}]},marked={...receipt,journalStatus:'recorded'};
 for(const [current,after] of [[edited,marked],[marked,edited]]){
  const s={...state(),ops:[current]},changes=C.rebaseJournalChanges(s,[{id:'11',before:receipt,after}]);
  const merged=P.update({state:s,revision:1,computers:{shared:true,devices:{}}},{protocol:2,action:'changes',device,changes}).state;
  assert.equal(merged.ops[0].journalStatus,'recorded');assert.equal(merged.ops[0].total,240);assert.equal(merged.ops[0].items[0].qty,2);
 }
});
test('conflicting journal choices and concurrent money edits cannot overwrite each other',()=>{
 const base={...receipt,journalStatus:'unrecorded'},current={...base,journalStatus:'recorded'},after={...base,journalStatus:undefined};
 const s={...state(),ops:[current]};
 assert.throws(()=>C.applyTransaction(s,C.rebaseJournalChanges(s,[{id:'11',before:base,after}])),/изменена/);
 const money={...receipt,total:130},other={...receipt,total:140};
 assert.throws(()=>C.applyTransaction({...s,ops:[money]},C.rebaseJournalChanges({...s,ops:[money]},[{id:'11',before:receipt,after:other}])),/изменена/);
 assert.throws(()=>C.applyTransaction(s,C.rebaseJournalChanges(s,[{id:'11',before:base,after:null}])),/изменена/);
});
test('archive and restore preserve the journal field as part of the original receipt',()=>{
 const archive=require('../../app/receipt-archive-core');const s=state();s.ops[0].journalStatus='recorded';
 const op=C.clone(s.ops[0]);s.receiptStates={'11':{receipt:op,archived:true,version:1,at:1,stockQuantities:{'1':1}}};archive.apply(s);assert.equal(s.ops.length,0);
 s.receiptStates['11']={...s.receiptStates['11'],archived:false,version:2,at:2};archive.apply(s);assert.equal(s.ops[0].journalStatus,'recorded');assert.equal(s.ops[0].total,120);
});
