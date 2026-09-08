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
const r23=read('runtime-fixes-8923.js');
const r24=read('runtime-fixes-8924.js');
const finalFix=read('final-fixes-8917.js');
const products=read('tovar.csv');

must(pkg.version==='8.9.25','package version must be 8.9.25');
must(preload.includes('setIniHandler'),'exclusive NewMatRos handler API missing');
must(preload.includes('loadBundledNewMatRosClients'),'NewMatRos clients API alias missing');
must(index.includes('loadBundledNewMatRosClients'),'index no longer asks for expected clients API');
must(!r22.includes('newmatrosAPI?.onIni'),'obsolete NewMatRos listener still exists in speech runtime');
must(r23.includes('newmatrosAPI?.setIniHandler'),'review flow is not authoritative INI handler');
must(r23.includes("showNewMatRosPreview(data,'пересчёт')"),'confirmation must populate core preview without a duplicate notification');
must(r23.includes('Оформить как продажу дилеру'),'review confirmation button missing');
must(r23.includes('Фактура / материал')&&r23.includes('Ширина полотна'),'review fields missing');
must(r24.includes('window.nmFindDealer'),'dealer matcher missing');

const order=[
  preload.indexOf("'./runtime-fixes-8924.js'"),
  preload.indexOf("'./runtime-fixes-8923.js'")
];
must(order[0]>=0&&order[1]>=0&&order[0]<order[1],'dealer matcher must load before review runtime');

// Execute the actual dealer matcher with representative records.
const context={
  window:{},
  document:{getElementById:()=>null,documentElement:{dataset:{}}},
  state:{dealers:[
    {id:1,name:'АБДУРАХМАН МАХАН',phone:'8 988 424-81-81',company:'',fio:''},
    {id:2,name:'КАРЧИГА',phone:'',company:'КАРЧИГА ПОТОЛКИ',fio:''}
  ]},
  console
};
vm.createContext(context);
vm.runInContext(r24,context);
must(typeof context.window.nmFindDealer==='function','nmFindDealer did not initialize');
let hit=context.window.nmFindDealer({'Контрагент':{'Телефон':'+7 988 424 81 81','Наименование':'Другое имя'},'Заказ':{}});
must(hit.dealer&&hit.dealer.id===1,'dealer matcher failed phone normalization');
hit=context.window.nmFindDealer({'Контрагент':{'Наименование':'КАРЧИГА'},'Заказ':{}});
must(hit.dealer&&hit.dealer.id===2,'dealer matcher failed name match');

// Price-card rules required by NewMatRos.
must(finalFix.includes('width<=3.60'),'narrow film rule missing');
must(finalFix.includes('width>=3.80&&width<=5.05'),'wide 3.80–5.00 rule missing');
must(finalFix.includes('width>=5.70&&width<=5.90'),'5.80 film rule missing');
must(products.includes('МАТ-303 ДО 360 ПРЕМИУМ')&&products.includes(';105'),'MAT 303 narrow price card missing');
must(products.includes('МАТ-303 ОТ 380-500м ПРЕМИУМ')&&products.includes(';140'),'MAT 303 wide price card missing');
must(products.includes('МАТ 580 ПРЕМИУМ')&&products.includes(';190'),'MAT 580 price card missing');

console.log('AUDIT OK: NewMatRos single handler, dealer match, review/confirm flow, client API and film price rules verified.');
