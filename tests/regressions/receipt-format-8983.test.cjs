'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const display=require('../../app/receipt-display-8983');
const mat=(no,width)=>({article:'NM-MAT',name:`Потолок ${no} · Полотно: БЕЛАЯ МАТ-303 PREMIUM · рулон ${width} м · узкая плёнка · цена из карточки «МАТ-303»`,qty:10,price:200,total:2000,ceilingNo:no,unit:'м²'});
const corner=(no,qty,price=50)=>({article:'NM-CORNER',name:`Потолок ${no} · Дополнительные углы (с 5-го)`,qty,price,total:qty*price,ceilingNo:no,unit:'шт'});
const order=()=>({id:100,type:'sale',source:'NewMatRos',total:10500,receiptNo:1,date:'02.10.2026',items:[mat(1,2.8),corner(1,2),mat(2,3),corner(2,3),mat(3,3.6),corner(3,5),mat(4,4.5),mat(5,5.8)]});
test('five ceilings have five material rows and one extra-corners row, with no financial rewrite',()=>{
 const op=order(),before=JSON.stringify(op),rows=display.rows(op);
 assert.equal(rows.length,6);
 assert.equal(rows[0].name,'БЕЛАЯ МАТ-303 PREMIUM · рулон 2.8 м');
 assert.equal(rows[4].name,'БЕЛАЯ МАТ-303 PREMIUM · рулон 5.8 м');
 assert.deepEqual([rows[5].name,rows[5].qty,rows[5].price,rows[5].total],['Доп. углы',10,50,500]);
 assert.equal(rows.reduce((sum,i)=>sum+i.total,0),op.total);
 assert.equal(JSON.stringify(op),before);
 assert.deepEqual(rows.slice(0,5).map(i=>i._receiptItemIndex),[0,2,4,6,7]);
});
test('corners at different edited prices preserve their actual total without inventing a common rate',()=>{
 const rows=display.rows({source:'NewMatRos',items:[corner(1,2,50),corner(2,3,60)]});
 assert.deepEqual([rows[0].qty,rows[0].price,rows[0].total],[5,null,280]);
});
test('manual goods and separate receipts are never merged into the order',()=>{
 const manual={source:'manual',items:[{article:'NM-MAT',name:'Полотно: товар'},corner(1,2),corner(2,3)]};
 assert.equal(display.rows(manual).length,3);assert.equal(display.rows(manual)[0].name,'Полотно: товар');
 assert.equal(display.rows({source:'NewMatRos',items:[corner(1,2)]})[0].qty,2);
 assert.equal(display.rows({source:'NewMatRos',items:[corner(2,3)]})[0].qty,3);
});
test('expanded editor retains each source index while the export remains one summary row',()=>{
 const op=order(),rows=display.rows(op,{cornerDetails:true});
 assert.deepEqual(rows.filter(i=>i._receiptCornerDetail).map(i=>i._receiptItemIndex),[1,3,5]);
 assert.equal(display.rows(op).filter(i=>i.article==='NM-CORNER').length,1);
 op.items.splice(3,1);assert.equal(display.rows(op).at(-1).qty,7);
});
test('real WhatsApp renderer uses shortened material and exactly one corner row',()=>{
 const source=fs.readFileSync(require.resolve('../../app/release-8968'),'utf8');
 const start=source.indexOf('  const esc8968='),end=source.indexOf('  async function sendReceipt');
 const ctx={window:{receiptDisplay8983:display}};vm.createContext(ctx);
 vm.runInContext(source.slice(start,end)+';this.render=receiptJpegHtml8968;',ctx);
 const html=ctx.render(order(),{name:'Тест'});
 assert.equal((html.match(/Доп\. углы/g)||[]).length,1);
 assert.doesNotMatch(html,/Полотно:|Потолок \d|узкая плёнка|цена из карточки/);
 assert.match(html,/>10 шт</);assert.match(html,/500&nbsp;₽/);assert.match(html,/10.500&nbsp;₽/);
});
