'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function makeContext(){
  const store=new Map();
  const nodes={
    nmDraftOpen8926:{click(){nodes.openClicks=(nodes.openClicks||0)+1}},
    nmStatus:{textContent:''},
    dealerModal:{classList:{contains(){return true}}}
  };
  const document={
    documentElement:{dataset:{}},
    head:{appendChild(){}},
    body:{appendChild(){}},
    addEventListener(){},
    getElementById(id){return nodes[id]||null},
    querySelector(){return null},
    querySelectorAll(){return []},
    createElement(tag){
      if(tag==='style')return {id:'',textContent:''};
      if(tag==='template')return {innerHTML:'',content:{firstElementChild:null}};
      return {append(){},appendChild(){},querySelector(){return null},querySelectorAll(){return []},classList:{add(){},remove(){},contains(){return false}},dataset:{},style:{},setAttribute(){}};
    }
  };
  const context={
    window:null,globalThis:null,console,JSON,Math,Date,Number,String,Object,Array,
    document,
    MutationObserver:class{constructor(fn){this.fn=fn}observe(){}},
    setInterval(fn){fn();return 1},clearInterval(){},setTimeout(fn){fn();return 1},clearTimeout(){},
    addEventListener(){},
    innerWidth:1200,innerHeight:800,
    localStorage:{
      getItem(k){return store.has(k)?store.get(k):null},
      setItem(k,v){store.set(k,String(v))},
      removeItem(k){store.delete(k)},
      key(i){return [...store.keys()][i]||null},
      get length(){return store.size}
    },
    state:{
      products:[{id:1,name:'МАТ-303-2 360 PREMIUM',article:'00005',unit:'м²',buyPrice:40,retailPrice:105,wholesalePrice:100,stock:100}],
      ops:[],receiptStates:{},sync:{enabled:false}
    },
    cart:[],saleProduct:{value:'1'},salePrice:{value:'105'},
    renderCart(){context.renderCartCalls=(context.renderCartCalls||0)+1},
    renderReceiptHtml(){return '<div></div>'},
    render(){},save(){context.saved=(context.saved||0)+1},
    refreshReceiptViews(){context.refreshed=(context.refreshed||0)+1},
    openDealer(){context.openedDealer=(context.openedDealer||0)+1},
    showReceiptFromHistory(){context.openedReceipt=(context.openedReceipt||0)+1},
    archiveReceipt(){context.archivedReceipt=(context.archivedReceipt||0)+1},
    alert(msg){context.lastAlert=String(msg)},
    confirm(){return true},
    money(n){return String(n)},
    syncApplying:false,syncSaveTimer:null,
    parseSemicolonCsv:null,ensureGroupByName:null
  };
  context.window=context;context.globalThis=context;context.nodes=nodes;context.store=store;
  return context;
}

function load(context){
  const source=fs.readFileSync(path.resolve(__dirname,'../../app/release-8947.js'),'utf8');
  vm.createContext(context);
  vm.runInContext(source,context);
}

test('same product is added as a new sale line every time',()=>{
  const c=makeContext();load(c);
  c.addToCart(6.5);c.addToCart(2);c.addToCart(5);
  assert.equal(c.cart.length,3);
  assert.deepEqual(c.cart.map(x=>x.qty),[6.5,2,5]);
  assert.equal(c.cart.reduce((s,x)=>s+x.qty,0),13.5);
  assert.notEqual(c.cart[0].lineId,c.cart[1].lineId);
});

test('one item can be removed from a receipt without deleting the receipt',()=>{
  const c=makeContext();
  c.state.ops=[{id:10,type:'sale',dealerId:7,receiptNo:3,total:300,profit:90,items:[
    {name:'A',qty:1,unit:'шт',price:100,total:100,profit:30},
    {name:'B',qty:2,unit:'шт',price:100,total:200,profit:60}
  ]}];
  load(c);
  c.removeReceiptItem8947(10,0);
  assert.equal(c.state.ops.length,1,'receipt itself remains');
  assert.equal(c.state.ops[0].items.length,1);
  assert.equal(c.state.ops[0].items[0].name,'B');
  assert.equal(c.state.ops[0].total,200);
  assert.equal(c.state.ops[0].profit,60);
  assert.ok(c.saved>0);
});

test('one NewMatRos ceiling can be removed from an open multi-ceiling draft',()=>{
  const c=makeContext();load(c);
  const key='uchetNewMatRosOpenSale8926';
  c.localStorage.setItem(key,JSON.stringify({dealerName:'Дилер',ceilings:[
    {key:'c1',ceilingIndex:'19208',area:9.6},
    {key:'c2',ceilingIndex:'19209',area:4.1}
  ]}));
  c.removeNewMatRosCeiling8947('c1',0);
  const draft=JSON.parse(c.localStorage.getItem(key));
  assert.equal(draft.ceilings.length,1);
  assert.equal(draft.ceilings[0].key,'c2');
  assert.equal(c.nodes.openClicks,1);
  assert.match(c.nodes.nmStatus.textContent,/удалён/i);
  const backup=[...c.store.keys()].find(k=>k.startsWith(key+'-removed-8947-'));
  assert.ok(backup,'removed ceiling gets a recovery backup');
});
