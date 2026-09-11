'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repoRoot = path.resolve(__dirname, '../..');
const appDir = path.join(repoRoot, 'app');

function bootDealerFix() {
  const source = fs.readFileSync(path.join(appDir, 'dealer-fix-8935.js'), 'utf8');
  const persisted = [];
  const confirms = [];
  let saveCalls = 0;
  let syncPushCalls = 0;
  let intervalFn = null;
  const now = Date.now();

  const state = {
    dealers: [{ id: 101, name: 'Тестовый дилер', phone: '+7 999 123-45-67', city: 'Махачкала', company: 'Тест', updatedAt: now - 5000 }],
    ops: [{ id: now - 4000, dealerId: 101, type: 'sale', amount: 1500 }],
    sync: { url: 'https://example.invalid/sync' }
  };

  const ctx = {
    console,
    state,
    KEY: 'dealer-state',
    norm: x => x || {},
    save: () => { saveCalls += 1; },
    syncPush: () => { syncPushCalls += 1; },
    confirm: msg => { confirms.push(msg); return true; },
    localStorage: { setItem: (k, v) => persisted.push([k, v]) },
    render: () => {}, renderDealers: () => {}, renderDebts: () => {}, closeDealerModal: () => {}, openDealerForEdit: () => {},
    document: {
      documentElement: { dataset: {} },
      getElementById: () => null,
      createElement: () => ({ style: {}, append: () => {}, remove: () => {} }),
      body: { appendChild: () => {} }
    },
    window: { innerWidth: 1200, innerHeight: 800 },
    setTimeout: fn => { fn(); return 1; },
    setInterval: fn => { intervalFn = fn; return 1; },
    clearInterval: () => {},
    mergeSyncState: (remote, local) => ({
      ...(remote || {}),
      dealers: [...((remote && remote.dealers) || []), ...((local && local.dealers) || [])],
      ops: [...((remote && remote.ops) || []), ...((local && local.ops) || [])]
    })
  };
  vm.createContext(ctx);
  vm.runInContext(source, ctx, { filename: 'dealer-fix-8935.js' });
  assert.equal(typeof intervalFn, 'function');
  intervalFn();
  return { ctx, state, persisted, confirms, counts: () => ({ saveCalls, syncPushCalls }) };
}

test('8.9.35 реально удаляет дилера после двух подтверждений и сохраняет историю', () => {
  const { ctx, state, persisted, confirms, counts } = bootDealerFix();
  assert.equal(typeof ctx.window.deleteDealerPermanent8935, 'function');
  const ok = ctx.window.deleteDealerPermanent8935(101);
  assert.equal(ok, true);
  assert.equal(state.dealers.some(d => d.id === 101), false);
  assert.equal(state.ops.length, 1);
  assert.equal(state.ops[0].dealer, 'Тестовый дилер');
  assert.equal(state.ops[0].dealerPhone, '+7 999 123-45-67');
  assert.equal(confirms.length, 2);
  assert.ok(Number(state.deletedDealers['101']) > 0);
  assert.ok(Number(state.deletedDealerKeys['p:79991234567']) > 0);
  assert.ok(persisted.length >= 2);
  assert.ok(counts().saveCalls >= 1);
  assert.ok(counts().syncPushCalls >= 1);
});

test('8.9.35 tombstone не даёт удалённому дилеру вернуться после синхронизации', () => {
  const { ctx, state } = bootDealerFix();
  assert.equal(ctx.window.deleteDealerPermanent8935(101), true);
  const deletedAt = state.deletedDealers['101'];
  const remote = { dealers: [{ id: 101, name: 'Тестовый дилер', phone: '+7 999 123-45-67', updatedAt: deletedAt - 1000 }], deletedDealers: {}, deletedDealerKeys: {} };
  const merged = ctx.window.mergeSyncState(remote, JSON.parse(JSON.stringify(state)));
  assert.equal(merged.dealers.some(d => d.id === 101), false);
  assert.equal(Number(merged.deletedDealers['101']), Number(deletedAt));
});

test('8.9.35 не упаковывает голосового помощника', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'));
  const files = pkg.build.files.map(String);
  const forbidden = ['assistant-8921.js','assistant-enhancements.js','assistant-settings-8933.js','audio-fix-8933.js','audio-service.js','audio-ui.js','speech-fallback-8933.js'];
  for (const name of forbidden) assert.equal(files.includes(name), false, `${name} не должен попадать в сборку`);
  assert.equal(pkg.main, 'main-8935.js');
});

test('8.9.35 main entry не подключает голосовые модули', () => {
  const main = fs.readFileSync(path.join(appDir, 'main-8935.js'), 'utf8');
  assert.doesNotMatch(main, /assistant|audio|speech/i);
});
