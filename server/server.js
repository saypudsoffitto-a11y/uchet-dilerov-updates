const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const TOKEN = String(process.env.SYNC_TOKEN || '').trim();
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'state.json');
const MAX_BODY = 25 * 1024 * 1024;

fs.mkdirSync(DATA_DIR, { recursive: true });

function readStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return {
      revision: Number(parsed.revision || 0),
      state: parsed.state && typeof parsed.state === 'object' ? parsed.state : {}
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
      return send(res, 200, { ok: true, revision: store.revision });
    }

    if (req.url !== '/api/state') {
      return send(res, 404, { ok: false, message: 'Маршрут не найден' });
    }

    if (!authorized(req)) {
      return send(res, 401, { ok: false, message: 'Неверный секретный ключ' });
    }

    if (req.method === 'GET') {
      const store = readStore();
      return send(res, 200, { ok: true, revision: store.revision, state: store.state });
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
          message: 'База уже изменилась на другом компьютере'
        });
      }

      if (!body.state || typeof body.state !== 'object') {
        return send(res, 400, { ok: false, message: 'Не передано состояние базы' });
      }

      const next = {
        revision: current.revision + 1,
        state: body.state,
        updatedAt: new Date().toISOString()
      };
      writeStore(next);
      return send(res, 200, { ok: true, revision: next.revision });
    }

    return send(res, 405, { ok: false, message: 'Метод не поддерживается' });
  } catch (e) {
    return send(res, 500, { ok: false, message: String(e && e.message || e) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Учёт дилеров sync server: http://${HOST}:${PORT}`);
  console.log(TOKEN ? 'Авторизация по SYNC_TOKEN включена' : 'ВНИМАНИЕ: SYNC_TOKEN не задан');
});
