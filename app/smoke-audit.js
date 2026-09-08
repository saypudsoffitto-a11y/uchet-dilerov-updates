const fs=require('fs');
const path=require('path');
const vm=require('vm');

const root=__dirname;
const read=n=>fs.readFileSync(path.join(root,n),'utf8');
const must=(ok,msg)=>{if(!ok)throw new Error(msg)};

const pkg=JSON.parse(read('package.json'));
const preload=read('preload.js');
const index=read('index.html');
const r22=read('runtime-fixes-8922.js');
const r24=read('runtime-fixes-8924.js');
const r26=read('runtime-fixes-8926.js');
const finalFix=read('final-fixes-8917.js');
const productsCsv=fs.readFileSync(path.join(root,'tovar.csv'));

must(pkg.version==='8.9.26','package version must be 8.9.26');
must(preload.includes('setIniHandler'),'exclusive NewMatRos handler API missing');
must(preload.includes('loadBundledNewMatRosClients'),'NewMatRos clients API alias missing');
must(index.includes('loadBundledNewMatRosClients'),'index expects NewMatRos clients API alias');
must(!r22.includes('newmatrosAPI?.onIni'),'obsolete NewMatRos listener still exists in speech runtime');
must(preload.includes("'./runtime-fixes-8926.js'"),'8.9.26 runtime not loaded');
must(!preload.includes("'./runtime-fixes-8923.js'"),'old single-ceiling review runtime must not load in 8.9.26');
must(r26.includes("DRAFT_KEY='uchetNewMatRosOpenSale8926'"),'persistent open-sale draft missing');
must(r26.includes('newmatrosAPI?.setIniHandler')&&r26.includes('setIniHandler(addCeiling)'),'multi-ceiling runtime is not authoritative INI handler');
must(r26.includes('d.ceilings.push(ceil)'),'new ceilings are not accumulated into open sale');
must(r26.includes('sameDealer(d,ceil)'),'dealer guard missing: different clients could be mixed');
must(r26.includes('alreadyImported(ceil.key)')&&r26.includes('some(x=>x.key===ceil.key)'),'duplicate ceiling protection missing');
must(r26.includes('Закрыть и оформить продажу'),'explicit close-sale action missing');
must(r26.includes('newmatrosKeys')&&r26.includes('newmatrosCeilings'),'final receipt does not retain all ceiling keys/details');
must(r26.includes("name:'Потолок '+(idx+1)+' · '"),'receipt items are not labelled by ceiling');
must(r26.includes('saveDraft(null)'),'open sale is not cleared after final posting');
must(r26.includes('showReceiptFromHistory(op.id)'),'final combined receipt is not opened');
must((r26.match(/state\.ops\.push\(/g)||[]).length===1,'sale must be posted only once, on close');
must(r24.includes('window.nmFindDealer'),'dealer matcher missing');

const corePos=preload.indexOf("'./runtime-fixes-8924.js'");
const draftPos=preload.indexOf("'./runtime-fixes-8926.js'");
must(corePos>=0&&draftPos>=0&&corePos<draftPos,'dealer matcher must load before multi-ceiling runtime');

const dealerCtx={
  window:{},
  document:{getElementById:()=>null,documentElement:{dataset:{}}},
  state:{dealers:[
    {id:1,name:'АБДУРАХМАН МАХАН',phone:'8 988 424-81-81',company:'',fio:''},
    {id:2,name:'КАРЧИГА',phone:'',company:'КАРЧИГА ПОТОЛКИ',fio:''}
  ]},
  console
};
vm.createContext(dealerCtx);
vm.runInContext(r24,dealerCtx);
must(typeof dealerCtx.window.nmFindDealer==='function','nmFindDealer did not initialize');
let hit=dealerCtx.window.nmFindDealer({'Контрагент':{'Телефон':'+7 988 424 81 81','Наименование':'Другое имя'},'Заказ':{}});
must(hit.dealer&&hit.dealer.id===1,'dealer matcher failed phone normalization');
hit=dealerCtx.window.nmFindDealer({'Контрагент':{'Наименование':'КАРЧИГА'},'Заказ':{}});
must(hit.dealer&&hit.dealer.id===2,'dealer matcher failed name match');

const filmProducts=[
  {id:5,name:'МАТ-303 ДО 360 ПРЕМИУМ',groupId:1,retailPrice:105,wholesalePrice:105,archived:false},
  {id:6,name:'МАТ-303 ОТ 380-500м ПРЕМИУМ',groupId:1,retailPrice:140,wholesalePrice:140,archived:false},
  {id:11,name:'МАТ 580 ПРЕМИУМ',groupId:1,retailPrice:190,wholesalePrice:190,archived:false}
];
const filmCtx={
  window:{nmBuildItems:()=>[{productId:null,article:'NM-MAT',name:'Полотно MAT-303',qty:10,price:0,total:0,unit:'м²'}]},
  state:{groups:[{id:1,name:'ПОЛОТНО'}],products:filmProducts,ops:[]},
  document:{createElement:()=>({style:{},textContent:'',innerHTML:''}),head:{appendChild:()=>{}},getElementById:()=>null},
  MutationObserver:class{observe(){}},
  nmFindRollWidth:data=>{let n=Number(data?.['Заказ']?.['ШиринаПолотна']||0);return n>10?n/100:n},
  console
};
filmCtx.window.window=filmCtx.window;
vm.createContext(filmCtx);
vm.runInContext(finalFix,filmCtx);
function filmPrice(width){
  const data={'Заказ':{'МатериалКаталог':'БЕЛАЯ МАТ-303 PREMIUM','МатериалМатериал':'MAT-303 PREMIUM','МатериалЦвет':'303','ШиринаПолотна':width}};
  const item=filmCtx.window.nmBuildItems(data).find(x=>x.article==='NM-MAT');
  return {price:item?.price,productId:item?.productId,source:item?.priceSource};
}
let p=filmPrice(360);must(p.price===105&&p.productId===5&&p.source==='Карточка товара','3.60 MAT-303 price match failed');
p=filmPrice(380);must(p.price===140&&p.productId===6,'3.80 MAT-303 price match failed');
p=filmPrice(500);must(p.price===140&&p.productId===6,'5.00 MAT-303 price match failed');
p=filmPrice(580);must(p.price===190&&p.productId===11,'5.80 MAT-303 price match failed');

const csvLatin=productsCsv.toString('latin1');
const hasCard=(article,price)=>new RegExp('^"'+article+'";.*;'+price+'\\r?$','m').test(csvLatin);
must(hasCard('00005',105),'MAT 303 narrow price card 00005/105 missing');
must(hasCard('00006',140),'MAT 303 wide price card 00006/140 missing');
must(hasCard('00011',190),'MAT 580 price card 00011/190 missing');

console.log('AUDIT OK: NewMatRos multi-ceiling open sale, same-dealer guard, duplicate protection, one final receipt and live film-price matching verified.');
