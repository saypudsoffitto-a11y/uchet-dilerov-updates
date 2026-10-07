const {test}=require('node:test');
const assert=require('node:assert/strict');
const H=require('../../app/sync-health-8987');

test('single transient failure does not declare the server offline',()=>{
  const health=H.create({failureThreshold:3});
  health.success(1000);
  const first=health.failure('Сервер не ответил за 12 секунд',2000);
  assert.equal(first.state,'degraded');
  assert.equal(first.failures,1);
});

test('three consecutive failures are required before offline status',()=>{
  const health=H.create({failureThreshold:3});
  assert.equal(health.failure('fetch failed').state,'degraded');
  assert.equal(health.failure('fetch failed').state,'degraded');
  const third=health.failure('fetch failed');
  assert.equal(third.state,'offline');
  assert.equal(third.failures,3);
});

test('successful reconnect immediately resets failure streak',()=>{
  const health=H.create({failureThreshold:3});
  health.failure('fetch failed');
  health.failure('fetch failed');
  assert.equal(health.success(5000).state,'online');
  const next=health.failure('fetch failed');
  assert.equal(next.state,'degraded');
  assert.equal(next.failures,1);
});

test('only transient read failures qualify for automatic retry',()=>{
  assert.equal(H.isTransientResult({ok:false,status:503,message:'Service unavailable'}),true);
  assert.equal(H.isTransientResult({ok:false,message:'Сервер не ответил за 12 секунд'}),true);
  assert.equal(H.isTransientResult({ok:false,status:401,message:'Неверный ключ'}),false);
  assert.equal(H.isTransientResult({ok:false,status:409,message:'Конфликт'}),false);
  assert.equal(H.isTransientResult({ok:true,status:200}),false);
});

test('retry backoff stays short for interactive reconnects',()=>{
  assert.equal(H.retryDelay(1),500);
  assert.equal(H.retryDelay(2),1200);
});
