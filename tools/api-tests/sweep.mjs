/**
 * Drives the whole API the way the panel does, and checks the state it leaves behind.
 *
 * Two kinds of check live here. A reachability sweep asks every read endpoint for an answer,
 * because a report that throws is invisible until someone opens that screen. The stories then
 * walk the real journeys — a car booked onto a bay, a reservation that had to wait, money,
 * staff, the till — and assert on what the system holds afterwards, since the bugs that have
 * actually cost us were requests that returned 200 and left a bay held or a queue misnumbered.
 */
const API = process.env.SW_API ?? 'http://localhost:5080';
const SLUG = 'demo-carwash';
const T = `${API}/api/t/${SLUG}`;

const STAGE = { Received: 0, QueuedForWash: 1, Washing: 2, QueuedForDry: 3, Drying: 4, OptionServices: 5, ReadyForPickup: 6, Delivered: 7 };
const BAY_FREE = 0, BAY_OCCUPIED = 1;
const WASH = 0, DRY = 1;

const results = [];
let tok = '', owner = '';

const call = async (method, url, body, token) => {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { status: res.status, body: parsed };
};

const ok = r => r.status >= 200 && r.status < 300;
const err = r => {
  const b = r.body;
  if (b && typeof b === 'object' && b.errors) return ;
  if (b && typeof b === 'object') return `${r.status} ${b.code ?? b.title ?? ''}: ${b.message ?? b.detail ?? ''}`.trim();
  return `${r.status} ${String(b ?? '').slice(0, 160)}`;
};
const check = (group, step, pass, detail = '') => {
  results.push({ group, step, pass, detail });
  if (!pass) console.log(`  [FAIL] ${group} — ${step}  →  ${detail}`);
};

const get = (path, token = tok) => call('GET', `${T}/${path}`, undefined, token);
const post = (path, body, token = tok) => call('POST', `${T}/${path}`, body, token);

const bays = async () => (await get('bays')).body;
const bay = async id => (await bays()).find(b => b.id === id);
const freeBays = async kind => (await bays()).filter(b => b.type === kind && b.status === BAY_FREE && b.isActive);
const order = async id => (await get(`orders/${id}`)).body;
const advance = (id, stage, bayId = null) => post(`orders/${id}/stage`, { stage: STAGE[stage], bayId });

let branchId, serviceIds = [], workerId;

const createOrder = async (bayId, plate, withLine = true) => {
  const services = (await get('services?onlyActive=true')).body;
  return post('orders', {
    branchId, bayId,
    customerName: 'مشتری آزمون', customerPhone: '09120001122',
    vehiclePlate: plate, source: 0,
    lines: withLine ? [{ serviceId: services[0].id, quantity: 1 }] : [],
  });
};

const settleAndDeliver = async id => {
  const o = await order(id);
  if (o.outstandingRials > 0) {
    const pay = await post(`orders/${id}/payments`, { method: 0, amountRials: o.outstandingRials });
    if (!ok(pay)) return pay;
  }
  return advance(id, 'Delivered');
};

/* ── setup ──────────────────────────────────────────────────────────────── */

async function signIn() {
  const t = await call('POST', `${API}/api/public/auth/login`, { email: 'demo@appsmartwash.com', password: 'Demo@1234', tenantSlug: SLUG });
  if (!ok(t)) throw new Error('tenant login failed: ' + err(t));
  tok = t.body.accessToken;
  const o = await call('POST', `${API}/api/public/auth/login`, { email: 'owner@appsmartwash.com', password: 'Owner@12345' });
  owner = ok(o) ? o.body.accessToken : '';
  check('auth', 'tenant sign-in', true);
  check('auth', 'platform owner sign-in', !!owner, err(o));

  branchId = (await get('branches')).body[0].id;
  serviceIds = (await get('services?onlyActive=true')).body.map(s => s.id);
  const workers = (await get('workers?onlyActive=true')).body;
  workerId = workers[0]?.id;
}

