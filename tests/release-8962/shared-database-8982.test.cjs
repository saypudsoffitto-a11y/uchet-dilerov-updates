'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const P=require('../../server/master-protocol-8962');
const C=require('../../server/sync-core-8962');
const a={id:'device-a-000000000000',name:'Подключение A'},b={id:'device-b-000000000000',name:'Подключение B'};
const fixture=()=>({revision:10,state:{dealers:[{id:1,name:'Одинаковое имя',phone:'79990000001'}],groups:[],products:[],ops:[]},computers:{shared:true,masterId:null,devices:{}}});
test('shared database accepts documents and catalog changes without any master',()=>{
 let current=fixture();
 const dealer={id:2,name:'Одинаковое имя',phone:''};
 const sale={id:3,type:'sale',dealerId:2,total:50,items:[]};
 const body={protocol:2,action:'changes',device:a,changes:C.diffOps([],[sale]),catalogPatch:{dealers:[{id:'2',before:null,after:dealer}]}};
 current=P.update(current,body);
 assert.equal(current.computers.masterId,null);assert.equal(current.state.dealers.length,2);assert.equal(current.state.ops.length,1);
 current=P.update(current,body);assert.equal(current.state.ops.length,1);
 current=P.update(current,{protocol:2,action:'changes',device:b,changes:[{id:'4',before:null,after:{id:4,type:'payment',dealerId:2,total:10}}]});
 assert.equal(current.state.ops.length,2);assert.equal(current.state.dealers[0].phone,'79990000001');
 assert.throws(()=>P.update(current,{protocol:2,action:'claim',device:a,state:fixture().state}),/равноправны/);
 assert.throws(()=>P.update(current,{protocol:2,action:'transfer',device:a,targetId:b.id}),/нет главного/);
 assert.throws(()=>P.update(current,{protocol:2,action:'changes',device:b,catalog:fixture().state}),/Полная замена/);
});
test('historical receipts of deleted dealers do not block unrelated live documents or resurrect cards',()=>{
 let current=fixture();current.state.deletedDealers={'9':100};
 const historical={id:90,type:'sale',dealerId:9,dealer:'Deleted dealer',ts:50,total:20,items:[]};
 const live={id:91,type:'sale',dealerId:1,total:30,items:[]};
 const body={protocol:2,action:'changes',device:a,changes:C.diffOps([],[historical,live])};
 const next=P.update(current,body);
 assert.equal(next.state.ops.length,2);assert.deepEqual(next.state.dealers,current.state.dealers);
 assert.deepEqual(P.update(next,body).state.ops,next.state.ops,'lost acknowledgement retry is idempotent');
 for(const op of [{...historical,ts:101},{...historical,ts:undefined},{...historical,dealer:''},{...historical,dealerId:10}]){
  assert.throws(()=>P.update(current,{...body,changes:C.diffOps([],[op,live])}),/отсутствует/);
  assert.equal(current.state.ops.length,0,'failed validation must not partially commit');
 }
});
test('upgrading the shared database preserves existing incomplete product cards and stock',()=>{
 const current=fixture();current.state.products=[{id:50,name:'-',article:'legacy',stock:77}];
 const next=P.update(current,{protocol:2,action:'changes',device:a,changes:[],catalogPatch:{dealers:[{id:'2',before:null,after:{id:2,name:'Without phone',phone:''}}]}});
 assert.deepEqual(next.state.products,current.state.products);
 const filtered=C.canonicalize({dealers:[],products:[{id:51,name:'-',article:'invalid new import'}]});
 assert.equal(filtered.products.length,0,'new placeholder imports remain blocked');
});
