'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../../app/index.html'),'utf8');
function harness(){
 const element=()=>({value:'',innerHTML:'',focus(){},classList:{add(){},remove(){}}});
 const s={state:{dealers:[{id:1,name:'A'},{id:2,name:'B'}],products:[],groups:[],ops:[]},setTimeout(){},money:String,esc:String,debtOf:()=>1000,lastDealerActivity:()=>0,profitTotal:()=>0,alerts:[],reports:[],confirm:()=>true};
 for(const key of ['payDealer','payAmount','payMethod','payNote','paymentChooser','paymentSelected','paymentForm','paymentDealerSearch','dcount','pcount','saleCount','debtTotal','homeDealerRows','pgroup','groupRows'])s[key]=element();
 for(const name of ['renderDealers','renderDebts','renderProducts','renderSaleProductGroups','renderPaymentDealers','renderSaleDealers','renderSaleProducts','renderNewMatRosSettings','renderNewMatRosNotification','renderUpdateSettings','renderSyncSettings','renderHistory','renderCart','applyStoredColumnOrders'])s[name]=()=>{};
 s.window=s;s.alert=x=>s.alerts.push(x);s.showDebtReport=(...args)=>s.reports.push(args);s.save=()=>s.render();
 vm.createContext(s);
 const start=html.includes('function renderPaymentSelection()')?'function renderPaymentSelection()':'function selectPayDealer(id)';
 vm.runInContext(html.slice(html.indexOf(start),html.indexOf('\nfunction ',html.indexOf('function makePayment()'))),s);
 vm.runInContext(html.slice(html.indexOf('function render(){'),html.indexOf('\nsetupReorderableTables();')),s);
 return s;
}
test('selected recipient and draft survive full screen refresh before payment',()=>{
 const s=harness();s.selectPayDealer(1);s.payAmount.value='125';s.payMethod.value='Наличные';s.payNote.value='test';
 s.render();s.render();assert.equal(s.payDealer.value,'1');assert.equal(s.payAmount.value,'125');assert.equal(s.payNote.value,'test');
 s.makePayment();assert.equal(s.alerts.length,0);assert.equal(s.state.ops.length,1);assert.equal(s.state.ops[0].dealerId,1);assert.equal(s.state.ops[0].total,125);assert.equal(s.reports.length,1);
});
test('fresh synced dealer objects retain the recipient and update the visible name',()=>{
 const s=harness();s.selectPayDealer(1);s.state.dealers=[{id:'1',name:'Updated'},{id:2,name:'B'}];s.render();
 assert.equal(s.payDealer.value,'1');assert.match(s.paymentSelected.innerHTML,/Updated/);
});
test('deleted recipient is cleared and cannot receive a payment or switch to another dealer',()=>{
 const s=harness();s.selectPayDealer(1);s.state.dealers=[{id:2,name:'B'}];s.render();s.payAmount.value='125';s.payMethod.value='Наличные';s.makePayment();
 assert.equal(s.payDealer.value,'');assert.equal(s.paymentSelected.innerHTML,'');assert.equal(s.state.ops.length,0);assert.equal(s.alerts.length,1);
});
test('back to dealer selection clears recipient and subsequent choice owns payment',()=>{
 const s=harness();s.selectPayDealer(1);s.clearPayDealer();s.render();assert.equal(s.payDealer.value,'');s.selectPayDealer(2);s.render();s.payAmount.value='50';s.payMethod.value='Перевод';s.makePayment();assert.equal(s.state.ops[0].dealerId,2);
});
test('payment form has no duplicate dealer selector',()=>{
 assert.match(html,/<input type="hidden" id="payDealer">/);assert.doesNotMatch(html,/<select id="payDealer"/);
});
