'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const { createStore } = require('./store');

test('file fallback persists state and rejects stale revision writes', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uchet-store-'));
  const file = path.join(dir, 'state.json');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const store = createStore({ dataFile: file });
  assert.equal(store.kind, 'file');

  const initial = await store.read();
  assert.equal(initial.revision, 0);
  assert.deepEqual(initial.state, {});

  const first = await store.writeIfRevision(0, { dealers: [{ id: 1, name: 'Тест' }] });
  assert.deepEqual(first, { ok: true, revision: 1 });

  const loaded = await store.read();
  assert.equal(loaded.revision, 1);
  assert.equal(loaded.state.dealers[0].name, 'Тест');

  const stale = await store.writeIfRevision(0, { dealers: [] });
  assert.equal(stale.ok, false);
  assert.equal(stale.conflict, true);
  assert.equal(stale.revision, 1);

  const stillLoaded = await store.read();
  assert.equal(stillLoaded.state.dealers[0].name, 'Тест');
});

test('Turso configuration requires URL and token together', () => {
  const oldUrl = process.env.TURSO_DATABASE_URL;
  const oldToken = process.env.TURSO_AUTH_TOKEN;
  try {
    process.env.TURSO_DATABASE_URL = 'libsql://example.turso.io';
    delete process.env.TURSO_AUTH_TOKEN;
    assert.throws(() => createStore({ dataFile: path.join(os.tmpdir(), 'unused-state.json') }), /должны быть заданы вместе/);
  } finally {
    if (oldUrl === undefined) delete process.env.TURSO_DATABASE_URL; else process.env.TURSO_DATABASE_URL = oldUrl;
    if (oldToken === undefined) delete process.env.TURSO_AUTH_TOKEN; else process.env.TURSO_AUTH_TOKEN = oldToken;
  }
});