/** Leaves the floor empty so each run starts from the same place. */
async function clearFloor() {
  const open = (await get('orders?status=0&pageSize=100')).body.items ?? [];
  for (const o of open) await post(`orders/${o.id}/cancel`, { reason: 'پاک‌سازی آزمون' });
}

/* ── 1. every read endpoint answers ─────────────────────────────────────── */

async function sweepReads() {
  const range = 'fromDate=2026-01-01&toDate=2026-12-31';
  const tenantReads = [
    'me', 'me/tenant', 'me/features', 'settings', 'onboarding/state',
    'branches', 'bays', 'services', 'workers', 'users', 'customers?page=1&pageSize=20',
    'orders?page=1&pageSize=20', 'reservations?page=1&pageSize=20', 'expenses', 'shifts/open?branchId=' + branchId,
    'notifications?page=1&pageSize=20', 'reminders', 'tickets', 'tickets/summary',
    'billing/subscription', 'billing/invoices', 'tips/ledger', `rosters?${range}`,
    'customers/segment?notVisitedInDays=30',
    'reports/dashboard', `reports/revenue?${range}`, `reports/revenue-series?${range}`,
    `reports/bay-performance?${range}`, `reports/waiting?${range}`, `reports/staffing?${range}`,
    `reports/order-archive?${range}`, `reports/punctuality?${range}`,
    `reports/worker-scorecards?${range}`, `reports/worker-performance?${range}`,
    `reports/activity-log?${range}`,
    'sms/summary', 'sms/templates', 'sms/usage', 'campaigns',
  ];
  for (const path of tenantReads) {
    const r = await get(path);
    check('reads', `GET ${path.split('?')[0]}`, ok(r), err(r));
  }

  const publicReads = ['api/public/plans'];
  for (const path of publicReads) {
    const r = await call('GET', `${API}/${path}`);
    check('reads', `GET ${path}`, ok(r), err(r));
  }

  if (!owner) return;
  const platformReads = [
    'api/platform/plans', 'api/platform/tenants', 'api/platform/subscriptions',
    'api/platform/audit-logs', 'api/platform/cron-health', 'api/platform/tickets',
    'api/platform/tickets/stats', 'api/platform/tickets/agents',
    'api/platform/sms/templates', 'api/platform/sms/quotas', 'api/platform/sms/usage',
    'api/platform/sms/stats', 'api/platform/sms/settings',
  ];
  for (const path of platformReads) {
    const r = await call('GET', `${API}/${path}`, undefined, owner);
    check('platform', `GET ${path.replace('api/platform/', '')}`, ok(r), err(r));
  }
}

/* ── 2. a car booked onto a bay ─────────────────────────────────────────── */

async function storyBayBooking() {
  const wash = (await freeBays(WASH))[0];
  const created = await createOrder(wash.id, '11الف111-11');
  check('bay', 'order created on a free bay', ok(created), err(created));
  if (!ok(created)) return;
  const id = created.body.id;

  check('bay', 'starts at reception, no queue number', created.body.stage === STAGE.Received && !created.body.queuePosition);
  check('bay', 'the bay is occupied', (await bay(wash.id)).status === BAY_OCCUPIED);

  for (const step of ['Washing', 'Drying', 'OptionServices']) {
    const r = await advance(id, step);
    check('bay', `${step} without being asked for a bay`, ok(r), err(r));
    if (ok(r)) check('bay', `${step} happens in the booked bay`, (await order(id)).currentBayId === wash.id);
  }

  const ready = await advance(id, 'ReadyForPickup');
  check('bay', 'ready for pickup', ok(ready), err(ready));
  check('bay', 'bay released once ready', (await bay(wash.id)).status === BAY_FREE);

  const early = await advance(id, 'Delivered');
  check('bay', 'delivery refused while money is owed', !ok(early));

  const done = await settleAndDeliver(id);
  check('bay', 'paid and delivered', ok(done), err(done));
  const after = await order(id);
  check('bay', 'order closed as completed', after.status === 1 && after.stage === STAGE.Delivered);
  check('bay', 'backwards steps are refused', !ok(await advance(id, 'Washing')));
}

