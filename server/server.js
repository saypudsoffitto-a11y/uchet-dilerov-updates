const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const TOKEN = String(process.env.SYNC_TOKEN || '').trim();
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'state.json');
const MAX_BODY = 25 * 1024 * 1024;
const SERVER_VERSION = '8.9.48-sync2';

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

function normalizeDealerName(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/\u00a0/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/ё/g, 'е')
    .toLocaleLowerCase('ru-RU');
}

function normalizeDealerPhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 11 && digits[0] === '8') digits = '7' + digits.slice(1);
  if (digits.length === 10) digits = '7' + digits;
  return digits;
}

function dealerKey(dealer) {
  const name = normalizeDealerName(dealer && dealer.name);
  const phone = normalizeDealerPhone(dealer && dealer.phone);
  return name && phone ? name + '\u0000' + phone : '';
}

function dealerStamp(dealer) {
  const direct = Number(dealer && (dealer.updatedAt || dealer.ts) || 0);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const parsed = Date.parse(String(dealer && dealer.updatedAt || ''));
  if (Number.isFinite(parsed)) return parsed;
  const id = Number(dealer && dealer.id || 0);
  return Number.isFinite(id) ? id : 0;
}

function dealerScore(dealer) {
  return ['city','company','fio','address','email','www','clientGroup','paymentMethod','shippingMethod','note','photo','source']
    .reduce((sum, key) => sum + (String(dealer && dealer[key] || '').trim() ? 1 : 0), 0);
}

function mergeAliases(a, b) {
  const out = {};
  for (const src of [a || {}, b || {}]) {
    for (const [key, value] of Object.entries(src)) {
      const from = String(key);
      const to = String(value == null ? '' : value);
      if (from && to && from !== to) out[from] = to;
    }
  }
  return out;
}

function resolveAlias(aliases, id) {
  let current = String(id == null ? '' : id);
  const seen = new Set();
  for (let i = 0; i < 24 && current && aliases && aliases[current] && !seen.has(current); i++) {
    seen.add(current);
    current = String(aliases[current]);
  }
  return current;
}

function mergeDealerFields(target, source) {
  for (const key of ['phone','city','company','fio','address','email','www','clientGroup','paymentMethod','shippingMethod','note','photo','source']) {
    if (!String(target[key] || '').trim() && String(source[key] || '').trim()) target[key] = source[key];
  }
}

function canonicalizeDealerDuplicates(state) {
  state.dealers = Array.isArray(state.dealers) ? state.dealers : [];
  state.ops = Array.isArray(state.ops) ? state.ops : [];
  state.deletedDealers = state.deletedDealers && typeof state.deletedDealers === 'object' ? state.deletedDealers : {};
  state.dealerAliases = state.dealerAliases && typeof state.dealerAliases === 'object' ? state.dealerAliases : {};

  for (const op of state.ops) {
    if (!op || op.dealerId == null) continue;
    const target = resolveAlias(state.dealerAliases, op.dealerId);
    if (target && target !== String(op.dealerId)) op.dealerId = /^\d+$/.test(target) ? Number(target) : target;
  }

  const usage = new Map();
  for (const op of state.ops) {
    if (!op || op.dealerId == null) continue;
    const key = String(op.dealerId);
    usage.set(key, (usage.get(key) || 0) + 1);
  }

  const buckets = new Map();
  for (const dealer of state.dealers) {
    if (!dealer) continue;
    const key = dealerKey(dealer);
    if (!key) continue;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(dealer);
  }

  const remove = new Set();
  const now = Date.now();
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const ranked = list.slice().sort((a, b) =>
      (usage.get(String(b.id)) || 0) - (usage.get(String(a.id)) || 0) ||
      dealerScore(b) - dealerScore(a) ||
      dealerStamp(b) - dealerStamp(a) ||
      String(a.id).localeCompare(String(b.id), undefined, { numeric: true })
    );
    const canonical = ranked[0];
    for (const duplicate of ranked.slice(1)) {
      const duplicateId = String(duplicate.id);
      const canonicalId = String(canonical.id);
      mergeDealerFields(canonical, duplicate);
      state.dealerAliases[duplicateId] = canonicalId;
      state.deletedDealers[duplicateId] = Math.max(Number(state.deletedDealers[duplicateId] || 0), now);
      remove.add(duplicateId);
    }
  }

  for (const key of Object.keys(state.dealerAliases)) {
    const target = resolveAlias(state.dealerAliases, key);
    if (!target || target === key) delete state.dealerAliases[key];
    else state.dealerAliases[key] = target;
  }
  for (const op of state.ops) {
    if (!op || op.dealerId == null) continue;
    const target = resolveAlias(state.dealerAliases, op.dealerId);
    if (target && target !== String(op.dealerId)) op.dealerId = /^\d+$/.test(target) ? Number(target) : target;
  }
  if (remove.size) state.dealers = state.dealers.filter(d => d && !remove.has(String(d.id)));
  return state;
}

function sanitizeState(incoming, previous) {
  const state = incoming && typeof incoming === 'object' ? { ...incoming } : {};
  const prev = previous && typeof previous === 'object' ? previous : {};
  const deletedDealers = mergeMarks(prev.deletedDealers, state.deletedDealers);
  state.deletedDealers = deletedDealers;
  state.deletedDealerKeys = {};
  state.dealerAliases = mergeAliases(prev.dealerAliases, state.dealerAliases);
  const dealers = Array.isArray(state.dealers) ? state.dealers : [];
  state.dealers = dealers.filter(d => d && !Object.prototype.hasOwnProperty.call(deletedDealers, String(d.id)));
  canonicalizeDealerDuplicates(state);
  state.dealers = state.dealers.filter(d => d && !Object.prototype.hasOwnProperty.call(state.deletedDealers, String(d.id)));
  return state;
}

function readStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const rawState = parsed.state && typeof parsed.state === 'object' ? parsed.state : {};
    return { revision: Number(parsed.revision || 0), state: sanitizeState(rawState, rawState) };
  } catch (_) {
    return { revision: 0, state: {} };
  }
}

function writeStore(store) {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmp, DATA_FILE);
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
  return String(req.headers.authorization || '') === 'Bearer ' + TOKEN;
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
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
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
    if (req.url !== '/api/state') return send(res, 404, { ok: false, message: 'Маршрут не найден' });
    if (!authorized(req)) return send(res, 401, { ok: false, message: 'Неверный секретный ключ' });
    if (req.method === 'GET') {
      const store = readStore();
      return send(res, 200, { ok: true, revision: store.revision, state: store.state, serverVersion: SERVER_VERSION });
    }
    if (req.method === 'PUT') {
      const body = await readJsonBody(req);
      const current = readStore();
      const baseRevision = Number(body.baseRevision || 0);
      if (baseRevision !== current.revision) {
        return send(res, 409, { ok: false, conflict: true, revision: current.revision, state: current.state, serverVersion: SERVER_VERSION, message: 'База уже изменилась на другом компьютере' });
      }
      if (!body.state || typeof body.state !== 'object') return send(res, 400, { ok: false, message: 'Не передано состояние базы' });
      const nextState = sanitizeState(body.state, current.state);
      const next = { revision: current.revision + 1, state: nextState, serverVersion: SERVER_VERSION, updatedAt: new Date().toISOString() };
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
});
