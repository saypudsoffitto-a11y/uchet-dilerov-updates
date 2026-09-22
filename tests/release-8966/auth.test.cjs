// Final 8.9.66 candidate trigger: auth regression coverage.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../../app/main.js'),'utf8');
const start=source.indexOf("ipcMain.handle('sync:request'");
const end=source.indexOf("ipcMain.handle('update:installFromFile'",start);
for(const status of [401,403])test(`auth ${status}: identifies destination without revealing key or retrying write`,async()=>{
  let handler,calls=0;
  const context={URL,AbortController,setTimeout,clearTimeout,ipcMain:{handle:(_name,fn)=>{handler=fn;}},
    syncFetch:async(_url,options)=>{calls++;assert.equal(options.headers.Authorization,'Bearer private-example-token');return {ok:false,status,json:async()=>({message:'Неверный секретный ключ'})};}};
  vm.runInNewContext(source.slice(start,end),context);
  const result=await handler(null,{baseUrl:'https://example.invalid',token:'private-example-token',method:'PUT',body:{}});
  assert.equal(result.ok,false);assert.equal(result.code,'SYNC_AUTH_FAILED');assert.equal(result.status,status);
  assert.match(result.message,/example.invalid/);assert.doesNotMatch(JSON.stringify(result),/private-example-token/);assert.equal(calls,1);
});
