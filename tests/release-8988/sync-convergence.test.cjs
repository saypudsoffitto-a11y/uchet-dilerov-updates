const {test}=require('node:test');
const assert=require('node:assert/strict');
const R=require('../../app/sync-convergence-8988');

const payment=(id,total)=>({id,type:'payment',dealerId:1,total});

test('independent local operation remains safe to send',()=>{
  const local=payment(20,30);
  const r=R.rebase([payment(10,50)],[{id:'20',before:null,after:local}]);
  assert.deepEqual(r.safe,[{id:'20',before:null,after:local}]);
  assert.deepEqual(r.conflicts,[]);
});

test('server-side change wins a three-way financial conflict',()=>{
  const before=payment(10,20),server=payment(10,30),local=payment(10,40);
  const r=R.rebase([server],[{id:'10',before,after:local}]);
  assert.deepEqual(r.safe,[]);
  assert.equal(r.conflicts.length,1);
  assert.equal(r.conflicts[0].server.total,30);
  assert.equal(r.conflicts[0].local.total,40);
});

test('already acknowledged operation is not resent',()=>{
  const op=payment(10,50);
  const r=R.rebase([op],[{id:'10',before:null,after:op}]);
  assert.deepEqual(r.safe,[]);
  assert.deepEqual(r.conflicts,[]);
});

test('deletion is sent only when server still matches the local baseline',()=>{
  const op=payment(10,50);
  assert.equal(R.rebase([op],[{id:'10',before:op,after:null}]).safe.length,1);
  const changed=payment(10,60);
  const conflict=R.rebase([changed],[{id:'10',before:op,after:null}]);
  assert.equal(conflict.safe.length,0);
  assert.equal(conflict.conflicts.length,1);
});

test('browser loads convergence helper before master sync',()=>{
  const fs=require('node:fs'),path=require('node:path');
  const index=fs.readFileSync(path.join(__dirname,'../../app/index.html'),'utf8');
  const master=fs.readFileSync(path.join(__dirname,'../../app/master-sync-8962.js'),'utf8');
  assert.ok(index.indexOf('sync-convergence-8988.js')<index.indexOf('master-sync-8962.js'));
  assert.match(master,/freshOperationChanges/);
  assert.match(master,/SyncConvergence8988\?\.rebase/);
  assert.match(master,/operationConflictRecovery/);
});
