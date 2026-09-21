const fs = require('fs');
const path = require('path');

function normalizeStore(value) {
  const store = value && typeof value === 'object' ? { ...value } : {};
  store.revision = Number(store.revision || 0);
  store.state = store.state && typeof store.state === 'object' ? store.state : {};
  return store;
}

function createFileStore(dataFile) {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });

  return {
    kind: 'file',
    async read() {
      try {
        return normalizeStore(JSON.parse(fs.readFileSync(dataFile, 'utf8')));
      } catch (_) {
        return { revision: 0, state: {} };
      }
    },
    async writeIfRevision(expectedRevision, nextStore) {
      const current = await this.read();
      const expected = Number(expectedRevision || 0);
      if (Number(current.revision || 0) !== expected) {
        return { ok: false, conflict: true, revision: Number(current.revision || 0), store: current };
      }
      const next = normalizeStore(nextStore);
      next.revision = expected + 1;
      next.updatedAt = String(next.updatedAt || new Date().toISOString());
      const tmp = dataFile + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8');
      fs.renameSync(tmp, dataFile);
      return { ok: true, revision: next.revision, store: next };
    }
  };
}

function createTursoStore(url, authToken) {
  const { createClient } = require('@tursodatabase/serverless/compat');
  const client = createClient({ url, authToken });
  let initPromise = null;

  async function init() {
    if (!initPromise) {
      initPromise = (async () => {
        await client.execute(`
          CREATE TABLE IF NOT EXISTS uchet_store (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            revision INTEGER NOT NULL,
            store_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )
        `);
        const empty = JSON.stringify({ revision: 0, state: {} });
        await client.execute({
          sql: 'INSERT INTO uchet_store (id, revision, store_json, updated_at) VALUES (1, 0, ?, ?) ON CONFLICT(id) DO NOTHING',
          args: [empty, new Date().toISOString()]
        });
      })();
    }
    return initPromise;
  }

  return {
    kind: 'turso',
    async read() {
      await init();
      const rs = await client.execute('SELECT revision, store_json FROM uchet_store WHERE id = 1');
      const row = rs.rows && rs.rows[0];
      if (!row) return { revision: 0, state: {} };
      const revision = Number(row.revision ?? row[0] ?? 0);
      const raw = String(row.store_json ?? row[1] ?? '{}');
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (_) {
        throw new Error('В Turso повреждена общая база');
      }
      const store = normalizeStore(parsed);
      store.revision = revision;
      return store;
    },
    async writeIfRevision(expectedRevision, nextStore) {
      await init();
      const expected = Number(expectedRevision || 0);
      const next = normalizeStore(nextStore);
      next.revision = expected + 1;
      next.updatedAt = String(next.updatedAt || new Date().toISOString());
      const rs = await client.execute({
        sql: 'UPDATE uchet_store SET revision = ?, store_json = ?, updated_at = ? WHERE id = 1 AND revision = ?',
        args: [next.revision, JSON.stringify(next), next.updatedAt, expected]
      });
      if (Number(rs.rowsAffected || 0) !== 1) {
        const current = await this.read();
        return { ok: false, conflict: true, revision: current.revision, store: current };
      }
      return { ok: true, revision: next.revision, store: next };
    }
  };
}

function createStore({ dataFile }) {
  const url = String(process.env.TURSO_DATABASE_URL || '').trim();
  const authToken = String(process.env.TURSO_AUTH_TOKEN || '').trim();

  if (Boolean(url) !== Boolean(authToken)) {
    throw new Error('TURSO_DATABASE_URL и TURSO_AUTH_TOKEN должны быть заданы вместе');
  }
  if (url && authToken) return createTursoStore(url, authToken);
  return createFileStore(dataFile);
}

module.exports = { createStore, normalizeStore };