/* ── 3. reservations that had to wait ───────────────────────────────────── */

async function storyQueue() {
  const a = await createOrder(null, '91ق911-91');
  const b = await createOrder(null, '92ق922-92');
  check('queue', 'order accepted with no bay', ok(a) && ok(b), err(a) + ' ' + err(b));
  if (!ok(a) || !ok(b)) return;

  check('queue', 'first waits at position 1', a.body.stage === STAGE.QueuedForWash && a.body.queuePosition === 1, String(a.body.queuePosition));
  check('queue', 'second waits behind it', b.body.queuePosition === 2, String(b.body.queuePosition));
  check('queue', 'a waiting car holds no bay', a.body.currentBayId == null);

  check('queue', 'cannot start washing without a bay', !ok(await advance(a.body.id, 'Washing')));
  const dry = await freeBays(DRY);
  if (dry.length) check('queue', 'a drying bay is refused for washing', !ok(await advance(a.body.id, 'Washing', dry[0].id)));

  const wash = (await freeBays(WASH))[0];
  const entered = await advance(a.body.id, 'Washing', wash.id);
  check('queue', 'enters a free wash bay', ok(entered), err(entered));
  check('queue', 'that bay is now occupied', (await bay(wash.id)).status === BAY_OCCUPIED);
  check('queue', 'the car behind moves up', (await order(b.body.id)).queuePosition === 1);

  const cancelled = await post(`orders/${b.body.id}/cancel`, { reason: 'آزمون' });
  check('queue', 'a waiting car can be cancelled', ok(cancelled), err(cancelled));

  await advance(a.body.id, 'ReadyForPickup');
  check('queue', 'the queued car finishes normally', ok(await settleAndDeliver(a.body.id)));
}

/* ── 4. refusals that protect the floor ─────────────────────────────────── */

async function storyRefusals() {
  const wash = (await freeBays(WASH))[0];
  const empty = await createOrder(wash.id, '99ق999-99', false);
  check('rules', 'an order with no services can be opened', ok(empty), err(empty));
  if (ok(empty)) {
    const r = await advance(empty.body.id, 'Delivered');
    check('rules', 'but cannot be delivered empty', !ok(r) && String(err(r)).includes('NoLines'), err(r));
    await post(`orders/${empty.body.id}/cancel`, { reason: 'آزمون' });
  }

  const occupied = (await bays()).find(b => b.status === BAY_OCCUPIED);
  if (occupied) {
    const r = await createOrder(occupied.id, '88ق888-88');
    check('rules', 'a busy bay cannot take a second car', !ok(r), err(r));
  }

  const two = (await freeBays(WASH)).slice(0, 2);
  if (two.length === 2) {
    const first = await createOrder(two[0].id, '77ق777-77');
    const second = await createOrder(two[1].id, '76ق766-76');
    if (ok(first) && ok(second)) {
      await advance(first.body.id, 'Washing');
      const moved = await advance(second.body.id, 'Washing', two[0].id);
      check('rules', 'one car cannot be moved into another car’s bay', !ok(moved), err(moved));
      check('rules', 'the first car still holds its bay', (await bay(two[0].id)).currentOrderId === first.body.id);
      await post(`orders/${first.body.id}/cancel`, { reason: 'آزمون' });
      await post(`orders/${second.body.id}/cancel`, { reason: 'آزمون' });
      check('rules', 'cancelling frees both bays', (await bay(two[0].id)).status === BAY_FREE && (await bay(two[1].id)).status === BAY_FREE);
    }
  }
}

/* ── 5. the money on an order ───────────────────────────────────────────── */

