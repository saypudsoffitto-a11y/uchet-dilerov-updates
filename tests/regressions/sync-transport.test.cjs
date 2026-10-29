'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../../app/main.js'),'utf8');
const start=source.indexOf("ipcMain.handle('sync:request'");
const end=source.indexOf("ipcMain.handle('update:installFromFile'",start);

function transport(fetchResponse){
  let handler,deadline,cleared=0,calls=0,signal;
  const context={URL,AbortController,
    setTimeout:fn=>{deadline=fn;return 1;},
    clearTimeout:()=>{cleared++;},
    ipcMain:{handle:(_name,fn)=>{handler=fn;}},
    syncFetch:async(url,options)=>{calls++;signal=options.signal;return fetchResponse(url,options);}};
  vm.runInNewContext(source.slice(start,end),context);
  return {request:(method='GET',body={})=>handler(null,{baseUrl:'https://sync.example',token:'private-token',method,body}),
    expire:()=>deadline(),get cleared(){return cleared;},get calls(){return calls;},get signal(){return signal;}};
}
const json=(status,data)=>({ok:status>=200&&status<300,status,json:async()=>data});
const html=status=>({ok:status>=200&&status<300,status,json:async()=>{throw new SyntaxError('<html>private-token</html>');}});

test('background reads carry a safe revision in the query and never a GET body',async()=>{
  for(const revision of [0,7,Number.MAX_SAFE_INTEGER]){
    const result={ok:true,notModified:true,revision,protocol:2,storage:'turso'};
    const h=transport((url,options)=>{
      assert.equal(new URL(url).pathname,'/api/state');
      assert.equal(new URL(url).searchParams.get('knownRevision'),String(revision));
      assert.equal(options.body,undefined);
      assert.equal(options.headers.Authorization,'Bearer private-token');
      return json(200,result);
    });
    assert.equal(await h.request('GET',{knownRevision:revision}),result);
  }
});

