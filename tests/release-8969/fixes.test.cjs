const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

function runtime(){
  const nodes=new Map();
  const document={
    head:{appendChild(){}},documentElement:{dataset:{}},body:{appendChild(){}},
    createElement(){return {style:{},dataset:{},appendChild(){},addEventListener(){},querySelector(){return null},querySelectorAll(){return []}}},
    getElementById(id){return nodes.get(id)||null},querySelector(){return null},querySelectorAll(){return []}
  };
  const localStorage={data:new Map(),setItem(k,v){this.data.set(k,String(v))},getItem(k){return this.data.get(k)||null}};
  const ctx={
    console,document,localStorage,KEY:'k',setTimeout:fn=>{fn();return 1},clearTimeout(){},MutationObserver:class{observe(){}},
    state:{groups:[{id:1,name:'ПОЛОТНО'}],products:[
      {id:11,groupId:1,name:'МАТ-303 ОТ 380-500м ПРЕМИУМ',retailPrice:140,wholesalePrice:140},
      {id:12,groupId:1,name:'МАТ-303  BAUF ДО 360 ( ГЕРМАНИЯ )',retailPrice:135,wholesalePrice:135},
      {id:13,groupId:1,name:'МАТ-303  BAUF 500см ( ГЕРМАНИЯ )',retailPrice:180,wholesalePrice:180},
      {id:14,groupId:1,name:'ЛАК-303 ДО-360 ПРЕМИУМ',retailPrice:130,wholesalePrice:130}
    ],ops:[],sync:{enabled:false,url:''}},
    nmFindRollWidth:data=>data.width,
    nmBuildItems:data=>[{article:'NM-MAT',name:'Полотно',qty:10,price:140,total:1400,source:'NewMatRos'}],
    renderHistory(){},
    window:null
  };
  ctx.window=ctx;
  vm.createContext(ctx);
  vm.runInContext(read('app/release-8969.js'),ctx,{filename:'release-8969.js'});
  return ctx;
}

test('8.9.69 is wired into package and preload',()=>{
  const pkg=JSON.parse(read('app/package.json'));
  assert.equal(pkg.version,'8.9.69');
  assert.ok(pkg.build.files.includes('release-8969.js'));
  const preload=read('app/preload.js');
  assert.match(preload,/release-8969\.js/);
  assert.match(preload,/runtime=8969/);
});

test('BAUF 5m cannot fall through to Premium 140',()=>{
  const c=runtime();
  const items=c.nmBuildItems({width:5,['Заказ']:{'МатериалКаталог':'БЕЛАЯ МАТ-303 BAUF'}});
  const mat=items.find(x=>x.article==='NM-MAT');
  assert.equal(mat.productId,13);
  assert.equal(mat.price,180);
  assert.equal(mat.priceProductName,'МАТ-303  BAUF 500см ( ГЕРМАНИЯ )');
});

test('BAUF narrow and Premium wide keep their own product cards',()=>{
  const c=runtime();
  let mat=c.nmBuildItems({width:2.8,['Заказ']:{'МатериалКаталог':'БЕЛАЯ МАТ-303 BAUF'}})[0];
  assert.equal(mat.productId,12);assert.equal(mat.price,135);
  mat=c.nmBuildItems({width:4.5,['Заказ']:{'МатериалКаталог':'БЕЛАЯ МАТ-303 PREMIUM'}})[0];
  assert.equal(mat.productId,11);assert.equal(mat.price,140);
});

test('NewMatRos reads the current card price on every export',()=>{
  const c=runtime();
  let mat=c.nmBuildItems({width:5,['Заказ']:{'МатериалКаталог':'БЕЛАЯ МАТ-303 BAUF'}})[0];
  assert.equal(mat.price,180);
  c.state.products.find(p=>p.id===13).retailPrice=195;
  mat=c.nmBuildItems({width:5,['Заказ']:{'МатериалКаталог':'БЕЛАЯ МАТ-303 BAUF'}})[0];
  assert.equal(mat.price,195);
});

test('missing BAUF card blocks a wrong generic price',()=>{
  const c=runtime();
  c.state.products=c.state.products.filter(p=>p.id!==13);
  const mat=c.nmBuildItems({width:5,['Заказ']:{'МатериалКаталог':'БЕЛАЯ МАТ-303 BAUF'}})[0];
  assert.equal(mat.price,0);
  assert.match(mat.priceSource,/BAUF/);
});

test('history search, price group move and product sync safeguards are present',()=>{
  const js=read('app/release-8969.js');
  assert.match(js,/historySearch8969/);
  assert.match(js,/№ чека/);
  assert.match(js,/row\.appendChild\(row\.children\[0\]\)/);
  assert.match(js,/p\.updatedAt=now8969\(\)/);
  assert.match(js,/masterSync8962\?\.push/);
});