async function storyMoney() {
  const wash = (await freeBays(WASH))[0];
  const created = await createOrder(wash.id, '55م555-55');
  if (!ok(created)) return check('money', 'order created', false, err(created));
  const id = created.body.id;

  const added = await post(`orders/${id}/lines`, { serviceId: serviceIds[1], quantity: 2 });
  check('money', 'a second service can be added', ok(added), err(added));
  const withLines = await order(id);
  const expected = withLines.lines.reduce((s, l) => s + l.lineTotalRials, 0);
  check('money', 'the subtotal is the sum of its lines', withLines.subtotalRials === expected, `${withLines.subtotalRials} vs ${expected}`);

  const disc = await post(`orders/${id}/discount`, { discountRials: 50_000 });
  check('money', 'a discount applies', ok(disc), err(disc));
  const afterDisc = await order(id);
  check('money', 'the total drops by the discount', afterDisc.totalRials === afterDisc.subtotalRials - 50_000,
    `${afterDisc.totalRials} vs ${afterDisc.subtotalRials - 50_000}`);

  const half = Math.floor(afterDisc.totalRials / 2);
  const part = await post(`orders/${id}/payments`, { method: 0, amountRials: half });
  check('money', 'a part payment is recorded', ok(part), err(part));
  const afterPart = await order(id);
  check('money', 'the balance owed drops', afterPart.outstandingRials === afterDisc.totalRials - half,
    `${afterPart.outstandingRials}`);
  check('money', 'delivery is still refused while part paid', !ok(await advance(id, 'Delivered')));

  if (workerId) {
    const line = afterPart.lines[0];
    const assigned = await call('PATCH', `${T}/orders/${id}/lines/${line.id}/worker`, { workerId }, tok);
    check('money', 'a worker can be put on a line', ok(assigned), err(assigned));
    const tip = await call('PATCH', `${T}/orders/${id}/lines/${line.id}/tip`, { tipRials: 30_000 }, tok);
    check('money', 'a tip can be recorded', ok(tip), err(tip));
    const withTip = await order(id);
    check('money', 'the tip is held on the line', withTip.lines.find(l => l.id === line.id)?.tipRials === 30_000);
    check('money', 'commission is calculated for the worker', (withTip.lines.find(l => l.id === line.id)?.workerCommissionRials ?? 0) > 0);
  }

  const done = await settleAndDeliver(id);
  check('money', 'settled and delivered', ok(done), err(done));
  const closed = await order(id);
  check('money', 'nothing is left owing', closed.outstandingRials === 0);
  check('money', 'the bay is free again', (await bay(wash.id)).status === BAY_FREE);
}

/* ── 6. the customer behind the car ─────────────────────────────────────── */

async function storyCustomer() {
  const phone = '0913' + String(Math.floor(1000000 + Math.random() * 8999999));
  const created = await post('customers', { fullName: 'آزمون مشتری', phone });
  check('customer', 'customer created', ok(created), err(created));
  if (!ok(created)) return;
  const id = created.body.id;

  const vehicle = await post(`customers/${id}/vehicles`, { plate: '۱۲ب۳۴۵-۶۷', brand: 'پژو', model: '206' });
  check('customer', 'a car can be filed against them', ok(vehicle), err(vehicle));

  const wallet = await post(`customers/${id}/wallet/adjust`, { amountRials: 500_000, description: 'شارژ آزمون' });
  check('customer', 'wallet top-up', ok(wallet), err(wallet));
  check('customer', 'the balance reflects it', (await get(`customers/${id}`)).body.walletBalanceRials === 500_000);

  const loyalty = await post(`customers/${id}/loyalty/adjust`, { points: 120, description: 'امتیاز آزمون' });
  check('customer', 'loyalty points adjust', ok(loyalty), err(loyalty));

  for (const path of [`customers/${id}/wallet/transactions`, `customers/${id}/loyalty/transactions`, `customers/${id}/orders`]) {
    const r = await get(path);
    check('customer', `GET ${path.split('/').pop()}`, ok(r), err(r));
  }

  // the wallet pays for a wash
  const wash = (await freeBays(WASH))[0];
  const services = (await get('services?onlyActive=true')).body;
  const o = await post('orders', {
    branchId, bayId: wash.id, customerId: id, customerName: 'آزمون مشتری', customerPhone: phone,
    vehiclePlate: '۱۲ب۳۴۵-۶۷', source: 0, lines: [{ serviceId: services[0].id, quantity: 1 }],
  });
  check('customer', 'order linked to the customer', ok(o) && o.body.customerId === id, err(o));
  if (ok(o)) {
    const paid = await post(`orders/${o.body.id}/complete`, { finalMethod: 3 });
    check('customer', 'it can be settled from the wallet', ok(paid), err(paid));
    const after = (await get(`customers/${id}`)).body;
    check('customer', 'the wallet is debited', after.walletBalanceRials < 500_000, String(after.walletBalanceRials));
    check('customer', 'the visit is counted', after.totalVisits >= 1, String(after.totalVisits));
  }
}

