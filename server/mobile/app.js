'use strict';
const $ = id => document.getElementById(id);
const money = cents => (cents / 100).toLocaleString('ru-RU', { minimumFractionDigits:2, maximumFractionDigits:2 }) + ' ₽';
const pendingKey = 'soffito-mobile-pending-v1';
let token = '', snapshot = null, selected = null, prepared = null, busy = false, pending = null;
try { pending = JSON.parse(localStorage.getItem(pendingKey) || 'null'); } catch (_) {}
function notice(message, error = false) { $('notice').textContent = message; $('notice').classList.toggle('error', error); $('notice').hidden = !message; }
function screen(id) { for (const name of ['login', 'workspace', 'paymentScreen', 'dealerScreen']) $(name).hidden = name !== id; window.scrollTo(0, 0); }
function setBusy(value) { busy = value; document.querySelectorAll('button').forEach(b => { b.disabled = value; }); }
function cents(value) {
  const v = value.replace(/\s/g, '').replace(',', '.');
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(v)) return null;
  const [whole, fraction=''] = v.split('.');
  const n = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(n) && n > 0 && n <= 100000000000 ? n : null;
}
async function api(path, body) {
  const ctrl = new AbortController(), timeout = setTimeout(() => ctrl.abort(), 15000);
  try {
    const response = await fetch('/api/mobile/' + path, { method:body ? 'POST' : 'GET', headers:{ Authorization:'Bearer ' + token, 'Content-Type':'application/json' }, body:body ? JSON.stringify(body) : undefined, signal:ctrl.signal, cache:'no-store' });
    let data; try { data = await response.json(); } catch (_) { throw new Error('Сервер не подтвердил результат. Проверьте связь.'); }
    if (!response.ok) throw Object.assign(new Error(data.message || 'Ошибка сервера'), { status:response.status });
    return data;
  } finally { clearTimeout(timeout); }
}
function pendingView() {
  $('pending').hidden = !pending;
  $('mainActions').hidden = !!pending;
  $('pendingText').textContent = pending?.action === 'payment' ? 'Ожидает подтверждения оплата ' + money(pending.amountKopecks) + '. Новые операции временно закрыты.' : 'Ожидает подтверждения создание дилера. Новые операции временно закрыты.';
}
function render() {
  const query = $('search').value.trim().toLocaleLowerCase('ru-RU');
  const digits = query.replace(/\D/g, '');
  $('dealers').replaceChildren();
  const rows = snapshot.dealers.filter(d => (d.name + ' ' + d.phone).toLocaleLowerCase('ru-RU').includes(query) || (digits.length >= 3 && d.phone.replace(/\D/g, '').includes(digits))).sort((a,b) => a.name.localeCompare(b.name, 'ru'));
  for (const d of rows) {
    const button = document.createElement('button'); button.className = 'dealer';
    const left = document.createElement('span'), title = document.createElement('b'), subtitle = document.createElement('small'), amount = document.createElement('strong');
    title.textContent = d.name; subtitle.textContent = [d.phone,d.city].filter(Boolean).join(' · ');
    amount.textContent = money(Math.abs(d.balanceKopecks)); amount.className = d.balanceKopecks > 0 ? 'owed' : 'credit';
    if (d.balanceKopecks < 0) { const credit = document.createElement('small'); credit.textContent = 'Аванс'; amount.append(credit); }
    left.append(title,subtitle); button.append(left,amount); button.addEventListener('click', () => openPayment(d)); $('dealers').append(button);
  }
  if (!rows.length) $('dealers').textContent = query ? 'Дилеры не найдены.' : 'В общей базе пока нет дилеров.';
  $('payments').replaceChildren();
  for (const p of snapshot.payments) {
    const card = document.createElement('div'), line = document.createElement('div'), name = document.createElement('span'), amount = document.createElement('strong'), meta = document.createElement('small');
    card.className = 'payment'; name.textContent = p.dealer; amount.textContent = money(Math.round(p.total * 100));
    meta.textContent = [p.method, new Date(p.ts).toLocaleString('ru-RU'), p.note].filter(Boolean).join(' · ');
    line.append(name,amount); card.append(line,meta); $('payments').append(card);
  }
  if (!snapshot.payments.length) $('payments').textContent = 'Оплат пока нет.';
  pendingView();
}
async function refresh() {
  snapshot = await api('snapshot'); render();
  $('updated').textContent = 'Данные сервера · ' + new Date().toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' });
}
function openPayment(d) {
  if (busy || pending) return;
  selected = { ...d }; $('paymentForm').reset(); $('afterBalance').textContent = '';
  $('dealerName').textContent = d.name; $('dealerPhone').textContent = d.phone;
  $('balanceLabel').textContent = d.balanceKopecks < 0 ? 'Аванс дилера' : 'Текущий долг';
  $('dealerBalance').textContent = money(Math.abs(d.balanceKopecks)); notice(''); screen('paymentScreen');
}
function errorText(e) { return e.name === 'AbortError' || e instanceof TypeError ? 'Нет подтверждения от сервера. Проверьте интернет и повторите проверку.' : e.message; }
async function submitPending() {
  if (busy || !pending) return;
  setBusy(true); screen('workspace'); pendingView(); notice('Проверяем сохранение…');
  try {
    const data = await api('commands', pending);
    pending = null; localStorage.removeItem(pendingKey); pendingView();
    const r = data.result;
    notice(r.kind === 'payment' ? 'Оплата ' + money(r.amountKopecks) + ' для «' + r.dealer + '» сохранена в общей базе.' : 'Дилер «' + r.name + '» создан в общей базе.');
    try { await refresh(); } catch (_) { notice($('notice').textContent + ' Список пока не обновлён — нажмите «Обновить».'); }
  } catch (e) {
    // 4xx replies are definitive rejections; network/5xx is an unknown outcome.
    if ([400,409,422].includes(e.status)) { pending = null; localStorage.removeItem(pendingKey); pendingView(); }
    notice(errorText(e), true);
  } finally { setBusy(false); }
}
function savePending(body) {
  // Persist the same request ID BEFORE sending, so a lost acknowledgement or
  // page reload cannot turn a retry into another financial operation.
  localStorage.setItem(pendingKey, JSON.stringify(body)); pending = body;
}
$('loginForm').addEventListener('submit', async e => {
  e.preventDefault(); if (busy) return;
  if (!window.isSecureContext) { notice('Для входа откройте приложение по защищённому HTTPS-адресу.', true); return; }
  token = $('token').value.trim(); setBusy(true);
  try { await refresh(); $('token').value = ''; $('logout').hidden = false; screen('workspace'); notice(''); }
  catch (err) { token = ''; notice(errorText(err), true); }
  finally { setBusy(false); }
});
$('logout').addEventListener('click', () => { token=''; snapshot=null; selected=null; $('dealers').replaceChildren(); $('payments').replaceChildren(); $('paymentForm').reset(); $('dealerForm').reset(); $('logout').hidden=true; screen('login'); notice(pending ? 'Незавершённый запрос сохранён на этом телефоне. После входа проверьте его результат.' : 'Вы вышли.'); });
$('search').addEventListener('input', () => { if (snapshot) render(); });
$('refresh').addEventListener('click', async () => { if (busy) return; setBusy(true); try { await refresh(); notice('Список обновлён.'); } catch(e) { notice(errorText(e),true); } finally { setBusy(false); } });
$('newDealer').addEventListener('click', () => { $('dealerForm').reset(); screen('dealerScreen'); notice(''); });
for (const id of ['backPayment','backDealer']) $(id).addEventListener('click', () => { screen('workspace'); notice(''); });
$('amount').addEventListener('input', () => { const n=cents($('amount').value); const balance=selected.balanceKopecks-(n || 0); $('afterBalance').textContent=n ? (balance < 0 ? 'Будет аванс: ' : 'Остаток долга: ') + money(Math.abs(balance)) + ' (по загруженным данным)' : ''; });
$('paymentForm').addEventListener('submit', e => {
  e.preventDefault(); if (busy || pending) return;
  const amount = cents($('amount').value), method = new FormData(e.target).get('method');
  if (!amount) return notice('Укажите положительную сумму, не больше двух знаков после запятой.',true);
  prepared = { requestId:crypto.randomUUID(), action:'payment', dealerId:selected.id, amountKopecks:amount, method, note:$('paymentNote').value.trim() };
  $('confirmation').textContent = selected.name + '\n' + selected.phone + '\n' + money(amount) + ' · ' + method;
  $('confirm').showModal();
});
$('cancelConfirm').addEventListener('click', () => $('confirm').close());
$('sendPayment').addEventListener('click', () => { if (busy || pending || !prepared) return; $('confirm').close(); try { savePending(prepared); submitPending(); } catch (_) { notice('Не удалось сохранить запрос на телефоне. Оплата не отправлена.',true); } });
$('dealerForm').addEventListener('submit', e => {
  e.preventDefault(); if (busy || pending) return;
  try { savePending({ requestId:crypto.randomUUID(), action:'dealer', name:$('name').value, phone:$('phone').value, city:$('city').value, note:$('dealerNote').value }); submitPending(); }
  catch (_) { notice('Не удалось сохранить запрос на телефоне. Карточка не отправлена.',true); }
});
$('retry').addEventListener('click', submitPending);
window.addEventListener('offline', () => notice('Нет интернета. Для сохранения в общей базе нужна связь.',true));