test('invalid revision hints and write payloads do not suppress full server reads',async()=>{
  for(const method of ['GET','PUT'])for(const revision of [undefined,null,-1,1.5,'7',NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){
    const h=transport((url,options)=>{
      assert.equal(new URL(url).searchParams.has('knownRevision'),false);
      if(method==='GET')assert.equal(options.body,undefined);
      return json(200,{ok:true});
    });
    await h.request(method,{knownRevision:revision});
  }
  const h=transport((url,options)=>{
    assert.equal(new URL(url).searchParams.has('knownRevision'),false);
    assert.equal(JSON.parse(options.body).knownRevision,7);
    return json(200,{ok:true});
  });
  await h.request('PUT',{knownRevision:7});
});

test('Render suspension has an actionable message without exposing the HTML body',async()=>{
  let bodyRead=false;
  const h=transport(()=>({ok:false,status:503,headers:{get:name=>name==='x-render-routing'?'suspend-by-user':null},
    json:async()=>{bodyRead=true;throw new SyntaxError('<html>private-token</html>');}}));
  const result=await h.request();
  assert.equal(result.code,'SYNC_SERVICE_SUSPENDED');
  assert.equal(result.status,503);
  assert.match(result.message,/приостановлен хостингом/);
  assert.doesNotMatch(JSON.stringify(result),/private-token|<html>/);
  assert.equal(bodyRead,false);
  assert.equal(h.cleared,1);
});

test('HTML 503 remains a retryable HTTP result and never exposes HTML or credentials',async()=>{
  const h=transport(()=>html(503));
  const result=await h.request('PUT');
  assert.equal(result.ok,false);
  assert.equal(result.status,503);
  assert.equal(result.code,'SYNC_HTTP_ERROR');
  assert.match(result.message,/HTTP 503/);
  assert.doesNotMatch(JSON.stringify(result),/private-token|<html>/);
  assert.equal(h.calls,1,'transport never retries a write');
  assert.equal(h.cleared,1);
  assert.equal(require('../../app/sync-health-8987').isTransientResult(result),true);
});

test('successful HTTP with HTML, null, arrays or wrong JSON shape is an explicit failure',async()=>{
  for(const response of [html(200),json(200,null),json(200,[]),json(200,{message:'private-token'})]){
    const h=transport(()=>response);
    const result=await h.request();
    assert.equal(result.ok,false);
    assert.equal(result.status,200);
    assert.equal(result.code,'SYNC_INVALID_RESPONSE');
    assert.doesNotMatch(JSON.stringify(result),/private-token|<html>/);
  }
});

test('JSON business validation errors keep their safe explanation and HTTP status',async()=>{
  const message='Обновите этот компьютер до 8.9.63. Старые списки не приняты.';
  const result=await transport(()=>json(422,{ok:false,message})).request('PUT');
  assert.equal(result.ok,false);
  assert.equal(result.status,422);
  assert.equal(result.message,message);
});

test('JSON error messages reject markup, control characters, oversized text and the access key',async()=>{
  for(const message of ['<html>Service unavailable</html>','error\u0000detail','error\nsecond line','a'.repeat(401),'invalid private-token']){
    const result=await transport(()=>json(422,{ok:false,message})).request('PUT');
    assert.equal(result.status,422);
    assert.match(result.message,/HTTP 422/);
    assert.doesNotMatch(result.message,/[<>\u0000-\u001f\u007f-\u009f]/);
    assert.doesNotMatch(JSON.stringify(result),/private-token/);
  }
});

test('valid state, conflict and auth responses keep the IPC result contract',async()=>{
  const state={ok:true,protocol:2,storage:'turso',revision:9,state:{dealers:[]}};
  assert.equal(await transport(()=>json(200,state)).request(),state);
  const conflict=await transport(()=>json(409,{revision:10,state:state.state})).request('PUT');
  assert.equal(conflict.conflict,true);
  assert.equal(conflict.revision,10);
  assert.equal(conflict.state,state.state);
  assert.equal((await transport(()=>html(409)).request()).conflict,undefined);
  for(const status of [401,403]){
    const result=await transport(()=>html(status)).request('PUT');
    assert.equal(result.code,'SYNC_AUTH_FAILED');
    assert.equal(result.status,status);
  }
});

test('response body is covered by the deadline even after headers arrived',async()=>{
  let started;
  const bodyStarted=new Promise(resolve=>{started=resolve;});
  const h=transport((_url,options)=>({ok:true,status:200,json:()=>new Promise((resolve,reject)=>{
    options.signal.addEventListener('abort',()=>{const error=new Error('private-token');error.name='AbortError';reject(error);});
    started();
  })}));
  const pending=h.request();
  await bodyStarted;
  assert.equal(h.cleared,0);
  h.expire();
  const result=await pending;
  assert.equal(h.signal.aborted,true);
  assert.equal(result.code,'SYNC_TIMEOUT');
  assert.equal(h.cleared,1);
  assert.doesNotMatch(JSON.stringify(result),/private-token/);
});

test('broken response streams remain network errors without leaking exception details',async()=>{
  const h=transport(()=>({ok:true,status:200,json:async()=>{throw new TypeError('private-token <html>');}}));
  const result=await h.request();
  assert.equal(result.code,'SYNC_NETWORK_ERROR');
  assert.doesNotMatch(JSON.stringify(result),/private-token|<html>/);
  assert.equal(h.cleared,1);
});

test('an aborted Electron fetch never falls back to a second request',async()=>{
  const controller=new AbortController();
  let fallbackCalls=0;
  const context={net:{fetch:async()=>{controller.abort();const error=new Error('aborted');error.name='AbortError';throw error;}},
    fetch:async()=>{fallbackCalls++;}};
  vm.runInNewContext(source.slice(source.indexOf('async function syncFetch'),start),context);
  await assert.rejects(context.syncFetch('https://sync.example/api/state',{signal:controller.signal}),{name:'AbortError'});
  assert.equal(fallbackCalls,0);
});

test('a lost PUT response never triggers a second write through Node fetch',async()=>{
  let handler,electronCalls=0,fallbackCalls=0;
  const context={URL,AbortController,setTimeout,clearTimeout,
    ipcMain:{handle:(_name,fn)=>{handler=fn;}},
    net:{fetch:async(_url,options)=>{electronCalls++;assert.equal(options.method,'PUT');throw new TypeError('lost response private-token');}},
    fetch:async()=>{fallbackCalls++;return json(200,{ok:true});}};
  vm.runInNewContext(source.slice(source.indexOf('async function syncFetch'),end),context);
  const result=await handler(null,{baseUrl:'https://sync.example',method:'PUT',token:'private-token',body:{baseRevision:9}});
  assert.equal(electronCalls,1);
  assert.equal(fallbackCalls,0);
  assert.equal(result.ok,false);
  assert.equal(result.code,'SYNC_NETWORK_ERROR');
  assert.doesNotMatch(JSON.stringify(result),/private-token|lost response/);
});

test('a GET can recover through Node fetch after an Electron network error',async()=>{
  let fallbackCalls=0;
  const response=json(200,{ok:true,revision:9});
  const context={net:{fetch:async()=>{throw new TypeError('Electron network unavailable');}},
    fetch:async()=>{fallbackCalls++;return response;}};
  vm.runInNewContext(source.slice(source.indexOf('async function syncFetch'),start),context);
  assert.equal(await context.syncFetch('https://sync.example/api/state',{method:'GET'}),response);
  assert.equal(fallbackCalls,1);
});
