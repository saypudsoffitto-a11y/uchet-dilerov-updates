'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const create=require('../../app/entity-id-8981');
const store=()=>{const data=new Map();return {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)}};
test('three PCs generate exact distinct numeric IDs independently of identical clocks',()=>{
 const ids=new Set();
 for(let pc=0;pc<3;pc++){
  const next=create(crypto.webcrypto,store(),()=>({}));
  for(let i=0;i<3000;i++){const id=next();assert.ok(Number.isSafeInteger(id)&&id>0);assert.equal(JSON.parse(JSON.stringify(id)),id);assert.ok(!ids.has(id));ids.add(id);}
 }
 assert.equal(ids.size,9000);
});
test('restart preserves reservations and imported, archived and deleted IDs are never reissued',()=>{
 const storage=store(),state={dealers:[{id:2}],ops:[{id:3}],receiptStates:{4:{}},deletedProducts:{5:1}};
 let values=[2,3,4,5,6],source={getRandomValues:a=>{a[0]=0;a[1]=values.shift();return a}};
 assert.equal(create(source,storage,()=>state)(),6);
 values=[6,7];assert.equal(create(source,storage,()=>state)(),7);
 assert.deepEqual(state.dealers,[{id:2}]);
});
test('failed ID persistence prevents creation rather than falling back to the clock',()=>{
 const storage={getItem:()=>null,setItem:()=>{throw Error('Disk full')}};
 const next=create({getRandomValues:a=>{a[0]=1;a[1]=1;return a}},storage,()=>({}));
 assert.throws(next,/Disk full/);
});
