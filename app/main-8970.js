'use strict';
require('./main-8948.js');

const {app}=require('electron');

const loader=`(()=>{
  if(window.__release8970Loader)return;
  window.__release8970Loader=true;
  const load=(src)=>new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src=src;
    s.async=false;
    s.onload=()=>resolve();
    s.onerror=()=>reject(new Error('Не удалось загрузить '+src));
    (document.head||document.documentElement).appendChild(s);
  });
  load('release-8969.js?v=8.9.70').then(()=>load('release-8970.js?v=8.9.70')).catch(e=>console.error('8.9.70 renderer loader',e));
})()`;

function attach(win){
  if(!win||win.isDestroyed()||win.__uchet8970Attached)return;
  win.__uchet8970Attached=true;
  const run=()=>{if(!win.isDestroyed())win.webContents.executeJavaScript(loader,true).catch(e=>console.error('8.9.70 inject',e));};
  win.webContents.on('did-finish-load',run);
}

app.on('browser-window-created',(_event,win)=>attach(win));
