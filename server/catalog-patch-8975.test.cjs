'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('./master-protocol-8962'),C=require('./sync-core-8962');
const master={id:'computer-00000001',name:'Главный'},worker={id:'computer-00000002',name:'Второй'};
const initial=()=>({revision:1,computers:{masterId:master.id,devices:{}},state:{products:[{id:1,name:'BAUF',retailPrice:180,wholesalePrice:170,stock:100}],dealers:[{id:1,name:'Дилер'}],groups:[],ops:[]}});
const write=(s,device,extra)=>P.update(s,{protocol:2,action:'changes',device,...extra});
test('worker price reaches shared catalog; repeat is idempotent and leaves stock intact',()=>{
 const s=initial(),before=C.clone(s.state.products[0]),after={...before,retailPrice:220,wholesalePrice:210,stock:999};
 const extra={catalogPatch:{products:[{id:'1',before,after}],groups:[]}};
 const next=write(s,worker,extra),retry=write(next,worker,extra);
 assert.equal(retry.state.products[0].retailPrice,220);assert.equal(retry.state.products[0].stock,100);assert.equal(s.state.products[0].retailPrice,180);
});
test('master prices are accepted and worker later changes only the intended card',()=>{
 let s=initial(),catalog=C.catalog(s.state);catalog.products[0].retailPrice=250;
 assert.throws(()=>write(s,master,{catalog}),/заменить каталог товаров/);
 const original=C.clone(s.state.products[0]);s=write(s,master,{productChanges:[{id:'1',before:original,after:{...original,retailPrice:250}}]});assert.equal(s.state.products[0].retailPrice,250);
 const before=C.clone(s.state.products[0]);s=write(s,worker,{catalogPatch:{products:[{id:'1',before,after:{...before,wholesalePrice:230}}]}});
 assert.equal(s.state.products[0].retailPrice,250);assert.equal(s.state.products[0].wholesalePrice,230);
});
test('price patch and simultaneous sale preserve transaction stock and payment',()=>{
 const s=initial(),before=C.clone(s.state.products[0]);
 const next=write(s,worker,{changes:[{id:'10',before:null,after:{id:10,type:'sale',dealerId:1,total:220,items:[{productId:1,qty:2}]}},{id:'11',before:null,after:{id:11,type:'payment',dealerId:1,total:100}}],catalogPatch:{products:[{id:'1',before,after:{...before,retailPrice:220}}]}});
 assert.equal(next.state.products[0].stock,98);assert.equal(next.state.products[0].retailPrice,220);assert.equal(next.state.ops.length,2);
});
test('stale price cannot overwrite newer remote value even with a later timestamp',()=>{
 const s=initial(),before=C.clone(s.state.products[0]);s.state.products[0].retailPrice=250;
 assert.throws(()=>write(s,worker,{catalogPatch:{products:[{id:'1',before,after:{...before,retailPrice:220,updatedAt:Date.now()+10000}}]}}),/изменена/);
 assert.equal(s.state.products[0].retailPrice,250);
});
test('deleted products cannot be resurrected and worker cannot replace full catalog',()=>{
 const s=initial(),before=C.clone(s.state.products[0]);s.state.products=[];s.state.deletedProducts={'1':1};
 assert.throws(()=>write(s,worker,{catalogPatch:{products:[{id:'1',before:null,after:before}]}}),/удалён/);
 assert.throws(()=>write(initial(),worker,{catalog:C.catalog(initial().state)}),/главном/);
});
test('any computer can add and edit dealers and groups with checked deltas',()=>{
 let s=initial();
 const dealer={id:9,name:'Новый',phone:'79990000009'},group={id:9,name:'Полотна'};
 s=write(s,worker,{catalogPatch:{products:[],dealers:[{id:'9',before:null,after:dealer}],groupChanges:[{id:'9',before:null,after:group}]}});
 assert.equal(s.state.dealers.length,2);assert.equal(s.state.groups.length,1);
 s=write(s,{id:'computer-00000003',name:'Третий'},{catalogPatch:{products:[],dealers:[{id:'9',before:dealer,after:{...dealer,city:'Махачкала'}}]}});
 assert.equal(s.state.dealers.find(d=>d.id===9).city,'Махачкала');
 assert.throws(()=>write(s,worker,{catalogPatch:{products:[],dealers:[{id:'9',before:dealer,after:{...dealer,city:'Другой'}}]}}),/изменена/);
 assert.throws(()=>write(s,worker,{catalogPatch:{products:[],dealers:[{id:'10',before:null,after:{...dealer,id:10}}]}}),/телефоном/);
});