/** The plan's car limit is per customer. Counting every car in the carwash once meant a site
 *  could file ten cars in total and then refuse every car after that, for good. */
async function storyQuota() {
  const made = [];
  for (let i = 0; i < 3; i++) {
    const phone = '0914' + String(1000000 + Math.floor(Math.random() * 8999999));
    const c = await post('customers', { fullName: 'آزمون سقف ' + i, phone });
    if (!ok(c)) { check('quota', 'customer created', false, err(c)); return; }
    const v = await post(`customers/${c.body.id}/vehicles`, { plate: '۱۱ل' + (100 + i) + '-' + (10 + i), brand: '', model: '' });
    made.push(ok(v));
  }
  check('quota', 'each new customer may file a car, however many the carwash has', made.every(Boolean));
}

/* ── 7. staff, rosters and tips ─────────────────────────────────────────── */

async function storyStaff() {
  const worker = await post('workers', { branchId, fullName: 'آزمون پرسنل', role: 'شستشوکار', phone: '09120009988', commissionRate: 0.1 });
  check('staff', 'worker created', ok(worker), err(worker));
  if (ok(worker)) {
    const upd = await call('PUT', `${T}/workers/${worker.body.id}`, { fullName: 'آزمون پرسنل ۲', role: 'شستشوکار', phone: '09120009988', nationalId: null, commissionRate: 0.12, avatarUrl: null }, tok);
    check('staff', 'worker updated', ok(upd), err(upd));
    check('staff', 'worker deactivated', ok(await post(`workers/${worker.body.id}/active`, { isActive: false })));
  }

  const today = new Date().toISOString().slice(0, 10);
  const roster = await post('rosters', { branchId, date: today, name: 'شیفت آزمون', startsAt: '08:00:00', endsAt: '16:00:00', notes: null });
  check('staff', 'roster created', ok(roster), err(roster));
  if (ok(roster) && workerId) {
    const assign = await post(`rosters/${roster.body.id}/assignments`, { role: 0, workerId, userId: null, bayId: null, note: null });
    check('staff', 'someone can be put on the shift', ok(assign), err(assign));
    if (ok(assign)) {
      const list = (await get(`rosters?fromDate=${today}&toDate=${today}`)).body;
      const mine = list.find(r => r.id === roster.body.id);
      check('staff', 'the assignment is listed', (mine?.assignments?.length ?? 0) >= 1);
      const assignmentId = mine?.assignments?.[0]?.id;
      if (assignmentId) check('staff', 'it can be removed', ok(await call('DELETE', `${T}/rosters/${roster.body.id}/assignments/${assignmentId}`, undefined, tok)));
    }
    check('staff', 'the shift can be deleted', ok(await call('DELETE', `${T}/rosters/${roster.body.id}`, undefined, tok)));
  }

  const ledger = await get('tips/ledger');
  check('staff', 'tip ledger reads', ok(ledger), err(ledger));
  const ledgerRows = Array.isArray(ledger.body) ? ledger.body : (ledger.body?.items ?? ledger.body?.rows ?? []);
  const owed = ledgerRows.find(r => (r.outstandingTipRials ?? 0) > 0);
  if (owed) {
    const settle = await post('tips/settle', { workerId: owed.workerId, branchId, throughUtc: new Date().toISOString(), paidRials: owed.outstandingTipRials, note: 'آزمون' });
    check('staff', 'tips can be settled', ok(settle), err(settle));
    const afterBody = (await get('tips/ledger')).body;
    const afterRows = Array.isArray(afterBody) ? afterBody : (afterBody?.items ?? afterBody?.rows ?? []);
    const after = afterRows.find(r => r.workerId === owed.workerId);
    check('staff', 'the settled tip clears', (after?.outstandingTipRials ?? 0) < owed.outstandingTipRials);
  }
}

