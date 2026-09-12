const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const TOKEN = String(process.env.SYNC_TOKEN || '').trim();
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'state.json');
const MAX_BODY = 25 * 1024 * 1024;
const SERVER_VERSION = '8.9.41-sync2';

fs.mkdirSync(DATA_DIR, { recursive: true });

function mergeMarks(a, b) {
  const out = {};
  for (const src of [a || {}, b || {}]) {
    for (const [key, value] of Object.entries(src)) {
      out[String(key)] = Math.max(Number(out[String(key)] || 0), Number(value || 0));
    }
  }
  return out;
}

function sanitizeState(incoming, previous) {
  const state = incoming && typeof incoming === 'object' ? { ...incoming } : {};
  const prev = previous && typeof previous === 'object' ? previous : {};
  const deletedDealers = mergeMarks(prev.deletedDealers, state.deletedDealers);
  const dealers = Array.isArray(state.dealers) ? state.dealers : [];

  state.deletedDealers = deletedDealers;
  state.deletedDealerKeys = {};
  state.dealers = dealers.filter(d => d && !Object.prototype.hasOwnProperty.call(deletedDealers, String(d.id)));
  return state;
}

function readStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const rawState = parsed.state && typeof parsed.state === 'object' ? parsed.state : {};
    return {
      revision: Number(parsed.revision || 0),
      state: sanitizeState(rawState, rawState)
    };
  } catch (_) {
    return { revision: 0, state: {} };
  }
}

function writeStore(store) {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmp, DATA_FILE);
}

function groupDiagnostics(state) {
  const groups = Array.isArray(state && state.groups) ? state.groups : [];
  const products = Array.isArray(state && state.products) ? state.products : [];
  const normName = v => String(v || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru-RU');
  const ids = new Set(groups.map(g => String(g && g.id)));
  const byName = new Map();
  for (const g of groups) {
    if (!g) continue;
    const k = normName(g.name);
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push({ id: String(g.id), name: String(g.name || '') });
  }
  const duplicates = [...byName.values()].filter(list => list.length > 1);
  const orphanProducts = products.filter(p => p && !ids.has(String(p.groupId)));
  const usage = groups.map(g => ({ id: String(g.id), name: String(g.name || ''), products: products.filter(p => p && String(p.groupId) === String(g.id)).length }));
  return {
    groups: groups.length,
    uniqueNames: byName.size,
    duplicateSets: duplicates.length,
    duplicates,
    products: products.length,
    orphanProducts: orphanProducts.length,
    orphanGroupIds: [...new Set(orphanProducts.map(p => String(p.groupId)))],
    usage
  };
}

function logDiagnostics(prefix) {
  const store = readStore();
  const d = groupDiagnostics(store.state);
  console.log(prefix + ' GROUP_DIAG ' + JSON.stringify({ revision: store.revision, ...d }));
}

function send(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS'
  });
  res.end(data);
}

function authorized(req) {
  if (!TOKEN) return true;
  const auth = String(req.headers.authorization || '');
  return auth === 'Bearer ' + TOKEN;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('Слишком большой запрос'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8') || '{}';
        resolve(JSON.parse(text));
      } catch (_) {
        reject(new Error('Неверный JSON'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, 204, {});

    if (req.url === '/health' && req.method === 'GET') {
      const store = readStore();
      return send(res, 200, { ok: true, revision: store.revision, serverVersion: SERVER_VERSION });
    }

    if (req.url !== '/api/state') {
      return send(res, 404, { ok: false, message: 'Маршрут не найден' });
    }

    if (!authorized(req)) {
      return send(res, 401, { ok: false, message: 'Неверный секретный ключ' });
    }

    if (req.method === 'GET') {
      const store = readStore();
      return send(res, 200, { ok: true, revision: store.revision, state: store.state, serverVersion: SERVER_VERSION });
    }

    if (req.method === 'PUT') {
      const body = await readJsonBody(req);
      const current = readStore();
      const baseRevision = Number(body.baseRevision || 0);

      if (baseRevision !== current.revision) {
        return send(res, 409, {
          ok: false,
          conflict: true,
          revision: current.revision,
          state: current.state,
          serverVersion: SERVER_VERSION,
          message: 'База уже изменилась на другом компьютере'
        });
      }

      if (!body.state || typeof body.state !== 'object') {
        return send(res, 400, { ok: false, message: 'Не передано состояние базы' });
      }

      const nextState = sanitizeState(body.state, current.state);
      const next = {
        revision: current.revision + 1,
        state: nextState,
        serverVersion: SERVER_VERSION,
        updatedAt: new Date().toISOString()
      };
      writeStore(next);
      return send(res, 200, { ok: true, revision: next.revision, serverVersion: SERVER_VERSION });
    }

    return send(res, 405, { ok: false, message: 'Метод не поддерживается' });
  } catch (e) {
    return send(res, 500, { ok: false, message: String(e && e.message || e), serverVersion: SERVER_VERSION });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Учёт дилеров sync server ${SERVER_VERSION}: http://${HOST}:${PORT}`);
  console.log(TOKEN ? 'Авторизация по SYNC_TOKEN включена' : 'ВНИМАНИЕ: SYNC_TOKEN не задан');
  logDiagnostics('startup');
});
