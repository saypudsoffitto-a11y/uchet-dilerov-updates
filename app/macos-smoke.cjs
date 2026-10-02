'use strict';
// Only invoked by the explicit CI launch flag, with an isolated profile.
const {app,BrowserWindow,session}=require('electron');
const fs=require('fs');
const path=require('path');
const report=process.env.UCHET_SMOKE_REPORT;
const expectedRuntime='8.9.68';
if(!report || !path.isAbsolute(report)) throw new Error('Smoke report path is required');
app.setPath('userData',path.join(path.dirname(report),'profile'));
app.whenReady().then(()=>{
  // A launch check must never contact the user's production sync server.
  session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(_details,callback)=>callback({cancel:true}));
});
setTimeout(async()=>{
  try{
    const win=BrowserWindow.getAllWindows().find(w=>w.isVisible()&&!w.isDestroyed());
    if(!win) throw new Error('Main window did not become visible');
    const state=await win.webContents.executeJavaScript(`(async()=>({ready:document.readyState,text:document.body.innerText.length,info:await window.newmatrosAPI.appInfo(),runtime:document.documentElement.dataset.uchetRuntime}))()`);
    if(state.ready!=='complete'||state.text<40||state.info.platform!=='darwin'||state.info.arch!=='arm64'||state.info.version!==app.getVersion()||state.runtime!==expectedRuntime)throw new Error('Invalid renderer/preload/IPC state: '+JSON.stringify(state));
    await win.webContents.executeJavaScript(`(async()=>{if(!window.__pinLock8948.isConfigured())await window.__pinLock8948.setInitialPin('2468','2468');else if(!window.__pinLock8948.isUnlocked())await window.__pinLock8948.unlock('2468');})()`);
    state.receiptFormat=await win.webContents.executeJavaScript("(async()=>{\n  window.alert=()=>{};window.confirm=()=>true;\n  state.sync={enabled:false};state.dealers=[{id:1,name:'Тестовый дилер',phone:''}];state.products=[];state.groups=[];state.receiptStates={};state.receiptItemStates={};\n  const items=[];\n  for(let n=1;n<=5;n++){\n    items.push({article:'NM-MAT',name:'Потолок '+n+' · Полотно: БЕЛАЯ МАТ-303 PREMIUM · рулон 2,8 м · узкая плёнка · цена из карточки «МАТ-303»',qty:10,price:200,total:2000,unit:'м²',ceilingNo:n});\n    const qty=[2,3,5,0,0][n-1];if(qty)items.push({article:'NM-CORNER',name:'Потолок '+n+' · Дополнительные углы (с 5-го)',qty,price:50,total:qty*50,unit:'шт',ceilingNo:n});\n  }\n  const op={id:898300,ts:100,type:'sale',source:'NewMatRos',dealerId:1,dealer:'Тестовый дилер',receiptNo:1,date:'02.10.2026',total:10500,profit:0,items};state.ops=[op];\n  const before=JSON.stringify(state);\n  showReceiptFromHistory(op.id);await new Promise(resolve=>setTimeout(resolve,50));\n  const root=document.getElementById('receiptViewBody');\n  const summary=root.querySelector('[data-corner-summary]');\n  if(!summary||summary.cells[1].textContent!=='Доп. углы'||summary.cells[2].textContent!=='10 шт'||!summary.cells[4].textContent.includes('500'))throw Error('Incorrect aggregated corners');\n  if(root.querySelectorAll('tbody tr').length!==6)throw Error('Receipt must have 5 materials and 1 corners row');\n  const jpeg=buildReceiptImage8968(op,state.dealers[0]);\n  if((jpeg.match(/Доп\\. углы/g)||[]).length!==1||/Полотно:|Потолок \\d|узкая плёнка|цена из карточки/.test(jpeg))throw Error('Wrong JPEG description');\n  if(JSON.stringify(state)!==before)throw Error('Opening a receipt changed business data');\n  summary.querySelector('button').click();await new Promise(resolve=>setTimeout(resolve,50));\n  const details=[...root.querySelectorAll('.receiptCornerDetail8983')];\n  if(details.length!==3)throw Error('Corner edit details missing');\n  const second=details.find(tr=>tr.dataset.receiptItemIndex==='3');\n  const quantity=second.querySelector('input');quantity.value='4';quantity.dispatchEvent(new Event('change',{bubbles:true}));\n  await new Promise(resolve=>setTimeout(resolve,50));\n  if(op.items[3].qty!==4||op.items[1].qty!==2||op.total!==10550)throw Error('Edit targeted wrong source line');\n  const first=root.querySelector('.receiptCornerDetail8983[data-receipt-item-index=\"1\"]');\n  first.querySelector('.receiptLineDelete').click();await new Promise(resolve=>setTimeout(resolve,50));\n  const current=state.ops.find(o=>o.id===898300),rows=receiptDisplay8983.rows(current);\n  if(rows.at(-1).qty!==9||current.total!==10450||current.items.filter(i=>i.article==='NM-MAT').length!==5)throw Error('Delete targeted wrong line');\n  if(!root.querySelector('[data-corner-summary]').textContent.includes('9 шт'))throw Error('Summary did not refresh after deletion');\n  return {ok:true,materials:5,cornersBefore:10,cornersAfterEditDelete:9,totalAfterEditDelete:10450};\n})()\n");
    const themes=[];
    for(const theme of ['standard','colorful','multicolor']){
      const result=await win.webContents.executeJavaScript("(async()=>{\n  go('settings');\n  const select=document.getElementById('uiThemeSelect');\n  if(!select)throw Error('Theme selector missing');\n  const before=JSON.stringify(state);\n  select.value=THEME;select.dispatchEvent(new Event('change',{bubbles:true}));\n  if(JSON.stringify(state)!==before)throw Error('Theme changed business data');\n  go('products');\n  await new Promise(resolve=>setTimeout(resolve,300));\n  const colors=[...document.querySelectorAll('nav button[data-section]')].map(b=>getComputedStyle(b).backgroundColor);\n  const row=document.querySelector('#products table tr');\n  return {theme:document.documentElement.dataset.uiTheme,stored:localStorage.getItem('uchet-ui-theme'),\n    options:[...select.options].map(o=>o.value),colors:new Set(colors).size,\n    rowHeight:row?.getBoundingClientRect().height,background:getComputedStyle(document.querySelector('main')).backgroundColor};\n})()".replace('THEME',JSON.stringify(theme)));
      if(result.theme!==theme||result.stored!==theme||result.options.join(',')!=='standard,colorful,multicolor')throw Error('Theme selection failed: '+JSON.stringify(result));
      if(theme==='multicolor'&&(result.colors<10||result.background!=='rgb(241, 244, 246)'))throw Error('Multicolor palette failed: '+JSON.stringify(result));
      themes.push(result);fs.writeFileSync(report+'.'+theme+'.png',(await win.webContents.capturePage()).toPNG());
    }
    const loaded=new Promise(resolve=>win.webContents.once('did-finish-load',resolve));win.webContents.reload();await loaded;
    const restored=await win.webContents.executeJavaScript(`document.documentElement.dataset.uiTheme==='multicolor'&&localStorage.getItem('uchet-ui-theme')==='multicolor'`);
    if(!restored)throw Error('Theme did not persist after reload');
    state.themes=themes;state.themeRestored=restored;
    fs.writeFileSync(report,JSON.stringify({ok:true,...state},null,2));
    fs.writeFileSync(report+'.png',(await win.webContents.capturePage()).toPNG());
    app.exit(0);
  }catch(error){fs.writeFileSync(report,JSON.stringify({ok:false,error:String(error)}));app.exit(1);}
},12000);
