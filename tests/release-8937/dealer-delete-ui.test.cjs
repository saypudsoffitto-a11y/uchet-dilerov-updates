'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const repoRoot=path.resolve(__dirname,'../..');
const appDir=path.join(repoRoot,'app');

function boot(){
  const source=fs.readFileSync(path.join(appDir,'dealer-delete-8937.js'),'utf8');
  const base=Date.now()-100000;
  const keepId=base,deleteId=base+1;
  const name='Одинаковый дилер';
  const phone='+7 999 111-22-33';
  const state={
    dealers:[
      {id:keepId,name,phone,city:'Оставить'},
      {id:deleteId,name,phone,city:'Удалить'}
    ],
    ops:[{id:base+10,dealerId:deleteId,type:'sale',total:500}],
    groups:[],products:[],receiptSeq:1,
    sync:{enabled:false,url:''},newmatros:{},update:{},
    deletedDealerKeys:{['p:79991112233']:Date.now()-5000}
  };
  const storage=new Map();
  const confirms=[];
  let lastMenu=null;
  let intervalFn=null;
  const localStorage={
    setItem:(k,v)=>storage.set(k,String(v)),
    getItem:k=>storage.has(k)?storage.get(k):null
  };
  const makeButton=()=>({type:'button',textContent:'',className:'',onclick:null,remove(){}});
  const document={
    documentElement:{dataset:{}},
    getElementById:()=>null,
    createElement:tag=>tag==='button'?makeButton():{
      id:'',className:'',style:{},children:[],
      append(...els){this.children.push(...els)},
      remove(){},
      querySelectorAll(){return this.children}
    },
    body:{appendChild:m=>{lastMenu=m}}
  };
  const ctx={
    console,state,KEY:'uchet_dilerov_v8',localStorage,document,
    window:{innerWidth:1200,innerHeight:800},
    norm:x=>{x=x||{};x.dealers=x.dealers||[];x.ops=x.ops||[];x.groups=x.groups||[];x.products=x.products||[];return x},
    confirm:msg=>{confirms.push(msg);return true},
    alert:()=>{},
    renderDealers:()=>{},renderDebts:()=>{},closeDealerModal:()=>{},
    save:()=>localStorage.setItem('uchet_dilerov_v8',JSON.stringify(state)),
    setTimeout:fn=>{fn();return 1},
    setInterval:fn=>{intervalFn=fn;return 1},
    clearInterval:()=>{},
    mergeSyncState:(remote,local)=>({
      ...remote,
      dealers:[...(remote.dealers||[]),...(local.dealers||[])],
      ops:[...(remote.ops||[]),...(local.ops||[])],
      deletedDealerKeys:{...(remote.deletedDealerKeys||{}),...(local.deletedDealerKeys||{})}
    })
  };
  vm.createContext(ctx);
  vm.runInContext(source,ctx,{filename:'dealer-delete-8937.js'});
  assert.equal(typeof intervalFn,'function');
  intervalFn();
  return {ctx,state,keepId,deleteId,name,phone,confirms,storage,getMenu:()=>lastMenu};
}

test('8.9.37 context menu deletes only selected duplicate and preserves its history',()=>{
  const {ctx,state,keepId,deleteId,name,confirms,getMenu}=boot();
  assert.equal(ctx.window.__dealerDelete8937Installed,true);
  assert.equal(ctx.document.documentElement.dataset.dealerFix,'8.9.37');
  assert.equal(Object.keys(state.deletedDealerKeys||{}).length,0,'legacy phone/name tombstones must be disabled for duplicates');

  ctx.window.showDealerContextMenu({preventDefault(){},stopPropagation(){},clientX:50,clientY:50},deleteId);
  const menu=getMenu();
  assert.ok(menu,'dealer context menu must be created');
  const del=menu.children.find(b=>b.textContent==='Удалить дилера');
  assert.ok(del,'delete button must exist in real context menu');
  del.onclick();

  assert.equal(confirms.length,2);
  assert.equal(state.dealers.some(d=>d.id===deleteId),false,'selected duplicate must be removed');
  assert.equal(state.dealers.some(d=>d.id===keepId),true,'other duplicate must remain');
  assert.equal(state.ops.length,1,'old history must remain');
  assert.equal(state.ops[0].dealer,name,'history must receive dealer snapshot');
  assert.ok(state.deletedDealers[String(deleteId)],'exact dealer ID tombstone must be stored');

  const persisted=JSON.parse(ctx.localStorage.getItem('uchet_dilerov_v8'));
  assert.equal(persisted.dealers.some(d=>d.id===deleteId),false);
  assert.equal(persisted.dealers.some(d=>d.id===keepId),true);
});

test('8.9.37 exact-ID tombstone blocks sync resurrection even with a newer remote timestamp',()=>{
  const {ctx,state,keepId,deleteId,name,phone}=boot();
  assert.equal(ctx.window.deleteDealerPermanent8937(deleteId),true);
  const local=JSON.parse(JSON.stringify(state));
  const remote={
    dealers:[{id:deleteId,name,phone,updatedAt:Date.now()+3600000}],
    ops:[],groups:[],products:[],deletedDealers:{},
    deletedDealerKeys:{['p:79991112233']:Date.now()+3600000}
  };
  const merged=ctx.window.mergeSyncState(remote,local);
  assert.equal(merged.dealers.some(d=>d.id===deleteId),false,'deleted exact ID must never return');
  assert.equal(merged.dealers.some(d=>d.id===keepId),true,'duplicate that user kept must survive');
  assert.equal(Object.keys(merged.deletedDealerKeys||{}).length,0,'legacy identity tombstones must not remove the kept duplicate');
});

test('8.9.37 dealer deletion fix remains packaged and reachable in later releases',()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(appDir,'package.json'),'utf8'));
  const version=String(pkg.version||'0.0.0').split('.').map(Number);
  assert.ok(version[0]>8 || (version[0]===8 && (version[1]>9 || (version[1]===9 && version[2]>=37))),'package must be 8.9.37 or newer');
  for(const file of ['main-8937.js','release-8937-main.js','dealer-delete-8937.js'])assert.ok(pkg.build.files.includes(file),file+' must be packaged');
  const main8937=fs.readFileSync(path.join(appDir,'main-8937.js'),'utf8');
  assert.match(main8937,/release-8937-main\.js/);
  const loader=fs.readFileSync(path.join(appDir,'release-8937-main.js'),'utf8');
  assert.match(loader,/dealer-delete-8937\.js/);

  let cursor=pkg.main;
  const seen=new Set();
  let reaches8937=false;
  for(let depth=0;depth<8&&cursor&&!seen.has(cursor);depth++){
    seen.add(cursor);
    if(cursor==='main-8937.js'){reaches8937=true;break}
    const src=fs.readFileSync(path.join(appDir,cursor),'utf8');
    const m=src.match(/require\(['"]\.\/(main-\d+\.js)['"]\)/g);
    if(!m||!m.length)break;
    const last=m[m.length-1].match(/main-\d+\.js/);
    cursor=last&&last[0];
  }
  assert.ok(reaches8937,'newer entrypoint chain must eventually retain main-8937.js');
});
