const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../../app/receipt-archive-core.js');

function sampleState(){
  return {
    dealers:[{id:1,name:'Дилер'}],
    products:[],
    receiptStates:{},
    receiptItemStates:{},
    ops:[
      {id:10,ts:10,type:'sale',dealerId:1,dealer:'Дилер',receiptNo:7,total:300,profit:120,items:[
        {article:'A',name:'Товар A',qty:1,price:100,total:100,profit:40},
        {article:'B',name:'Товар B',qty:2,price:100,total:200,profit:80}
      ]},
      {id:20,ts:20,type:'payment',dealerId:1,dealer:'Дилер',total:50,beforeDebt:300,afterDebt:250}
    ]
  };
}

test('deleting one receipt line keeps receipt and recalculates debt',()=>{
  const next=core.deleteItem(sampleState(),10,0,1000);
  const sale=next.ops.find(o=>o.id===10);
  const payment=next.ops.find(o=>o.id===20);
  assert.equal(sale.items.length,1);
  assert.equal(sale.items[0].name,'Товар B');
  assert.equal(sale.total,200);
  assert.equal(payment.beforeDebt,200);
  assert.equal(payment.afterDebt,150);
  assert.equal(Object.values(next.receiptItemStates).filter(e=>e.archived).length,1);
});

test('restoring deleted line restores receipt total and debt exactly once',()=>{
  const deleted=core.deleteItem(sampleState(),10,0,1000);
  const entryKey=Object.keys(deleted.receiptItemStates)[0];
  const restored=core.restoreItem(deleted,entryKey,2000);
  const sale=restored.ops.find(o=>o.id===10);
  const payment=restored.ops.find(o=>o.id===20);
  assert.equal(sale.items.length,2);
  assert.equal(sale.total,300);
  assert.equal(payment.beforeDebt,300);
  assert.equal(payment.afterDebt,250);
  const restoredAgain=core.restoreItem(restored,entryKey,3000);
  assert.equal(restoredAgain.ops.find(o=>o.id===10).items.length,2);
});

test('deleted line tombstone wins when another computer still has stale receipt',()=>{
  const remote=core.deleteItem(sampleState(),10,0,1000);
  const stale=sampleState();
  const merged=core.merge(remote,stale,JSON.parse(JSON.stringify(stale)));
  const sale=merged.ops.find(o=>o.id===10);
  assert.equal(sale.items.length,1);
  assert.equal(sale.total,200);
});

test('single-line receipt requires whole receipt archive instead of line deletion',()=>{
  const state=sampleState();
  state.ops[0].items=[state.ops[0].items[0]];
  state.ops[0].total=100;
  assert.throws(()=>core.deleteItem(state,10,0,1000),/только одна позиция/);
});
