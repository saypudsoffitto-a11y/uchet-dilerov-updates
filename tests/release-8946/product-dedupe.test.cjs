'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

test('duplicate product cards merge into one and historical links follow the canonical product',()=>{
  const source=fs.readFileSync(path.resolve(__dirname,'../../app/data-fix-8941.js'),'utf8');
  const state={
    groups:[{id:1,name:'Платформы'}],
    products:[
      {id:101,groupId:1,name:'Кольцо',article:'K-1',stock:10,retailPrice:50,wholesalePrice:40,updatedAt:1000},
      {id:202,groupId:1,name:' Кольцо ',article:'K-1',stock:11,retailPrice:55,wholesalePrice:45,updatedAt:2000},
      {id:303,groupId:1,name:'Кольцо',article:'K-1',stock:12,retailPrice:60,wholesalePrice:50,updatedAt:1500},
      {id:404,groupId:1,name:'Другой товар',article:'D-1'}
    ],
    ops:[{id:1,type:'sale',items:[{productId:101,name:'Кольцо'}]}],
    receiptStates:{archived:{receipt:{items:[{productId:303,name:'Кольцо'}]}}},
    deletedProducts:{}
  };
  let scheduled=null;
  const context={
    window:null,state,KEY:'test',cart:[],
    save(){},render(){},norm:x=>x,alert(){},addGroup(){},
    mergeSyncState(remote){return remote},
    localStorage:{setItem(){},getItem(){return null}},
    document:{documentElement:{dataset:{}}},
    setInterval(fn){scheduled=fn;return 1},clearInterval(){},
    Date,Math,JSON,console
  };
  context.window=context;
  vm.createContext(context);
  vm.runInContext(source,context);
  assert.equal(typeof scheduled,'function');
  scheduled();

  const rings=state.products.filter(p=>String(p.article).trim()==='K-1');
  assert.equal(rings.length,1);
  const canonicalId=rings[0].id;
  assert.equal(rings[0].retailPrice,55,'the newest duplicate donates current card data without multiplying stock');
  assert.equal(state.ops[0].items[0].productId,canonicalId);
  assert.equal(state.receiptStates.archived.receipt.items[0].productId,canonicalId);
  for(const id of [101,202,303])if(id!==canonicalId)assert.ok(state.deletedProducts[String(id)]>0,'removed duplicate '+id+' gets a sync tombstone');
  assert.equal(context.document.documentElement.dataset.productDedupe,'8.9.46');
});
