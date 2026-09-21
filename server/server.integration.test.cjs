'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const port = s.address().port;
      s.close(() => resolve(port));
    });
  });
}

async function request(base, method, body) {
  const r = await fetch(base + '/api/state', {
    method,
    headers: {
      'Authorization': 'Bearer test-sync-key',
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: r.status, data: await r.json() };
}

async function waitHealth(base, child) {
  let last = '';
  for (let i = 0; i < 80; i++) {
    if (child.exitCode != null) throw new Error('server exited before health check: ' + child.exitCode);
    try {
      const r = await fetch(base + '/health');
      if (r.ok) return await r.json();
      last = 'HTTP ' + r.status;
    } catch (e) {
      last = String(e && e.message || e);
    }
    await new Promise(r => setTimeout(r, 75));
  }
  throw new Error('health timeout: ' + last);
}

test('empty central base can be initialized once by primary PC', async (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'uchet-server-'));
  const port = await freePort();
  const base = 'http://127.0.0.1:' + port;
  const env = { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: tmp, SYNC_TOKEN: 'test-sync-key' };
  delete env.TURSO_DATABASE_URL;
  delete env.TURSO_AUTH_TOKEN;

  const child = spawn(process.execPath, ['server.js'], { cwd: __dirname, env, stdio: ['ignore','pipe','pipe'] });
  let output = '';
  child.stdout.on('data', d => output += d);
  child.stderr.on('data', d => output += d);
  t.after(() => {
    try { child.kill(); } catch (_) {}
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  });

  const health = await waitHealth(base, child);
  assert.equal(health.revision, 0);
  assert.equal(health.storage, 'file');

  const state = {
    dealers: [{ id: 10, name: 'Главный дилер', phone: '89990000000' }],
    products: [{ id: 20, name: 'Полотно', article: 'A20' }],
    groups: [],
    ops: [],
    sync: { enabled: true }
  };

  const first = await request(base, 'PUT', {
    initialize: true,
    baseRevision: 999,
    deviceId: 'device-main-1',
    deviceName: 'Компьютер 1 · Главный',
    state
  });
  assert.equal(first.status, 200, output);
  assert.equal(first.data.initialized, true);
  assert.equal(first.data.revision, 1);
  assert.equal(first.data.primaryDeviceId, 'device-main-1');

  const loaded = await request(base, 'GET');
  assert.equal(loaded.status, 200, output);
  assert.equal(loaded.data.revision, 1);
  assert.equal(loaded.data.state.dealers.length, 1);
  assert.equal(loaded.data.state.sync.primaryDeviceId, 'device-main-1');
  assert.equal(loaded.data.state.sync.primaryDeviceName, 'Компьютер 1 · Главный');

  const second = await request(base, 'PUT', {
    initialize: true,
    baseRevision: 0,
    deviceId: 'device-secondary',
    deviceName: 'Компьютер 2',
    state: { dealers: [{ id: 999, name: 'Старый дубль' }], products: [], groups: [], ops: [] }
  });
  assert.equal(second.status, 409, output);
  assert.equal(second.data.initializationBlocked, true);

  const after = await request(base, 'GET');
  assert.equal(after.data.state.dealers.length, 1);
  assert.equal(after.data.state.dealers[0].name, 'Главный дилер');
});
