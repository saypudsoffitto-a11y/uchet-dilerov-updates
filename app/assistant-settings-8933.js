(()=>{
  try{
    if(localStorage.getItem('uchetAssistantVoiceEnabled8933'))return;
    const key='uchetAssistant8921';
    let s={};try{s=JSON.parse(localStorage.getItem(key)||'{}')||{}}catch(_){s={}}
    s.speak=true;
    localStorage.setItem(key,JSON.stringify(s));
    localStorage.setItem('uchetAssistantVoiceEnabled8933','1');
  }catch(_){}
})();
