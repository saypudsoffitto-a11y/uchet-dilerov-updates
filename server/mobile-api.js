'use strict';
const crypto = require('node:crypto');
const C = require('./sync-core-8962');
const fail = (message, status = 422) => { throw Object.assign(new Error(message), { status }); };
function text(value, max, label, required = false) {
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) fail('Проверьте поле «' + label + '»');
  return value.trim();
}
function command(body) {
  if (!body || !/^[a-zA-Z0-9-]{16,80}$/.test(body.requestId || '')) fail('Неверный номер запроса');
  if (body.action === 'payment') {
    if (!Number.isSafeInteger(body.amountKopecks) || body.amountKopecks <= 0 || body.amountKopecks > 100000000000) fail('Укажите сумму от 0,01 до 1 000 000 000 рублей');
    if (!['Наличные', 'Перевод'].includes(body.method)) fail('Выберите способ оплаты');
    if (!Number.isSafeInteger(body.dealerId) || body.dealerId <= 0) fail('Выберите дилера');
    return { action: body.action, dealerId: body.dealerId, amountKopecks: body.amountKopecks, method: body.method, note: text(body.note ?? '', 1000, 'Примечание') };
  }
  if (body.action === 'dealer') {
    const phone = C.phone(text(body.phone, 32, 'Телефон', true));
    if (!/^[1-9]\d{9,14}$/.test(phone)) fail('Укажите полный номер телефона');
    return { action: body.action, name: text(body.name, 120, 'Имя', true), phone, city: text(body.city ?? '', 120, 'Город'), note: text(body.note ?? '', 1000, 'Примечание') };
  }
  fail('Неизвестная операция');
}
function balance(state, id) {
  return (state.ops || []).filter(o => String(o.dealerId) === String(id)).reduce((sum, o) => {
    const cents = Math.round(Number(o.total || 0) * 100);
    if (!Number.isSafeInteger(cents)) fail('Требуется проверка суммы в базе');
    return sum + (o.type === 'payment' ? -cents : ['sale', 'initial_debt'].includes(o.type) ? cents : 0);
  }, 0);
}
function snapshot(store) {
  const state = store.state || {};
  return { ok: true, revision: store.revision, dealers: (state.dealers || []).filter(d => !state.deletedDealers?.[d.id]).map(d => ({ id: d.id, name: d.name, phone: d.phone || '', city: d.city || '', balanceKopecks: balance(state, d.id) })),
    payments: (state.ops || []).filter(o => o.type === 'payment').sort((a,b) => Number(b.ts) - Number(a.ts)).slice(0, 100).map(o => ({ id:o.id, dealerId:o.dealerId, dealer:o.dealer, total:o.total, method:o.method, note:o.note, ts:o.ts })) };
}
function uniqueId(state) {
  const ids = new Set([...(state.dealers || []), ...(state.ops || [])].map(x => String(x.id)));
  let id; do { id = crypto.randomBytes(6).readUIntBE(0, 6); } while (!id || ids.has(String(id)));
  return id;
}
function apply(store, body) {
  const input = command(body), fingerprint = JSON.stringify(input);
  const prior = store.mobileRequests?.[body.requestId];
  if (prior) {
    if (prior.fingerprint !== fingerprint) fail('Номер запроса уже использован для другой операции', 409);
    return { replay: true, result: prior.result };
  }
  if (!store.computers?.masterId) fail('Сначала подключите и проверьте общую базу на компьютере', 409);
  const next = C.clone(store), state = next.state;
  state.dealers ||= []; state.ops ||= [];
  const now = Date.now(); let result;
  if (input.action === 'dealer') {
    const duplicate = state.dealers.find(d => !state.deletedDealers?.[d.id] && C.phone(d.phone) === input.phone);
    if (duplicate) fail('Этот телефон уже есть у дилера «' + duplicate.name + '». Найдите его в списке.', 409);
    const dealer = { id:uniqueId(state), name:input.name, phone:'+' + input.phone, city:input.city, note:input.note, source:'mobile-v1', updatedAt:now };
    state.dealers.push(dealer);
    result = { kind:'dealer', id:dealer.id, name:dealer.name };
  } else {
    const canonical = resolveAlias(state.dealerAliases, input.dealerId);
    const dealer = state.dealers.find(d => String(d.id) === canonical && !state.deletedDealers?.[d.id]);
    if (!dealer) fail('Дилер удалён или объединён. Обновите список и проверьте карточку.', 409);
    const before = balance(state, dealer.id);
    const op = { id:uniqueId(state), ts:now, type:'payment', date:new Date(now).toLocaleString('ru-RU', { timeZone:'Europe/Moscow' }), dealerId:dealer.id, dealer:dealer.name, total:input.amountKopecks / 100, method:input.method, note:input.note, beforeDebt:before / 100, afterDebt:(before - input.amountKopecks) / 100, source:'mobile-v1' };
    state.ops.push(op);
    result = { kind:'payment', id:op.id, dealer:dealer.name, amountKopecks:input.amountKopecks, balanceKopecks:before - input.amountKopecks };
  }
  next.mobileRequests ||= {};
  // Keep receipts even when the desktop edits/deletes an operation: an old
  // retry must never recreate a payment. They live outside desktop state.
  next.mobileRequests[body.requestId] = { fingerprint, result, createdAt:now };
  next.updatedAt = new Date(now).toISOString();
  return { next, result };
}
function resolveAlias(aliases, value) {
  let id = String(value); const seen = new Set();
  while (aliases?.[id] && !seen.has(id)) { seen.add(id); id = String(aliases[id]); }
  return id;
}
// Old desktop versions send an entire catalog. Do not let an older catalog
// silently remove a dealer just created on the phone.
function protectCatalog(current, body) {
  if (!body.catalog) return;
  for (const d of current.state?.dealers || []) {
    if (d.source !== 'mobile-v1' || current.state.deletedDealers?.[d.id]) continue;
    if (!(body.catalog.dealers || []).some(x => String(x.id) === String(d.id)) && !body.catalog.deletedDealers?.[d.id]) {
      fail('На телефоне создан дилер. Сначала загрузите свежую базу с сервера и повторите изменение.');
    }
  }
}
module.exports = { apply, snapshot, protectCatalog, balance };