/* ── 8. the till and the costs ──────────────────────────────────────────── */

async function storyTill() {
  const openNow = await get('shifts/open?branchId=' + branchId);
  if (openNow.body) await post(`shifts/${openNow.body.id}/close`, { closingCashRials: 0, notes: 'بستن برای آزمون' });

  const opened = await post('shifts/open', { branchId, openingCashRials: 1_000_000 });
  check('till', 'shift opened', ok(opened), err(opened));
  if (ok(opened)) {
    const current = await get('shifts/open?branchId=' + branchId);
    check('till', 'the open shift is reported', current.body?.id === opened.body.id);
    const closed = await post(`shifts/${opened.body.id}/close`, { closingCashRials: 2_500_000, notes: 'آزمون' });
    check('till', 'shift closed', ok(closed), err(closed));
    check('till', 'nothing is left open', (await get('shifts/open?branchId=' + branchId)).body == null);
  }

  const today2 = new Date().toISOString().slice(0, 10);
  const expense = await post('expenses', { branchId, category: 0, title: 'مواد شستشو', amountRials: 450_000, paymentMethod: 0, date: today2, description: null, relatedWorkerId: null });
  check('till', 'expense recorded', ok(expense), err(expense));
  if (ok(expense)) {
    const upd = await call('PUT', `${T}/expenses/${expense.body.id}`, { category: 0, title: 'مواد شستشو', amountRials: 500_000, paymentMethod: 0, date: today2, description: null }, tok);
    check('till', 'expense updated', ok(upd), err(upd));
  }
}

/* ── 9. reservations, reminders, notifications, settings ────────────────── */

async function storyBookingsAndMessages() {
  const when = new Date(Date.now() + 90 * 60 * 1000).toISOString();
  const r = await post('reservations', {
    branchId, customerName: 'آزمون رزرو', customerPhone: '09135551122',
    vehiclePlate: '۴۴د۲۲۲-۳۳', scheduledAtUtc: when, services: [{ serviceId: serviceIds[0] }],
  });
  check('booking', 'reservation created', ok(r), err(r));
  if (ok(r)) {
    check('booking', 'it can be confirmed', ok(await post(`reservations/${r.body.id}/confirm`)));
    check('booking', 'it reads back', ok(await get(`reservations/${r.body.id}`)));
    check('booking', 'it can be marked a no-show', ok(await post(`reservations/${r.body.id}/no-show`)));
  }

  const second = await post('reservations', {
    branchId, customerName: 'آزمون رزرو ۲', customerPhone: '09135551123',
    vehiclePlate: '۴۵د۲۲۲-۳۳', scheduledAtUtc: when, services: [{ serviceId: serviceIds[0] }],
  });
  if (ok(second)) check('booking', 'a reservation can be cancelled', ok(await post(`reservations/${second.body.id}/cancel`, { reason: 'آزمون' })));

  const customers = (await get('customers?page=1&pageSize=1')).body.items ?? [];
  if (customers.length) {
    const rem = await post('reminders', {
      customerId: customers[0].id, vehicleId: null, title: 'یادآور آزمون',
      dueAtUtc: new Date(Date.now() + 7 * 86400000).toISOString(), type: 0,
    });
    check('booking', 'service reminder created', ok(rem), err(rem));
    if (ok(rem)) check('booking', 'reminder can be cancelled', ok(await post(`reminders/${rem.body.id}/cancel`)));
  }

  check('booking', 'notifications can be marked read', ok(await post('notifications/read-all')));

  const settings = (await get('settings')).body;
  const branding = await call('PUT', `${T}/settings/branding`, { logoUrl: settings.logoUrl ?? null, primaryColor: '#dc2626', tagline: settings.tagline ?? null, theme: settings.theme ?? 'light' }, tok);
  check('booking', 'branding settings save', ok(branding), err(branding));
  const loyalty = await call('PUT', `${T}/settings/loyalty`, { enabled: true, pointsPerRial: 1, pointValue: 1000, expiryDays: 365 }, tok);
  check('booking', 'loyalty settings save', ok(loyalty), err(loyalty));
}

