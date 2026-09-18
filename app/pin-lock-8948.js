(()=>{
  'use strict';
  if(window.__pinLock8948Bootstrapped)return;
  window.__pinLock8948Bootstrapped=true;

  const STORAGE_KEY='uchet_pin_auth_v1';
  const ITERATIONS=120000;
  const enc=new TextEncoder();

  const bytesToHex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  const hexToBytes=hex=>{
    const out=new Uint8Array(Math.floor(String(hex||'').length/2));
    for(let i=0;i<out.length;i++)out[i]=parseInt(hex.slice(i*2,i*2+2),16)||0;
    return out;
  };
  const randomHex=len=>{
    const bytes=new Uint8Array(len);crypto.getRandomValues(bytes);return bytesToHex(bytes);
  };
  async function derive(pin,saltHex,iterations=ITERATIONS){
    const key=await crypto.subtle.importKey('raw',enc.encode(String(pin)),'PBKDF2',false,['deriveBits']);
    const bits=await crypto.subtle.deriveBits({
      name:'PBKDF2',salt:hexToBytes(saltHex),iterations,hash:'SHA-256'
    },key,256);
    return bytesToHex(new Uint8Array(bits));
  }
  function readCfg(){
    try{
      const cfg=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      if(cfg&&cfg.version===1&&cfg.salt&&cfg.hash)return cfg;
    }catch(_){}
    return null;
  }
  function writeCfg(cfg){localStorage.setItem(STORAGE_KEY,JSON.stringify(cfg))}
  const validPin=pin=>/^\d{4,8}$/.test(String(pin||''));

  const style=document.createElement('style');
  style.id='pinLock8948Style';
  style.textContent=`
    #appPinLock8948{position:fixed;inset:0;z-index:5000;background:rgba(10,22,18,.66);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:24px}
    #appPinLock8948 .pinCard8948{width:min(430px,100%);background:#fff;border:1px solid #dce5e0;border-radius:18px;box-shadow:0 28px 90px #0007;padding:28px}
    #appPinLock8948 h2{margin:0 0 8px;font-size:25px;color:#17332c}
    #appPinLock8948 p{margin:0 0 18px;color:#667670;line-height:1.45}
    #appPinLock8948 .pinRow8948{display:grid;gap:12px}
    #appPinLock8948 input{font-size:22px;letter-spacing:.18em;text-align:center}
    #appPinLock8948 .pinActions8948{display:flex;gap:10px;margin-top:16px}
    #appPinLock8948 .pinActions8948 button{flex:1}
    #appPinLock8948 .pinError8948{min-height:22px;margin-top:10px;color:#b42328;font-weight:650;font-size:13px}
    #appPinLock8948 .pinHint8948{margin-top:14px;font-size:12px;color:#78877f}
    body.appLocked8948{overflow:hidden}
    body.appLocked8948>nav,body.appLocked8948>header,body.appLocked8948>main{filter:blur(3px);pointer-events:none;user-select:none}
    #pinSettings8948{margin-top:16px}
  `;
  document.head.appendChild(style);

  let unlocked=false;
  let busy=false;

  function removeOverlay(){
    document.getElementById('appPinLock8948')?.remove();
    document.body.classList.remove('appLocked8948');
    unlocked=true;
  }
  function field(type,placeholder){
    const input=document.createElement('input');
    input.type='password';input.inputMode='numeric';input.autocomplete=type==='current'?'current-password':'new-password';
    input.maxLength=8;input.placeholder=placeholder;
    input.addEventListener('input',()=>{input.value=input.value.replace(/\D/g,'').slice(0,8)});
    return input;
  }
  function button(text,cls,fn){
    const b=document.createElement('button');b.type='button';b.textContent=text;b.className=cls||'primary';b.onclick=fn;return b;
  }
  function shell(title,description){
    document.getElementById('appPinLock8948')?.remove();
    document.body.classList.add('appLocked8948');
    const root=document.createElement('div');root.id='appPinLock8948';
    const card=document.createElement('div');card.className='pinCard8948';
    const h=document.createElement('h2');h.textContent=title;
    const p=document.createElement('p');p.textContent=description;
    const row=document.createElement('div');row.className='pinRow8948';
    const error=document.createElement('div');error.className='pinError8948';
    const hint=document.createElement('div');hint.className='pinHint8948';
    hint.textContent='Код хранится только на этом компьютере и не отправляется на сервер синхронизации.';
    card.append(h,p,row,error,hint);root.appendChild(card);document.body.appendChild(root);
    return {root,card,row,error};
  }
  async function setInitialPin(pin,confirmPin=pin){
    if(readCfg())throw new Error('Код-пароль уже настроен.');
    if(!validPin(pin))throw new Error('Код должен содержать от 4 до 8 цифр.');
    if(String(pin)!==String(confirmPin))throw new Error('Коды не совпадают.');
    const salt=randomHex(16),hash=await derive(pin,salt,ITERATIONS);
    writeCfg({version:1,salt,hash,iterations:ITERATIONS,createdAt:Date.now()});
    removeOverlay();installSettingsCard();
    return true;
  }
  async function unlock(pin){
    const cfg=readCfg();
    if(!cfg)return false;
    if(!validPin(pin))return false;
    const hash=await derive(pin,cfg.salt,Number(cfg.iterations)||ITERATIONS);
    if(hash!==cfg.hash)return false;
    removeOverlay();installSettingsCard();
    return true;
  }
  async function changePin(currentPin,newPin,confirmPin=newPin){
    const cfg=readCfg();
    if(!cfg)throw new Error('Код-пароль ещё не настроен.');
    const currentHash=await derive(currentPin,cfg.salt,Number(cfg.iterations)||ITERATIONS);
    if(currentHash!==cfg.hash)throw new Error('Текущий код указан неверно.');
    if(!validPin(newPin))throw new Error('Новый код должен содержать от 4 до 8 цифр.');
    if(String(newPin)!==String(confirmPin))throw new Error('Новые коды не совпадают.');
    const salt=randomHex(16),hash=await derive(newPin,salt,ITERATIONS);
    writeCfg({version:1,salt,hash,iterations:ITERATIONS,createdAt:cfg.createdAt||Date.now(),changedAt:Date.now()});
    removeOverlay();installSettingsCard();
    return true;
  }

  function showSetup(){
    unlocked=false;
    const ui=shell('Создайте код-пароль','При первом запуске задайте код из 4–8 цифр. Он будет запрашиваться при каждом входе в программу.');
    const pin=field('new','Новый код');const confirmPin=field('new','Повторите код');
    ui.row.append(pin,confirmPin);
    const actions=document.createElement('div');actions.className='pinActions8948';
    const save=button('Сохранить код','primary',async()=>{
      if(busy)return;busy=true;save.disabled=true;ui.error.textContent='';
      try{await setInitialPin(pin.value,confirmPin.value)}
      catch(e){ui.error.textContent=e.message||String(e);pin.focus();pin.select()}
      finally{busy=false;save.disabled=false}
    });
    actions.append(save);ui.card.insertBefore(actions,ui.error);
    const submit=e=>{if(e.key==='Enter'){e.preventDefault();save.click()}};
    pin.addEventListener('keydown',submit);confirmPin.addEventListener('keydown',submit);
    setTimeout(()=>pin.focus(),50);
  }
  function showUnlock(){
    unlocked=false;
    const ui=shell('Введите код-пароль','Для входа в «Учёт дилеров» введите ваш код.');
    const pin=field('current','Код-пароль');ui.row.append(pin);
    const actions=document.createElement('div');actions.className='pinActions8948';
    const enter=button('Войти','primary',async()=>{
      if(busy)return;busy=true;enter.disabled=true;ui.error.textContent='';
      try{
        const ok=await unlock(pin.value);
        if(!ok){ui.error.textContent='Неверный код-пароль.';pin.value='';pin.focus()}
      }catch(e){ui.error.textContent=e.message||String(e)}
      finally{busy=false;enter.disabled=false}
    });
    actions.append(enter);ui.card.insertBefore(actions,ui.error);
    pin.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();enter.click()}});
    setTimeout(()=>pin.focus(),50);
  }
  function showChange(){
    if(!readCfg())return showSetup();
    const ui=shell('Сменить код-пароль','Введите текущий код и задайте новый код из 4–8 цифр.');
    const current=field('current','Текущий код');
    const next=field('new','Новый код');
    const confirmPin=field('new','Повторите новый код');
    ui.row.append(current,next,confirmPin);
    const actions=document.createElement('div');actions.className='pinActions8948';
    const cancel=button('Отмена','secondary',()=>removeOverlay());
    const save=button('Сменить код','primary',async()=>{
      if(busy)return;busy=true;save.disabled=true;ui.error.textContent='';
      try{await changePin(current.value,next.value,confirmPin.value)}
      catch(e){ui.error.textContent=e.message||String(e);current.focus();current.select()}
      finally{busy=false;save.disabled=false}
    });
    actions.append(cancel,save);ui.card.insertBefore(actions,ui.error);
    for(const input of [current,next,confirmPin])input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();save.click()}});
    setTimeout(()=>current.focus(),50);
  }
  function lock(){
    if(readCfg())showUnlock();else showSetup();
  }
  function installSettingsCard(){
    const updates=document.getElementById('updates');
    if(!updates||document.getElementById('pinSettings8948'))return;
    const card=document.createElement('div');card.id='pinSettings8948';card.className='card';
    card.innerHTML='<h3 style="margin-top:0">Код-пароль</h3><p class="muted">Защита входа включена на этом компьютере.</p><div class="actions"></div>';
    const actions=card.querySelector('.actions');
    actions.append(
      button('Сменить код-пароль','secondary',showChange),
      button('Заблокировать сейчас','secondary',lock)
    );
    updates.appendChild(card);
  }

  window.__pinLock8948={
    isConfigured:()=>!!readCfg(),
    isUnlocked:()=>unlocked,
    setInitialPin,
    unlock,
    changePin,
    lock,
    showChange
  };

  document.documentElement.dataset.pinLock='8.9.48';
  if(readCfg())showUnlock();else showSetup();
})();