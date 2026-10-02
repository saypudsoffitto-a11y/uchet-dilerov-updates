'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../../app/sync-core-8962');

test('8.9.63 canonical sync keeps one dealer for the same normalized name and phone across three PCs',()=>{
  const state={
    dealers:[
      {id:101,name:'Магомед Алиев',phone:'+7 (928) 111-22-33',city:'Махачкала'},
      {id:102,name:' магомед   алиев ',phone:'8 928 111 22 33',company:'ИП Алиев'},
      {id:103,name:'МАГОМЕД АЛИЕВ',phone:'9281112233',note:'третий компьютер'}
    ],
    products:[],groups:[],
    ops:[
      {id:201,dealerId:101,type:'sale',total:100,date:'test 1',items:[]},
      {id:202,dealerId:102,type:'payment',total:20,date:'test 2'},
      {id:203,dealerId:103,type:'initial_debt',total:50,date:'test 3'}
    ],
    deletedDealers:{},deletedProducts:{},dealerAliases:{},productAliases:{},catalogDeletedKeys:{}
  };
  const saved=C.canonicalize(state);
  assert.equal(saved.dealers.length,1,JSON.stringify(saved.dealers));
  const canonicalId=String(saved.dealers[0].id);
  assert.equal(saved.ops.length,3);
  assert.equal(saved.ops.every(o=>String(o.dealerId)===canonicalId),true,JSON.stringify(saved.ops));
  assert.equal(Object.keys(saved.dealerAliases||{}).length,2);
  assert.equal(Object.values(saved.dealerAliases||{}).every(v=>String(v)===canonicalId),true);
  assert.equal(Object.keys(saved.deletedDealers||{}).filter(id=>id!==canonicalId).length>=2,true);
  assert.equal(saved.dealers[0].city,'Махачкала');
  assert.equal(saved.dealers[0].company,'ИП Алиев');
  assert.equal(saved.dealers[0].note,'третий компьютер');
});
