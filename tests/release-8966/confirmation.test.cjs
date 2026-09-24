const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../../app/master-sync-8962.js'),'utf8');
for(const name of ['claim','transfer']){
  for(const choice of ['cancel','error','accept']){
    test(`${name}: ${choice} confirmation controls role mutation`,async()=>{
      const start=source.indexOf(`async function ${name}(){`);
      assert.ok(start>=0,`${name} function must exist`);
      const end=source.indexOf(name==='claim'?'async function transfer(){':'const host=',start);
      const calls=[];
      const context={busy:false,meta:name==='claim'?{}:{masterId:'me',devices:{other:{name:'Other'}}},device:{id:'me',name:'Main'},state:{dealers:[],products:[]},
        document:{getElementById:()=>({value:'other'})},
        confirm:()=>{if(choice==='error')throw new Error('dialog unavailable');return choice==='accept';},
        status:()=>{},alert:()=>{},backup:async()=>{calls.push('backup');},push:async()=>true,
        request:async(method,body)=>{if(method==='PUT')calls.push(body.action);return {revision:1};},
        localStorage:{removeItem:()=>{}},key:()=>'',accept:()=>{},pending:()=>[],readBaseline:()=>({state:{}}),baseline:()=>({state:{}}),C:{clone:x=>x,diffArchives:()=>[]}};
      vm.createContext(context);
      await vm.runInContext(source.slice(start,end)+`;${name}()`,context);
      assert.equal(calls.includes(name),choice==='accept');
      if(name==='claim')assert.equal(calls.includes('backup'),choice==='accept');
      assert.equal(context.busy,false);
    });
  }
}
