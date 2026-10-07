(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SyncHealth8987=api;
})(typeof window==='object'?window:globalThis,()=>{
  'use strict';

  const transientStatuses=new Set([408,425,429,500,502,503,504]);
  const transientText=/timeout|timed out|network|fetch failed|socket|econn|enet|enotfound|etimedout|eai_again|dns|сервер не ответил|ошибка связи|нет ответа сервера|temporar|connection reset|connection refused/i;

  function isTransientMessage(message){
    return transientText.test(String(message||''));
  }

  function isTransientResult(result){
    if(result?.ok)return false;
    const status=Number(result?.status||0);
    return transientStatuses.has(status)||(!status&&isTransientMessage(result?.message));
  }

  function retryDelay(attempt){
    return attempt<=1?500:1200;
  }

  function create(options={}){
    const failureThreshold=Math.max(2,Number(options.failureThreshold)||3);
    let consecutiveFailures=0;
    let lastSuccessAt=0;
    let lastError='';

    return {
      success(now=Date.now()){
        consecutiveFailures=0;
        lastSuccessAt=Number(now)||Date.now();
        lastError='';
        return {state:'online',failures:0,lastSuccessAt,lastError};
      },
      failure(message,now=Date.now()){
        consecutiveFailures++;
        lastError=String(message||'Нет ответа сервера');
        return {
          state:consecutiveFailures>=failureThreshold?'offline':'degraded',
          failures:consecutiveFailures,
          failureThreshold,
          lastSuccessAt,
          lastFailureAt:Number(now)||Date.now(),
          lastError
        };
      },
      snapshot(){
        return {failures:consecutiveFailures,failureThreshold,lastSuccessAt,lastError};
      }
    };
  }

  return {create,isTransientMessage,isTransientResult,retryDelay};
});
