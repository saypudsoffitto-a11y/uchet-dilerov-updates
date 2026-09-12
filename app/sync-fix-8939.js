(()=>{
  'use strict';
  if(window.__syncFix8939Installed)return;

  const install=()=>{
    if(typeof syncPush!=='function'||typeof syncPull!=='function'||typeof syncBusy==='undefined'||typeof syncCfg!=='function')return false;

    const originalPush=syncPush;
    let retryTimer=null;
    let queuedManual=false;
    let queued=false;

    const schedule=manual=>{
      queued=true;
      queuedManual=queuedManual||!!manual;
      clearTimeout(retryTimer);
      retryTimer=setTimeout(()=>{
        retryTimer=null;
        reliablePush(queuedManual);
      },500);
    };

    const reliablePush=async function(manual){
      if(!syncCfg().url||(!manual&&!syncCfg().enabled))return;
      if(syncBusy){schedule(manual);return;}
      const runManual=!!manual||queuedManual;
      queued=false;
      queuedManual=false;
      await originalPush(runManual);
      if(queued)schedule(queuedManual);
    };

    window.syncPush=reliablePush;
    try{syncPush=reliablePush}catch(_){}

    // A successful connection is only a GET. Keep an explicit write queue so a
    // save that happens during that GET cannot be silently lost.
    window.__syncFix8939={
      originalPush,
      push:reliablePush,
      hasQueuedWrite:()=>queued,
      flush:()=>reliablePush(true)
    };
    window.__syncFix8939Installed=true;
    document.documentElement.dataset.syncFix='8.9.39';
    return true;
  };

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(install()||tries>120)clearInterval(timer);
  },100);
})();
