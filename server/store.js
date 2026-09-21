const fs = require('fs');
const path = require('path');

function createFileStore(dataFile) {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });

  return {
    kind: 'file',
    async read() {
      try {
        const parsed = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
        return {
          revision: Number(parsed.revision || 0),
          state: parsed.state && typeof parsed.state === 'object' ? parsed.state : {}
        };
      } catch (_) {
        return { revision: 0, state: {} };
      }
    },
    async writeIfRevision(expectedRevision, state) {
      const current = await this.read();
      if (Number(current.revision || 0) !== Number(expectedRevision || 0)) {
        return { ok: false, conflict: true, revision: Number(current.revision || 0) };
      }
      const nextRevision = Number(expectedRevision || 0) + 1;
      const next = {
        revision: nextRevision,
        state: state && typeof state === 'object' ? state : {},
        updatedAt: new Date().toISOString()
      };
      const tmp = dataFile + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8');
      fs.renameSync(tmp, dataFile);
      return { ok: true, revision: nextRevision };
    }
  };
}

function createTursoStore(url, authToken) {
  const { createClient } = require('@libsql/client');
  const client = createClient({ url, authToken });
  let initPromise = null;

  async function init() {
    if (!initPromise) {
      initPromise = (async () => {
        await client.execute(`
          CREATE TABLE IF NOT EXISTS uchet_state (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            revision INTEGER NOT NULL,
            state_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )
        `);
        await client.execute({
          sql: 'INSERT INTO uchet_state (id, revision, state_json, updated_at) VALUES (1, 0, ?, ?) ON CONFLICT(id) DO NOTHING',
          args: ['{}', new Date().toISOString()]
        });
      })();
    }
    return initPromise;
  }

  return {
    kind: 'turso',
    async read() {
      await init();
      const rs = await client.execute('SELECT revision, state_json FROM uchet_state WHERE id = 1');
      const row = rs.rows && rs.rows[0];
      if (!row) return { revision: 0, state: {} };
      const revision = Number(row.revision ?? row[0] ?? 0);
      const raw = String(row.state_json ?? row[1] ?? '{}');
      let state = {};
      try {
        state = JSON.parse(raw);
      } catch (_) {
        throw new Error('В Turso повреждено состояние базы');
      }
      return { revision, state: state && typeof state === 'object' ? state : {} };
    },
    async writeIfRevision(expectedRevision, state) {
      await init();
      const expected = Number(expectedRevision || 0);
      const nextRevision = expected + 1;
      const rs = await client.execute({
        sql: 'UPDATE uchet_state SET revision = ?, state_json = ?, updated_at = ? WHERE id = 1 AND revision = ?',
        args: [nextRevision, JSON.stringify(state && typeof state === 'object' ? state : {}), new Date().toISOString(), expected]
      });
      if (Number(rs.rowsAffected || 0) !== 1) {
        const current = await this.read();
        return { ok: false, conflict: true, revision: current.revision };
      }
      return { ok: true, revision: nextRevision };
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

module.exports = { createStore };
