const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../app/voice-assistant.js'),'utf8');

function setup(){
  const elements=new Map(),spoken=[],confirmations=[],recognizers=[];
  class Element{
    constructor(){this.value='';this.textContent='';this.listeners={};this.style={};this.classList={add(){},remove(){},contains(){return false}}}
    addEventListener(name,fn){this.listeners[name]=fn}
    appendChild(el){if(el.id)elements.set(el.id,el)}
    setAttribute(){}
    showModal(){this.open=true}
    close(){this.open=false;this.listeners.close?.()}
    querySelector(s){return get(s.replace(/^#/,''))}
    querySelectorAll(){return []}
    focus(){}
  }
  function get(id){if(!elements.has(id))elements.set(id,new Element());return elements.get(id)}
  let accept=true;
  const context={console, setTimeout:()=>{}, Event:class{},
    document:{createElement:()=>new Element(),head:new Element(),body:new Element(),querySelector:()=>null,getElementById:get},
    localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
    speechSynthesis:{cancel(){},getVoices:()=>[],addEventListener(){},speak(u){spoken.push(u.text)}},
    SpeechSynthesisUtterance:class{constructor(text){this.text=text}},
    SpeechRecognition:class{constructor(){recognizers.push(this)}start(){this.onstart?.()}abort(){this.aborted=true}},
    confirm(text){confirmations.push(text);return accept},
    state:{dealers:[{id:1,name:'Ахмед'}],products:[{id:7,name:'Светильник 48 ватт',unit:'шт',stock:12,retailPrice:913.47,wholesalePrice:807.31,buyPrice:401}]},
    cart:[],debtOf:()=>78432.19,
    go(){},selectSaleDealer(id){get('saleDealer').value=String(id)},
    selectSaleProduct(id){get('saleProduct').value=String(id)},
    fillDefaultPrice(){const p=context.state.products.find(p=>p.id==get('saleProduct').value);get('salePrice').value=get('priceType').value==='wholesale'?p.wholesalePrice:p.retailPrice},
    addToCart(qty){context.cart.push({productId:get('saleProduct').value,qty,price:get('salePrice').value})},
    saveSale(){context.saved=true;context.cart=[]}
  };
  context.window=context;
  get('priceType').value='retail';
  vm.runInNewContext(source,context);
  return {context,get,spoken,confirmations,recognizers,run:context.voiceAssistant8915.run,deny(){accept=false}};
}

test('financial answers stay on screen; synthesis receives only a fixed phrase',async()=>{
  const t=setup();
  for(const cmd of ['Долг Ахмеда','Цена светильник 48 ватт','Остаток светильник 48 ватт','Неизвестно 8888 рублей'])await t.run(cmd);
  assert.equal(t.spoken.length,4);
  assert.ok(t.spoken.every(s=>s==='Ответ готов. Посмотрите на экран программы.'));
  await t.run('Долг Ахмед');
  assert.match(t.get('voiceTranscript').textContent,/78/);
});
test('mic stays off at startup; stop discards pending results',()=>{
  const t=setup();assert.equal(t.recognizers.length,0);
  t.get('voiceListen').listeners.click();
  const r=t.recognizers[0];assert.ok(r);
  t.context.voiceAssistant8915.stop();
  assert.equal(r.aborted,true);assert.equal(r.onresult,null);
});
test('recognition stops before execution and financial answer',async()=>{
  const t=setup();t.get('voiceListen').listeners.click();
  const r=t.recognizers[0];r.onresult({results:[[{transcript:'Долг Ахмед'}]]});
  assert.equal(r.aborted,true);assert.equal(r.onresult,null);
  assert.equal(t.spoken[0],'Ответ готов. Посмотрите на экран программы.');
});
test('Russian selection and quantities retain product specifications and local price',async()=>{
  const t=setup();await t.run('Выбери дилера Ахмед');
  assert.equal(t.get('saleDealer').value,'1');
  t.get('priceType').value='wholesale';t.get('salePrice').value=999999;
  await t.run('Добавь три светильника 48 ватт');
  assert.equal(t.context.cart[0].qty,3);assert.equal(t.context.cart[0].price,807.31);
  assert.equal(t.confirmations.length,2);
});
test('reordered product words resolve; missing specifications do not select wrong product',async()=>{
  const t=setup();t.get('saleDealer').value='1';
  await t.run('Добавь 2 ватт 48 светильник');assert.equal(t.context.cart.length,1);
  await t.run('Добавь 2 светильник 80 ватт');assert.equal(t.context.cart.length,1);
});
test('cancellation, missing dealer, zero quantity and deletion never mutate cart',async()=>{
  const t=setup();await t.run('Добавь 3 светильник 48 ватт');assert.equal(t.context.cart.length,0);
  t.get('saleDealer').value='1';await t.run('Добавь 0 светильник 48 ватт');assert.equal(t.confirmations.length,0);
  await t.run('Удали товар светильник 48 ватт');assert.match(t.get('voiceTranscript').textContent,/запрещено/);
  t.deny();await t.run('Добавь 3 светильник 48 ватт');assert.equal(t.context.cart.length,0);
});
test('ambiguous products and dealers require clarification',async()=>{
  const t=setup();t.context.state.dealers.push({id:2,name:'Ахмед'});
  await t.run('Выбери дилера Ахмед');assert.equal(t.confirmations.length,0);
  t.get('saleDealer').value='1';t.context.state.products.push({...t.context.state.products[0],id:8});
  await t.run('Добавь 3 светильник 48 ватт');assert.equal(t.context.cart.length,0);assert.equal(t.confirmations.length,0);
});
test('saving an empty sale is blocked; populated sale requires confirmation',async()=>{
  const t=setup();await t.run('Сохрани продажу');assert.equal(t.context.saved,undefined);
  t.get('saleDealer').value='1';await t.run('Добавь 1 светильник 48 ватт');
  t.deny();await t.run('Сохрани продажу');assert.equal(t.context.saved,undefined);assert.equal(t.context.cart.length,1);
});

test('create draft for declined dealer name never saves or clears an existing cart',async()=>{
  const t=setup();t.context.state.dealers[0].name='Ахмед Карчега';
  await t.run('Создай чек Ахмеду Карчеги');assert.equal(t.get('saleDealer').value,'1');assert.equal(t.context.saved,undefined);
  t.context.cart.push({qty:4});await t.run('Создай чек Ахмеду Карчеги');assert.equal(t.context.cart.length,1);
  assert.equal(t.confirmations.length,1);
});
test('confirmed nickname resolves locally and omitted quantity is asked before adding',async()=>{
  const t=setup();t.context.state.products.push({...t.context.state.products[0],id:9,name:'Профиль Fly 01'});
  await t.run('Запомни: парящий профиль = профиль Fly 01');
  t.get('saleDealer').value='1';await t.run('парящий профиль');
  assert.equal(t.context.cart.length,0);assert.match(t.get('voiceTranscript').textContent,/Сколько/);
  await t.run('три');assert.equal(t.context.cart[0].productId,'9');assert.equal(t.context.cart[0].qty,3);
  assert.ok(t.spoken.every(x=>x==='Ответ готов. Посмотрите на экран программы.'));
});
test('decimal product specification survives speech spelling; trailing quantity works',async()=>{
  const t=setup();t.context.state.products.push({...t.context.state.products[0],id:10,name:'Гардина 2.05'});
  await t.run('Сколько стоит гардина 2 05');assert.match(t.get('voiceTranscript').textContent,/Розничная цена/);
  t.get('saleDealer').value='1';await t.run('гардина 2 05 3 штуки');assert.equal(t.context.cart[0].qty,3);assert.equal(t.context.cart[0].productId,'10');
});
test('pending quantity cannot add to a different dealer',async()=>{
  const t=setup();t.get('saleDealer').value='1';await t.run('Добавь светильник 48 ватт');
  t.get('saleDealer').value='2';await t.run('три');assert.equal(t.context.cart.length,0);
});

test('price dialog closes by both controls without navigation or changing cart',async()=>{
  const t=setup();let navigations=0;t.context.go=()=>navigations++;
  t.context.cart.push({qty:3,price:807.31});const before=JSON.stringify(t.context.cart);
  await t.run('Цена светильник 48 ватт');
  assert.equal(t.get('voicePriceDialog').open,true);
  assert.equal(t.get('voicePriceName').textContent,'Светильник 48 ватт');
  assert.match(t.get('voicePriceValue').textContent,/913/);
  t.get('voicePriceCross').listeners.click();assert.equal(t.get('voicePriceDialog').open,false);
  await t.run('Цена светильник 48 ватт');t.get('voicePriceClose').listeners.click();
  assert.equal(t.get('voicePriceDialog').open,false);assert.equal(navigations,0);
  assert.equal(JSON.stringify(t.context.cart),before);
});

test('real cart edit handler recalculates quantity, price and total for an assistant-added row',async()=>{
  const t=setup();t.get('saleDealer').value='1';await t.run('Добавь 3 светильник 48 ватт');
  const html=fs.readFileSync(require('node:path').join(__dirname,'../app/index.html'),'utf8');
  const handler=html.split('\n').find(line=>line.startsWith('function updateCartItem('));
  assert.ok(handler);t.context.renderCart=()=>{};
  vm.runInNewContext(handler+'\nupdateCartItem(0,"qty","5");updateCartItem(0,"price","10,5");',t.context);
  assert.equal(t.context.cart[0].qty,5);assert.equal(t.context.cart[0].price,10.5);assert.equal(t.context.cart[0].total,52.5);
});

test('clearing assistant memory affects no business data and disabled microphone cannot start',async()=>{
  const t=setup();t.context.state.products.push({...t.context.state.products[0],id:9,name:'Профиль Fly 01'});
  await t.run('Запомни: парящий профиль = профиль Fly 01');
  t.context.cart.push({qty:8});const before=JSON.stringify({state:t.context.state,cart:t.context.cart});
  t.get('voiceAISettings').listeners.click();assert.match(t.get('voiceMemoryCount').textContent,/1/);
  t.get('voiceClearMemory').listeners.click();assert.match(t.get('voiceMemoryCount').textContent,/0/);
  assert.equal(JSON.stringify({state:t.context.state,cart:t.context.cart}),before);
  t.get('voiceAllowMic').listeners.change({target:{checked:false}});t.get('voiceListen').listeners.click();
  assert.equal(t.recognizers.length,0);
});
test('cancelling memory clear keeps aliases',async()=>{
  const t=setup();await t.run('Запомни: лампа = светильник 48 ватт');t.deny();
  t.get('voiceClearMemory').listeners.click();t.get('voiceAISettings').listeners.click();
  assert.match(t.get('voiceMemoryCount').textContent,/1/);
});
