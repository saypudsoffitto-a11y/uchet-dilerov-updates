'use strict';
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),P=require('../server/master-protocol-8962');
let store={revision:0,state:{dealers:[],products:[],groups:[],ops:[]}};
const server=http.createServer((req,res)=>{const file=path.join(root,'app',req.url.split('?')[0]);try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch(_){res.writeHead(404);res.end();}});
async function run(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({headless:true});const origin='http://127.0.0.1:'+server.address().port;
  const files=[...fs.readFileSync(path.join(root,'app/preload.js'),'utf8').match(/const files=\[([\s\S]*?)\];/)[1].matchAll(/'\.\/(.*?)'/g)].map(m=>m[1]);
  async function open(seed){
   const context=await browser.newContext(),page=await context.newPage();page.on('dialog',d=>d.accept());page.on('pageerror',e=>console.error('PAGE ERROR',e.message));
   await page.exposeFunction('syncMock',async(method,body)=>{const response=()=>({ok:true,protocol:2,...store});if(method==='GET')return response();if(body.baseRevision!==store.revision)return {...response(),ok:false,conflict:true};try{const next=P.update(store,body);store={...next,revision:store.revision+1};return response();}catch(e){return {ok:false,message:e.message};}});
   await page.addInitScript(seed=>{localStorage.setItem('uchet_dilerov_v8',JSON.stringify(seed));window.windowAPI={showDialog:()=>true};window.syncAPI={request:(_url,_token,m,b)=>window.syncMock(m,b)};window.updateAPI={saveBackup:async()=>({ok:true})};window.receiptAPI={sendJpeg:async p=>{window.lastJpeg=p.html;return {ok:true};}};},seed);
   await page.goto(origin+'/index.html');for(const file of files)await page.addScriptTag({url:origin+'/'+file});return page;
  }
  const seed={dealers:[{id:1,name:'Тест',phone:'79991234567'}],products:[{id:2,name:'Мат',article:'M1',unit:'м²',stock:100,initialStock:100}],groups:[],ops:[],sync:{url:'https://example.invalid',enabled:false,revision:0},receiptSeq:1};
  const a=await open(seed);await a.evaluate(()=>masterSync8962.claim());assert.ok(store.computers?.masterId,await a.locator('#syncStatus').textContent());
  const b=await open({...seed,dealers:[...seed.dealers,{id:3,name:'Тест',phone:''}],products:[...seed.products,{id:4,name:'старый'}]});
  assert.equal(await b.evaluate(()=>masterSync8962.pull(true)),true);assert.equal(await b.evaluate(()=>state.dealers.length),1);
  await b.evaluate(()=>{state.ops.push({id:50,type:'sale',dealerId:1,dealer:'Тест',receiptNo:1,total:80,items:[{productId:2,name:'Мат',qty:4,price:20,total:80}]});state.products[0].stock-=4;save();});
  assert.equal(await b.evaluate(()=>masterSync8962.push(true)),true,await b.locator('#syncStatus').textContent());assert.equal(store.state.ops.length,1);assert.equal(store.state.products[0].stock,96);
  assert.equal(await a.evaluate(()=>masterSync8962.pull(true)),true);assert.equal(await a.evaluate(()=>state.ops.length),1);
  await a.evaluate(()=>renderDebts());await a.waitForTimeout(100);assert.equal(await a.locator('#debtRows tr button').count(),1);assert.equal(await a.locator('#debts thead th').count(),6);
  await a.evaluate(()=>sendWhatsApp(50));const html=await a.evaluate(()=>lastJpeg);assert.match(html,/&nbsp;₽<\/span>/);
  const receipt=await browser.newPage();await receipt.setContent(html);const nowrap=await receipt.locator('td.price span,td.sum span,.total span,.debt span').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).whiteSpace));assert.ok(nowrap.length>=4&&nowrap.every(v=>v==='nowrap'));await receipt.screenshot({path:path.join(root,'qa-receipt-8962.png')});
  console.log('PASS: master, stale worker catalog, sale, stock, pull, one payment action, JPEG currency');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
