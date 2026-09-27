'use strict';
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const protocol=require('./master-protocol-8962');
const C=require('./sync-core-8962');
const debt=(s,id)=>Math.round((s.ops||[]).filter(o=>String(o.dealerId)===String(id)).reduce((a,o)=>a+(['sale','initial_debt'].includes(o.type)?Number(o.total)||0:o.type==='payment'?-(Number(o.total)||0):0),0)*100)/100;
function command(current,body){
 if(!/^[0-9a-f-]{36}$/i.test(body.requestId||''))throw Error('Неверный номер запроса');
 const hash=crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
 const previous=current.mobileRequests?.[body.requestId];
 if(previous){if(previous.hash!==hash)throw Error('Этот номер запроса уже использован');return {duplicate:true,result:previous.result};}
 const id=parseInt(crypto.createHash('sha256').update(body.requestId).digest('hex').slice(0,13),16);
 const device={id:'mobile-owner-device-0001',name:'Телефон владельца'};
 const payload={protocol:2,action:'changes',device,changes:[]};
 let result;
 if(body.kind==='payment'){
  const d=(current.state.dealers||[]).find(d=>String(d.id)===String(body.dealerId));
  if(!d)throw Error('Дилер не найден. Обновите список.');
  const total=Number(body.amount);
  if(!Number.isFinite(total)||total<=0||total>1e9||Math.abs(total*100-Math.round(total*100))>0.00001)throw Error('Укажите сумму больше нуля, не более двух знаков после запятой');
  if(!['Наличные','Перевод'].includes(body.method))throw Error('Выберите способ оплаты');
  const ts=Number(body.ts);if(!Number.isFinite(ts)||ts<946684800000||ts>Date.now()+300000)throw Error('Проверьте дату оплаты');
  if((current.state.ops||[]).some(o=>o.id===id))throw Error('Совпадение номеров операций');
  const beforeDebt=debt(current.state,d.id);
  const op={id,ts,type:'payment',date:new Date(ts).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'}),dealerId:d.id,dealer:d.name,total,method:body.method,note:String(body.note||'').slice(0,1000),beforeDebt,afterDebt:Math.round((beforeDebt-total)*100)/100,source:'mobile',mobileRequestId:body.requestId};
  payload.changes=[{id:String(id),before:null,after:op}];result={id,dealerId:d.id};
 }else if(body.kind==='dealer'){
  const name=String(body.name||'').trim(),phone=C.phone(body.phone);
  if(!name||name.length>120||!/^[0-9]{10,15}$/.test(phone))throw Error('Укажите имя и полный номер телефона');
  if((current.state.dealers||[]).some(d=>d.id===id))throw Error('Совпадение номеров карточек');
  const row={id,name,phone,city:String(body.city||'').trim().slice(0,120),note:'',source:'mobile'};
  payload.catalogPatch={dealers:[{id:String(id),before:null,after:row}]};result={id,dealerId:id};
 }else throw Error('Неизвестное действие');
 const next=protocol.update(current,payload);
 next.mobileRequests={...current.mobileRequests,[body.requestId]:{hash,result}};
 return {next,result};
}
function createMobileHandler({readStore,writeStore,password=process.env.MOBILE_PASSWORD,origin=process.env.MOBILE_ORIGIN}){
 const sessions=new Map();let attempts=[];
 const send=(res,status,data,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(data));};
 async function body(req){let text='';for await(const part of req){text+=part;if(Buffer.byteLength(text)>8192)throw Error('Слишком большой запрос');}return JSON.parse(text||'{}');}
 const equal=(a,b)=>crypto.timingSafeEqual(crypto.createHash('sha256').update(String(a)).digest(),crypto.createHash('sha256').update(String(b)).digest());
 return async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(!url.pathname.startsWith('/mobile'))return false;
  try{
   const files={'/mobile/':'index.html','/mobile/app.js':'app.js','/mobile/style.css':'style.css','/mobile/manifest.json':'manifest.json','/mobile/sw.js':'sw.js','/mobile/icon.svg':'icon.svg'};
   if(req.method==='GET'&&files[url.pathname]){
    const file=files[url.pathname],ext=path.extname(file),type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'}[ext];
    res.writeHead(200,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"});res.end(fs.readFileSync(path.join(__dirname,'mobile',file)));return true;
   }
   if(!password||password.length<16||!origin){send(res,503,{message:'Мобильный вход ещё не настроен'});return true;}
   if(req.method==='POST'&&(req.headers.origin!==origin||!String(req.headers['content-type']).startsWith('application/json'))){send(res,403,{message:'Недопустимый источник запроса'});return true;}
   const now=Date.now();for(const [key,value] of sessions)if(value<now)sessions.delete(key);
   if(url.pathname==='/mobile/api/login'&&req.method==='POST'){
    attempts=attempts.filter(t=>t>now-60000);if(attempts.length>=10){send(res,429,{message:'Слишком много попыток. Подождите минуту.'});return true;}attempts.push(now);
    const input=await body(req);if(!equal(input.password||'',password)){send(res,401,{message:'Неверный пароль'});return true;}
    const token=crypto.randomBytes(32).toString('hex');sessions.set(token,now+12*3600000);
    send(res,200,{ok:true},{'Set-Cookie':`mobile_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/mobile; Max-Age=43200`});return true;
   }
   const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('mobile_session='))?.slice(15);
   if(!sessions.has(token)){send(res,401,{message:'Войдите в мобильный кабинет'});return true;}
   if(url.pathname==='/mobile/api/logout'&&req.method==='POST'){sessions.delete(token);send(res,200,{ok:true},{'Set-Cookie':'mobile_session=; HttpOnly; Secure; SameSite=Strict; Path=/mobile; Max-Age=0'});return true;}
   if(url.pathname==='/mobile/api/summary'&&req.method==='GET'){
    const current=await readStore(),s=current.state;
    send(res,200,{revision:current.revision,dealers:(s.dealers||[]).map(d=>({id:d.id,name:d.name,phone:d.phone,city:d.city,debt:debt(s,d.id)})),ops:(s.ops||[]).map(o=>({id:o.id,dealerId:o.dealerId,dealer:o.dealer,type:o.type,total:o.total,ts:o.ts,date:o.date,method:o.method,note:o.note}))});return true;
   }
   if(url.pathname==='/mobile/api/commands'&&req.method==='POST'){
    const input=await body(req);
    for(let i=0;i<5;i++){
     const current=await readStore(),out=command(current,input);
     if(out.duplicate){send(res,200,{ok:true,...out.result});return true;}
     const saved=await writeStore(current.revision,out.next);
     if(saved?.ok){send(res,200,{ok:true,...out.result,revision:saved.revision});return true;}
    }
    send(res,409,{message:'База обновляется. Запись ожидает повторной отправки.'});return true;
   }
   send(res,404,{message:'Маршрут не найден'});
  }catch(error){send(res,422,{message:error.message});}
  return true;
 };
}
module.exports={createMobileHandler,command,debt};