/* ── 10. support ────────────────────────────────────────────────────────── */

async function storySupport() {
  const ticket = await post('tickets', { subject: 'آزمون پشتیبانی', description: 'این یک تیکت آزمایشی است.', category: 0, priority: 1, branchId: null, relatedEntityType: null, relatedEntityId: null, attachments: null });
  check('support', 'ticket opened', ok(ticket), err(ticket));
  if (!ok(ticket)) return;
  const id = ticket.body.ticket?.id ?? ticket.body.id;
  check('support', 'a message can be added', ok(await post(`tickets/${id}/messages`, { body: 'پیام دوم', attachments: null })));
  check('support', 'it reads back', ok(await get(`tickets/${id}`)));
  check('support', 'it can be closed', ok(await post(`tickets/${id}/close`)));
  check('support', 'and reopened', ok(await post(`tickets/${id}/reopen`)));
  if (owner) {
    const reply = await call('POST', `${API}/api/platform/tickets/${id}/reply`, { body: 'پاسخ پشتیبانی', isInternalNote: false, attachments: null }, owner);
    check('support', 'support can reply from the platform', ok(reply), err(reply));
  }
}

/* ── 11. access rules ───────────────────────────────────────────────────── */

async function storyAccess() {
  const anon = await get('orders?page=1&pageSize=1', '');
  check('access', 'tenant data needs a token', anon.status === 401, String(anon.status));
  const platformAsTenant = await call('GET', `${API}/api/platform/tenants`, undefined, tok);
  check('access', 'a carwash account cannot read the platform', !ok(platformAsTenant), String(platformAsTenant.status));
  const tenantAsOwner = await get('orders?page=1&pageSize=1', owner);
  check('access', 'the platform owner is not a carwash user', !ok(tenantAsOwner), String(tenantAsOwner.status));
  const badLogin = await call('POST', `${API}/api/public/auth/login`, { email: 'demo@appsmartwash.com', password: 'wrong', tenantSlug: SLUG });
  check('access', 'a wrong password is refused', !ok(badLogin), String(badLogin.status));
}

/* ── run ────────────────────────────────────────────────────────────────── */

const stories = [
  ['reads', sweepReads], ['bay', storyBayBooking], ['queue', storyQueue], ['rules', storyRefusals],
  ['money', storyMoney], ['customer', storyCustomer], ['quota', storyQuota], ['staff', storyStaff], ['till', storyTill],
  ['booking', storyBookingsAndMessages], ['support', storySupport], ['access', storyAccess],
];

await signIn();
await clearFloor();
for (const [name, fn] of stories) {
  try {
    await fn();
    await clearFloor();
  } catch (e) {
    check(name, 'story crashed', false, String(e && e.stack ? e.stack.split('\n')[0] : e));
  }
}

const failed = results.filter(r => !r.pass);
const byGroup = {};
for (const r of results) {
  byGroup[r.group] ??= { pass: 0, fail: 0 };
  byGroup[r.group][r.pass ? 'pass' : 'fail']++;
}
console.log('\n' + Object.entries(byGroup).map(([g, v]) => `${g}: ${v.pass}✓${v.fail ? ' ' + v.fail + '✗' : ''}`).join('   '));
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
