'use strict';
require('./main-8941.js');

const {app,BrowserWindow,ipcMain,shell,clipboard}=require('electron');
const fs=require('fs');
const path=require('path');

function safeJpegName(name){
  let n=String(name||'Товарная_накладная.jpg').replace(/[<>:"/\\|?*\x00-\x1F]/g,'_').trim();
  if(!/\.jpe?g$/i.test(n))n+='.jpg';
  return n||'Товарная_накладная.jpg';
}

async function htmlToImage8948(html){
  const w=new BrowserWindow({show:false,width:760,height:900,backgroundColor:'#ffffff',webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
  try{
    await w.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(String(html||'')));
    // Crop to the receipt itself. The old code forced an 840px canvas, which
    // made a 700px compact receipt look almost full-screen in WhatsApp.
    const dims=await w.webContents.executeJavaScript(`(()=>{
      const el=document.querySelector('.sheet')||document.body;
      const r=el.getBoundingClientRect();
      return {
        w:Math.ceil(Math.max(r.width,el.scrollWidth||0)),
        h:Math.ceil(Math.max(r.height,el.scrollHeight||0))
      };
    })()`,true);
    const width=Math.max(320,Math.min(1200,Math.ceil(Number(dims?.w)||700)));
    const height=Math.max(180,Math.min(12000,Math.ceil(Number(dims?.h)||320)));
    w.setContentSize(width,height);
    await new Promise(r=>setTimeout(r,80));
    return await w.webContents.capturePage({x:0,y:0,width,height});
  }finally{
    if(!w.isDestroyed())w.destroy();
  }
}

ipcMain.handle('receipt:sendJpegWhatsApp',async(_e,payload)=>{
  try{
    const image=await htmlToImage8948(payload&&payload.html);
    const jpeg=image.toJPEG(92);
    const dir=path.join(app.getPath('temp'),'uchet-dilerov-jpeg');
    fs.mkdirSync(dir,{recursive:true});
    const filePath=path.join(dir,safeJpegName(payload&&payload.fileName));
    fs.writeFileSync(filePath,jpeg);
    clipboard.writeImage(image);
    let phone=String(payload&&payload.phone||'').replace(/\D/g,'');
    if(phone.length===11&&phone[0]==='8')phone='7'+phone.slice(1);
    await shell.openExternal('whatsapp://send?'+(phone?'phone='+encodeURIComponent(phone):''));
    const pasteShortcut=process.platform==='darwin'?'Cmd+V':'Ctrl+V';
    return {ok:true,path:filePath,message:'Чек подготовлен как JPEG и скопирован как изображение. В открывшемся WhatsApp нажми '+pasteShortcut+' и отправь.'};
  }catch(e){
    return {ok:false,message:'Не удалось подготовить JPEG для WhatsApp: '+String(e&&e.message||e)};
  }
});
