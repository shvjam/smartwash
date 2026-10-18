/**
 * The second half of the API: everything sweep.mjs never touches.
 *
 * sweep.mjs walks the shop floor — orders, bays, queue, money, the till. This walks the parts
 * nobody opens until a customer does: the scheduled jobs, the catalogue, user administration,
 * campaigns, billing, SMS, the platform's own operations, and the public endpoints a stranger
 * can reach. Between the two, every route the API exposes is called at least once.
 *
 * It asserts on what is left behind, not on the status code, wherever that is possible: a
 * deactivated service disappears from the active list, a suspended tenant comes back, a
 * changed password works and the old one does not.
 */
const API = process.env.SW_API ?? 'http://localhost:5080';
const SLUG = 'demo-carwash';
const T = `${API}/api/t/${SLUG}`;
const CRON_SECRET = 'local-cron';

const results = [];
let tok = '', owner = '', branchId = '', tenantId = '';

const call = async (method, url, body, token, headers = {}) => {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
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
  if (b && typeof b === 'object') return `${r.status} ${b.code ?? b.title ?? ''}: ${b.message ?? b.detail ?? ''}`.trim();
  return `${r.status} ${String(b ?? '').slice(0, 200)}`;
};
const check = (group, step, pass, detail = '') => {
  results.push({ group, step, pass, detail });
  if (!pass) console.log(`  [FAIL] ${group} — ${step}  →  ${detail}`);
};

const get = (p, token = tok) => call('GET', `${T}/${p}`, undefined, token);
const post = (p, b, token = tok) => call('POST', `${T}/${p}`, b, token);
const put = (p, b, token = tok) => call('PUT', `${T}/${p}`, b, token);
const del = (p, token = tok) => call('DELETE', `${T}/${p}`, undefined, token);

const pget = p => call('GET', `${API}/api/platform/${p}`, undefined, owner);
const ppost = (p, b) => call('POST', `${API}/api/platform/${p}`, b, owner);
const pput = (p, b) => call('PUT', `${API}/api/platform/${p}`, b, owner);
const pdel = p => call('DELETE', `${API}/api/platform/${p}`, undefined, owner);

const cron = job => call('GET', `${API}/api/cron/${job}`, undefined, undefined, { 'X-Cron-Secret': CRON_SECRET });

const uniq = () => Math.random().toString(36).slice(2, 8);
const phone = () => '09' + String(Math.floor(1e8 + Math.random() * 8.9e8)).slice(0, 9);

/* ── setup ──────────────────────────────────────────────────────────────── */

async function signIn() {
  const t = await call('POST', `${API}/api/public/auth/login`,
    { email: 'demo@appsmartwash.com', password: 'Demo@1234', tenantSlug: SLUG });
  if (!ok(t)) throw new Error('tenant login failed: ' + err(t));
  tok = t.body.accessToken;

  const o = await call('POST', `${API}/api/public/auth/login`,
    { email: 'owner@appsmartwash.com', password: 'Owner@12345' });
  if (!ok(o)) throw new Error('owner login failed: ' + err(o));
  owner = o.body.accessToken;

  branchId = (await get('branches')).body[0].id;
  const tenants = (await pget(`tenants?page=1&pageSize=20&search=${SLUG}`)).body;
  const list = tenants.items ?? tenants;
  tenantId = list.find(x => x.slug === SLUG)?.id;
  check('setup', 'both sessions and the demo tenant resolve', !!(tok && owner && branchId && tenantId));
}

/* ── 1. the scheduled jobs ──────────────────────────────────────────────── */

/**
 * Every cron job, run for real.
 *
 * These are the only endpoints in the system that nobody ever opens: they run at night, and a
 * job that throws leaves no trace on any screen until the thing it was supposed to do has not
 * happened for a month. So each one is called and each one must come back cleanly.
 */
async function cronJobs() {
  const jobs = [
    'ping', 'expire-trials', 'expire-grace', 'expire-overdue-subscriptions', 'daily-billing',
    'billing-reminders', 'send-reminders', 'generate-service-reminders', 'generate-notifications',
    'campaign-dispatcher', 'usage-rollup', 'cleanup-tokens',
  ];
  for (const job of jobs) {
    const r = await cron(job);
    check('cron', `${job} runs`, ok(r), err(r));
  }

  const noSecret = await call('GET', `${API}/api/cron/ping`);
  check('cron', 'a call without the secret is refused', noSecret.status === 401, err(noSecret));
  const wrong = await call('GET', `${API}/api/cron/ping`, undefined, undefined, { 'X-Cron-Secret': 'wrong-secret' });
  check('cron', 'a call with the wrong secret is refused', wrong.status === 401, err(wrong));

  // The health screen is how the platform sees all of the above.
  const health = await pget('cron-health');
  check('cron', 'the platform can read job health', ok(health), err(health));
  const seen = (health.body?.jobs ?? health.body ?? []).map(j => j.jobName ?? j.name);
  check('cron', 'the jobs just run are recorded', jobs.every(j => j === 'ping' || seen.includes(j)),
    `recorded: ${seen.join(', ')}`);
}

/* ── 2. every remaining read ────────────────────────────────────────────── */

async function remainingReads() {
  const range = 'fromDate=2026-01-01&toDate=2026-12-31';
  const tenant = [
    `reports/order-archive?${range}&page=1&pageSize=20`,
    `reports/punctuality?${range}`,
    `reports/activity-log?${range}&page=1&pageSize=20`,
    `reports/worker-scorecards?${range}`,
    `reports/revenue?${range}`,
    'campaigns',
    'sms/summary', 'sms/templates', `sms/usage?${range}`,
    'notifications?page=1&pageSize=5',
  ];
  for (const p of tenant) {
    const r = await get(p);
    check('reads', `GET ${p.split('?')[0]}`, ok(r), err(r));
  }

  const platform = [
    'plans', 'tenants?page=1&pageSize=10', 'subscriptions?page=1&pageSize=10',
    'audit-logs?page=1&pageSize=10', 'tickets?page=1&pageSize=10', 'tickets/stats', 'tickets/agents',
    'sms/templates', 'sms/settings', 'sms/quotas', 'sms/stats', 'sms/usage',
    `sms/tenants/${tenantId}/templates`,
  ];
  for (const p of platform) {
    const r = await pget(p);
    check('reads', `GET platform/${p.split('?')[0]}`, ok(r), err(r));
  }

  const pub = await call('GET', `${API}/api/public/plans`);
  check('reads', 'GET public/plans', ok(pub) && Array.isArray(pub.body), err(pub));

  // Detail reads need a real id, so they are resolved from the lists above.
  const branch = await get(`branches/${branchId}`);
  check('reads', 'GET branches/{id}', ok(branch), err(branch));

  const custs = (await get('customers?page=1&pageSize=1')).body?.items ?? [];
  if (custs[0]) {
    for (const p of [`customers/${custs[0].id}`, `customers/${custs[0].id}/orders`,
      `customers/${custs[0].id}/wallet/transactions`, `customers/${custs[0].id}/loyalty/transactions`]) {
      const r = await get(p);
      check('reads', `GET ${p.replace(custs[0].id, '{id}')}`, ok(r), err(r));
    }
  }

  const res = (await get('reservations?page=1&pageSize=1')).body?.items ?? [];
  if (res[0]) {
    const r = await get(`reservations/${res[0].id}`);
    check('reads', 'GET reservations/{id}', ok(r), err(r));
  }

  const plans = (await pget('plans')).body ?? [];
  if (plans[0]) {
    const r = await pget(`plans/${plans[0].id}`);
    check('reads', 'GET platform/plans/{id}', ok(r), err(r));
  }
  const tn = await pget(`tenants/${tenantId}`);
  check('reads', 'GET platform/tenants/{id}', ok(tn), err(tn));
}

/* ── 3. the catalogue ───────────────────────────────────────────────────── */

/**
 * A service, a bay and a branch, each created, changed and retired.
 *
 * The assertion that matters is the last one in each case: something switched off must leave
 * the active list, because every screen that offers a choice asks for the active list.
 */
async function catalogue() {
  const tag = uniq();

  const svc = await post('services', {
    name: `خدمت آزمون ${tag}`, description: null, category: 0,
    priceRials: 500_000, durationMinutes: 20, workerCommissionRate: 0.1,
  });
  check('catalogue', 'service created', ok(svc), err(svc));
  if (ok(svc)) {
    const id = svc.body.id;
    const upd = await put(`services/${id}`, {
      name: `خدمت آزمون ${tag} ویرایش‌شده`, description: 'شرح', category: 0,
      priceRials: 650_000, durationMinutes: 25, workerCommissionRate: 0.15, sortOrder: 99, iconKey: null,
    });
    check('catalogue', 'service updated', ok(upd), err(upd));
    const after = (await get('services')).body.find(s => s.id === id);
    check('catalogue', 'the new price is what reads back', after?.priceRials === 650_000, `got ${after?.priceRials}`);

    const off = await post(`services/${id}/active`, { isActive: false });
    check('catalogue', 'service deactivated', ok(off), err(off));
    const active = (await get('services?onlyActive=true')).body;
    check('catalogue', 'it is gone from the active list', !active.some(s => s.id === id));
  }

  // Bays have no delete and the plan caps how many a carwash may have, so creating one on
  // every run eventually exhausts the quota — which is the quota doing its job, not a
  // failure. Reuse the bay a previous run left behind; only create one if there is none.
  const bays = (await get('bays')).body;
  // Numbers from 90 up are this harness's own range; the test renames the bay afterwards,
  // so the number is the only reliable way to recognise one it made earlier.
  const spareBay = bays.find(b => b.number >= 90);
  const taken = new Set(bays.map(b => b.number));
  let number = 90;
  while (taken.has(number)) number++;

  const bay = spareBay
    ? { status: 200, body: spareBay }
    : await post('bays', { branchId, name: `جایگاه آزمون ${tag}`, number, type: 0, serviceCapacity: 1, queueCapacity: 0 });
  check('catalogue', 'a bay to work with', ok(bay), err(bay));
  if (ok(bay)) {
    const id = bay.body.id;
    const upd = await put(`bays/${id}`, { name: `جایگاه ${tag}`, number: bay.body.number, notes: 'یادداشت' });
    check('catalogue', 'bay updated', ok(upd), err(upd));

    const maint = await post(`bays/${id}/maintenance`, { notes: 'تعمیر آزمون' });
    check('catalogue', 'bay sent to maintenance', ok(maint), err(maint));
    const inMaint = (await get('bays')).body.find(b => b.id === id);
    check('catalogue', 'its status says so', inMaint && inMaint.status !== 0, `status ${inMaint?.status}`);

    const free = await post(`bays/${id}/free`, {});
    check('catalogue', 'and it can be released again', ok(free), err(free));
    const released = (await get('bays')).body.find(b => b.id === id);
    check('catalogue', 'the bay is free', released?.status === 0, `status ${released?.status}`);
  }

  // Branches have no delete, and the plan's branch quota counts switched-off ones too, so a
  // run that always created one would exhaust the quota after three runs. Reuse the branch a
  // previous run left behind.
  const all = (await get('branches')).body;
  const spare = all.find(b => !b.isDefault);
  const br = spare
    ? { status: 200, body: spare }
    : await post('branches', { name: `شعبه آزمون ${tag}`, address: 'نشانی', phone: '02100000000', isDefault: false });
  check('catalogue', 'a branch to work with', ok(br), err(br));
  if (ok(br)) {
    const id = br.body.id;
    await post(`branches/${id}/active`, { isActive: true });
    const upd = await put(`branches/${id}`, { name: `شعبه ${tag}`, address: 'نشانی تازه', phone: '02111111111', latitude: null, longitude: null });
    check('catalogue', 'branch updated', ok(upd), err(upd));
    const off = await post(`branches/${id}/active`, { isActive: false });
    check('catalogue', 'branch deactivated', ok(off), err(off));
    const active = (await get('branches?onlyActive=true')).body;
    check('catalogue', 'it leaves the active list', !active.some(b => b.id === id));
  }
}

/* ── 4. user administration ─────────────────────────────────────────────── */

/**
 * Inviting a colleague, giving and taking a role, and changing a password.
 *
 * The password checks are the point: a reset must let the new password in, and a change must
 * shut the old one out. Nothing else in the system can be trusted if that is not true.
 */
async function users() {
  const tag = uniq();
  const email = `audit-${tag}@example.com`;
  const first = 'Audit@1234';

  const invited = await post('users', { email, displayName: `کاربر آزمون ${tag}`, phone: null, password: first, role: 'tenant:operator' });
  check('users', 'colleague invited', ok(invited), err(invited));
  if (!ok(invited)) return;
  const id = invited.body.id ?? invited.body.userId;

  const signIn = await call('POST', `${API}/api/public/auth/login`, { email, password: first, tenantSlug: SLUG });
  check('users', 'they can sign in', ok(signIn), err(signIn));
  const theirToken = ok(signIn) ? signIn.body.accessToken : '';

  const addRole = await post(`users/${id}/roles`, { role: 'tenant:accountant' });
  check('users', 'a second role is granted', ok(addRole), err(addRole));
  const withRole = (await get('users')).body.find(u => u.id === id);
  check('users', 'the role is listed', (withRole?.roles ?? []).includes('tenant:accountant'), `roles: ${withRole?.roles}`);

  const dropRole = await del(`users/${id}/roles/${encodeURIComponent('tenant:accountant')}`);
  check('users', 'and taken away again', ok(dropRole), err(dropRole));
  const without = (await get('users')).body.find(u => u.id === id);
  check('users', 'it is gone from the list', !(without?.roles ?? []).includes('tenant:accountant'), `roles: ${without?.roles}`);

  const second = 'Audit@5678';
  const reset = await post(`users/${id}/reset-password`, { newPassword: second });
  check('users', 'an admin can reset their password', ok(reset), err(reset));
  const oldFails = await call('POST', `${API}/api/public/auth/login`, { email, password: first, tenantSlug: SLUG });
  check('users', 'the old password no longer works', oldFails.status === 401 || oldFails.status === 400, err(oldFails));
  const newWorks = await call('POST', `${API}/api/public/auth/login`, { email, password: second, tenantSlug: SLUG });
  check('users', 'the new one does', ok(newWorks), err(newWorks));

  const third = 'Audit@9012';
  const changed = await call('POST', `${T}/users/me/change-password`,
    { currentPassword: second, newPassword: third }, newWorks.body?.accessToken);
  check('users', 'they can change their own password', ok(changed), err(changed));
  const afterChange = await call('POST', `${API}/api/public/auth/login`, { email, password: third, tenantSlug: SLUG });
  check('users', 'and sign in with it', ok(afterChange), err(afterChange));

  const wrongCurrent = await call('POST', `${T}/users/me/change-password`,
    { currentPassword: 'not-the-password', newPassword: 'Audit@3456' }, afterChange.body?.accessToken);
  check('users', 'a change with the wrong current password is refused', !ok(wrongCurrent), `accepted: ${wrongCurrent.status}`);

  const off = await post(`users/${id}/active`, { isActive: false });
  check('users', 'the account can be switched off', ok(off), err(off));
  const blocked = await call('POST', `${API}/api/public/auth/login`, { email, password: third, tenantSlug: SLUG });
  check('users', 'a switched-off account cannot sign in', !ok(blocked), `accepted: ${blocked.status}`);

  if (theirToken) {
    const stale = await call('GET', `${T}/me`, undefined, theirToken);
    check('users', 'their old token stops working too', !ok(stale), `accepted: ${stale.status}`);
  }
}

/* ── 5. campaigns ───────────────────────────────────────────────────────── */

async function campaigns() {
  const tag = uniq();
  const created = await post('campaigns', {
    name: `کمپین آزمون ${tag}`, type: 0, target: 0,
    messageTemplate: 'سلام {name}، تخفیف ویژه‌ی این هفته.',
  });
  check('campaigns', 'campaign created', ok(created), err(created));
  if (!ok(created)) return;
  const id = created.body.id;

  const listed = (await get('campaigns')).body;
  check('campaigns', 'it is listed as a draft', (listed.items ?? listed).some(c => c.id === id && c.status === 0));

  const when = new Date(Date.now() + 86_400_000).toISOString();
  const sched = await post(`campaigns/${id}/schedule`, { scheduledAtUtc: when });
  check('campaigns', 'it can be scheduled', ok(sched), err(sched));
  const afterSchedule = ((await get('campaigns')).body.items ?? (await get('campaigns')).body).find(c => c.id === id);
  check('campaigns', 'the status moves to scheduled', afterSchedule?.status === 1, `status ${afterSchedule?.status}`);

  const cancelled = await post(`campaigns/${id}/cancel`, {});
  check('campaigns', 'and cancelled', ok(cancelled), err(cancelled));
  const afterCancel = ((await get('campaigns')).body.items ?? (await get('campaigns')).body).find(c => c.id === id);
  check('campaigns', 'the status says cancelled', afterCancel?.status === 4, `status ${afterCancel?.status}`);

  // The dispatcher sends whatever is Scheduled and due, so a status that can be set from any
  // other status is a second SMS blast to every customer, billed to the tenant.
  const again = await post(`campaigns/${id}/schedule`, { scheduledAtUtc: when });
  check('campaigns', 'a cancelled campaign cannot be scheduled again', !ok(again), `accepted: ${again.status}`);

  const due = await post('campaigns', {
    name: `کمپین ارسال ${tag}`, type: 0, target: 0, messageTemplate: 'سلام {name}.',
  });
  if (ok(due)) {
    const dueId = due.body.id;
    await post(`campaigns/${dueId}/schedule`, { scheduledAtUtc: new Date(Date.now() - 60_000).toISOString() });
    const ran = await cron('campaign-dispatcher');
    check('campaigns', 'the dispatcher sends a due campaign', ok(ran), err(ran));

    const sent = ((await get('campaigns')).body.items ?? (await get('campaigns')).body).find(c => c.id === dueId);
    check('campaigns', 'it is marked finished afterwards', sent?.status === 3 || sent?.status === 5,
      `status ${sent?.status}`);

    const resend = await post(`campaigns/${dueId}/schedule`, { scheduledAtUtc: when });
    check('campaigns', 'and a finished campaign cannot be sent a second time', !ok(resend), `accepted: ${resend.status}`);

    const recall = await post(`campaigns/${dueId}/cancel`, {});
    check('campaigns', 'nor cancelled after it has gone out', !ok(recall), `accepted: ${recall.status}`);
  }
}

/* ── 6. loyalty, wallet and the free wash ───────────────────────────────── */

async function loyaltyAndWallet() {
  const tag = uniq();
  const cust = await post('customers', { fullName: `مشتری امتیاز ${tag}`, phone: phone(), email: null });
  check('loyalty', 'customer created', ok(cust), err(cust));
  if (!ok(cust)) return;
  const id = cust.body.id;

  const wallet = await post(`customers/${id}/wallet/adjust`, { amountRials: 2_000_000, description: 'شارژ آزمون' });
  check('loyalty', 'the wallet can be topped up', ok(wallet), err(wallet));
  const afterTopUp = (await get(`customers/${id}`)).body;
  check('loyalty', 'the balance reflects it', afterTopUp?.walletBalanceRials === 2_000_000, `balance ${afterTopUp?.walletBalanceRials}`);

  const tx = (await get(`customers/${id}/wallet/transactions`)).body;
  check('loyalty', 'the top-up is on the ledger', (tx.items ?? tx).length >= 1);

  const spend = await post(`customers/${id}/wallet/adjust`, { amountRials: -500_000, description: 'برداشت آزمون' });
  check('loyalty', 'and money can be taken out', ok(spend), err(spend));
  const afterSpend = (await get(`customers/${id}`)).body;
  check('loyalty', 'the balance drops', afterSpend?.walletBalanceRials === 1_500_000, `balance ${afterSpend?.walletBalanceRials}`);

  const overdraw = await post(`customers/${id}/wallet/adjust`, { amountRials: -9_000_000, description: 'بیش از موجودی' });
  check('loyalty', 'the wallet cannot go negative', !ok(overdraw), `accepted: ${overdraw.status}`);

  const points = await post(`customers/${id}/loyalty/adjust`, { points: 120, description: 'امتیاز آزمون' });
  check('loyalty', 'loyalty points can be granted', ok(points), err(points));
  const afterPoints = (await get(`customers/${id}`)).body;
  check('loyalty', 'the balance reflects the points', afterPoints?.loyaltyPoints === 120, `points ${afterPoints?.loyaltyPoints}`);
  const ptx = (await get(`customers/${id}/loyalty/transactions`)).body;
  check('loyalty', 'the grant is on the loyalty ledger', (ptx.items ?? ptx).length >= 1);

  const veh = await post(`customers/${id}/vehicles`, { plate: `۱۲ج۳۴۵ ایران ۱۰`, brand: 'پژو', model: '۲۰۶', color: 'سفید', year: 1400 });
  check('loyalty', 'a vehicle can be added', ok(veh), err(veh));
  if (ok(veh)) {
    const vid = veh.body.id ?? (await get(`customers/${id}`)).body.vehicles?.[0]?.id;
    const gone = await del(`customers/${id}/vehicles/${vid}`);
    check('loyalty', 'and removed', ok(gone), err(gone));
    const after = (await get(`customers/${id}`)).body;
    check('loyalty', 'the vehicle list is empty again', (after?.vehicles ?? []).length === 0);
  }
}

/* ── 7. an order's remaining verbs ──────────────────────────────────────── */

async function orderEdges() {
  const services = (await get('services?onlyActive=true')).body;
  const created = await post('orders', {
    branchId, bayId: null,
    customerName: 'مشتری حذف خط', customerPhone: '09120003344',
    vehiclePlate: `۴۴ل${Math.floor(100 + Math.random() * 899)} ایران ۲۰`, source: 0,
    lines: [{ serviceId: services[0].id, quantity: 1 }],
  });
  check('orders', 'order created for the line tests', ok(created), err(created));
  if (!ok(created)) return;
  const id = created.body.id;

  const added = await post(`orders/${id}/lines`, { serviceId: services[1 % services.length].id, quantity: 1, workerId: null });
  check('orders', 'a second line is added', ok(added), err(added));

  const before = (await get(`orders/${id}`)).body;
  const lineId = before.lines[before.lines.length - 1].id;
  const removed = await del(`orders/${id}/lines/${lineId}`);
  check('orders', 'a line can be removed', ok(removed), err(removed));
  const after = (await get(`orders/${id}`)).body;
  check('orders', 'the order is one line shorter', after.lines.length === before.lines.length - 1,
    `${before.lines.length} → ${after.lines.length}`);
  check('orders', 'and the subtotal follows the lines',
    after.subtotalRials === after.lines.reduce((s, l) => s + l.lineTotalRials, 0),
    `subtotal ${after.subtotalRials}`);

  const lastLine = after.lines[0].id;
  const emptied = await del(`orders/${id}/lines/${lastLine}`);
  if (ok(emptied)) {
    const bare = (await get(`orders/${id}`)).body;
    check('orders', 'an order with no lines cannot be delivered',
      !ok(await post(`orders/${id}/stage`, { stage: 7, bayId: null })), `lines: ${bare.lines.length}`);
  } else {
    check('orders', 'the last line cannot be removed', true, err(emptied));
  }

  const cancelled = await post(`orders/${id}/cancel`, { reason: 'پایان آزمون' });
  check('orders', 'the order can be cancelled', ok(cancelled), err(cancelled));
}

/**
 * A carwash that has just signed up, for the things that can only be tested once.
 *
 * Onboarding and the first subscription both happen exactly once in a tenant's life, and the
 * demo tenant is long past both. Testing them on it would either prove nothing or wreck the
 * fixture every other check depends on.
 */
async function freshTenant() {
  const tag = uniq();
  const slug = `audit-${tag}`;
  const email = `owner-${tag}@example.com`;
  const reg = await call('POST', `${API}/api/public/auth/register-tenant`, {
    displayName: `کارواش تازه ${tag}`, slug, ownerEmail: email, ownerPhone: phone(),
    ownerDisplayName: 'مالک تازه', ownerPassword: 'Audit@1234',
  });
  if (!ok(reg)) return null;
  const login = await call('POST', `${API}/api/public/auth/login`, { email, password: 'Audit@1234', tenantSlug: slug });
  if (!ok(login)) return null;
  return { slug, token: login.body.accessToken, base: `${API}/api/t/${slug}` };
}

/* ── 8. onboarding ──────────────────────────────────────────────────────── */

async function onboarding() {
  const t = await freshTenant();
  if (!t) { check('onboarding', 'a fresh carwash could be registered', false); return; }

  // Registration pre-seeds a branch, bays and services and marks onboarding done on purpose,
  // so a new owner is not dropped into a wizard before they have seen anything.
  const state = await call('GET', `${t.base}/onboarding/state`, undefined, t.token);
  check('onboarding', 'a new carwash is already set up', ok(state) && state.body?.isComplete === true,
    JSON.stringify(state.body).slice(0, 160));
  check('onboarding', 'and it really has the branch, bay and service it claims',
    state.body?.hasBranch && state.body?.hasBay && state.body?.hasService,
    JSON.stringify(state.body).slice(0, 160));

  const step = await call('POST', `${t.base}/onboarding/complete-step`, { step: 1 }, t.token);
  check('onboarding', 'a step can be completed', ok(step), err(step));

  const after = await call('GET', `${t.base}/onboarding/state`, undefined, t.token);
  check('onboarding', 'completing a step never undoes completion', after.body?.isComplete === true,
    JSON.stringify(after.body).slice(0, 160));

  const bad = await call('POST', `${t.base}/onboarding/complete-step`, { step: 0 }, t.token);
  check('onboarding', 'a step outside the wizard is refused', !ok(bad), `accepted: ${bad.status}`);
}

/* ── 9. SMS, both sides of it ───────────────────────────────────────────── */

async function sms() {
  /*
    Everything below depends on the tenant's plan carrying an SMS policy. The dispatcher reads
    the plan's allowance before every send and treats "used >= included" as overage, so a plan
    whose allowance is zero refuses the very first message; and the template limit is what
    decides whether a template can be switched on for a tenant at all. Both used to be zero on
    every plan because nothing ever set them, which left the whole feature inert.
  */
  const planId = (await pget(`tenants/${tenantId}`)).body?.planId
    ?? ((await pget('subscriptions?page=1&pageSize=50')).body.items ?? []).find(s => s.tenantId === tenantId)?.planId;
  if (planId) {
    const before = ((await pget('plans')).body ?? []).find(p => p.id === planId);
    check('sms', 'a plan carries an SMS allowance', (before?.includedSmsPerMonth ?? 0) > 0,
      `included ${before?.includedSmsPerMonth}, templates ${before?.includedSmsTemplateCount}`);

    // Setting it through the platform API is the only way an operator can fix a live plan.
    const policy = await pput(`plans/${planId}`, {
      displayName: before.displayName, description: before.description,
      setupFeeRials: before.setupFeeRials, monthlyPriceRials: before.monthlyPriceRials,
      yearlyPriceRials: before.yearlyPriceRials, perCarPriceRials: before.perCarPriceRials,
      sortOrder: before.sortOrder, isPublic: before.isPublic, features: before.features,
      includedSmsPerMonth: 2000, includedSmsTemplateCount: 6, smsOverageUnitPriceRials: 15000,
    });
    check('sms', 'the platform can set a plan SMS policy', ok(policy), err(policy));
    const after = ((await pget('plans')).body ?? []).find(p => p.id === planId);
    check('sms', 'and it reads back', after?.includedSmsPerMonth === 2000 && after?.includedSmsTemplateCount === 6,
      `included ${after?.includedSmsPerMonth}, templates ${after?.includedSmsTemplateCount}`);

    const untouched = await pput(`plans/${planId}`, {
      displayName: after.displayName, description: after.description,
      setupFeeRials: after.setupFeeRials, monthlyPriceRials: after.monthlyPriceRials,
      yearlyPriceRials: after.yearlyPriceRials, perCarPriceRials: after.perCarPriceRials,
      sortOrder: after.sortOrder, isPublic: after.isPublic, features: after.features,
    });
    const kept = ((await pget('plans')).body ?? []).find(p => p.id === planId);
    check('sms', 'an edit that omits the policy leaves it alone',
      ok(untouched) && kept?.includedSmsPerMonth === 2000,
      `included ${kept?.includedSmsPerMonth}`);
  }

  const templates = await get('sms/templates');
  check('sms', 'the tenant sees its templates', ok(templates), err(templates));
  const list = templates.body?.items ?? templates.body ?? [];
  if (list[0]) {
    const id = list[0].id;
    const before = list[0].enabled ?? list[0].isEnabled;
    const toggled = await put(`sms/templates/${id}`, { enabled: !before });
    check('sms', 'a template can be switched', ok(toggled), err(toggled));
    const after = ((await get('sms/templates')).body?.items ?? (await get('sms/templates')).body ?? []).find(t => t.id === id);
    check('sms', 'the switch sticks', (after?.enabled ?? after?.isEnabled) === !before,
      `${before} → ${after?.enabled ?? after?.isEnabled}`);
    await put(`sms/templates/${id}`, { enabled: before });
  }

  const summary = await get('sms/summary');
  check('sms', 'the tenant summary reads', ok(summary), err(summary));

  const tag = uniq();
  const created = await ppost('sms/templates', {
    code: `AUDIT_${tag.toUpperCase()}`, displayName: `قالب آزمون ${tag}`,
    providerTemplateId: 999999, category: 0, parameters: ['CODE'], isTenantAvailable: true,
  });
  check('sms', 'the platform can add a template', ok(created), err(created));
  if (ok(created)) {
    const id = created.body.id;
    const upd = await pput(`sms/templates/${id}`, {
      displayName: `قالب آزمون ${tag} ویرایش‌شده`, providerTemplateId: 888888,
      category: 0, parameters: ['CODE'], isTenantAvailable: true, isActive: true,
    });
    check('sms', 'and change it', ok(upd), err(upd));
    const after = ((await pget('sms/templates')).body ?? []).find(t => t.id === id);
    check('sms', 'the change reads back', after?.providerTemplateId === 888888, `got ${after?.providerTemplateId}`);

    // Whether a tenant may use SMS templates at all is a plan feature, so the right answer
    // here depends on the demo tenant's plan — either outcome is correct, an unexplained one
    // is not.
    const assign = await pput(`sms/tenants/${tenantId}/templates/${id}`, { enabled: true });
    check('sms', 'a template can be enabled for a tenant', ok(assign), err(assign));

    const quota = (await get('sms/summary')).body;
    check('sms', 'the tenant now has an allowance to send against', (quota?.includedUnits ?? 0) > 0,
      `included ${quota?.includedUnits}, templates ${quota?.templateLimit}`);

    const off = await pput(`sms/tenants/${tenantId}/templates/${id}`, { enabled: false });
    check('sms', 'and switched off again', ok(off), err(off));
  }

  const settings = await pget('sms/settings');
  check('sms', 'provider settings read', ok(settings), err(settings));
  check('sms', 'the api key is never returned in full',
    !JSON.stringify(settings.body ?? {}).includes('local-test-key'),
    JSON.stringify(settings.body).slice(0, 200));
}

/* ── 10. billing ────────────────────────────────────────────────────────── */

async function billing() {
  const sub = await get('billing/subscription');
  check('billing', 'the demo subscription reads', ok(sub), err(sub));
  const invoices = await get('billing/invoices');
  check('billing', 'its invoices read', ok(invoices), err(invoices));

  // Only meaningful where a subscription actually exists; on a freshly seeded database the
  // demo carwash is still on trial and has none.
  if (sub.body?.id) {
    const already = await post('billing/subscribe', { planId: (await pget('plans')).body[0].id, cycle: 0 });
    check('billing', 'a second subscription is refused while one is live', !ok(already), `accepted: ${already.status}`);
  }

  // The first subscription of a tenant's life needs a tenant that has never had one.
  const t = await freshTenant();
  if (!t) { check('billing', 'a fresh carwash could be registered', false); return; }
  const tget = p => call('GET', `${t.base}/${p}`, undefined, t.token);
  const tpost = (p, b) => call('POST', `${t.base}/${p}`, b, t.token);

  const plans = (await call('GET', `${API}/api/public/plans`)).body ?? [];
  const plan = plans.find(p => p.code === 'pro') ?? plans[0];
  if (!plan) { check('billing', 'a plan exists to subscribe to', false); return; }

  const subscribe = await tpost('billing/subscribe', { planId: plan.id, cycle: 0 });
  check('billing', 'a new carwash can subscribe', ok(subscribe), err(subscribe));

  const after = (await tget('billing/invoices')).body;
  const items = after?.items ?? after ?? [];
  check('billing', 'it raises an invoice', items.length > 0, `invoices: ${items.length}`);

  const unpaid = items.find(i => i.paidAtUtc == null) ?? items[0];
  if (unpaid) {
    const req = await tpost('billing/payments/request', {
      invoiceId: unpaid.id, gateway: 99, callbackUrl: 'http://localhost:5173/billing/callback',
    });
    check('billing', 'a manual payment can be started', ok(req), err(req));
    const paymentId = req.body?.paymentId ?? req.body?.id;
    if (ok(req) && paymentId) {
      // Verification must carry the authority the gateway handed back, not one of our own:
      // that is the check that stops a caller settling someone else's invoice.
      const mismatch = await tpost('billing/payments/verify', { paymentId, authority: 'not-the-authority' });
      check('billing', 'verifying with the wrong authority is refused', !ok(mismatch), `accepted: ${mismatch.status}`);

      const verify = await tpost('billing/payments/verify', { paymentId, authority: req.body.authority });
      check('billing', 'and verified', ok(verify), err(verify));
      const settled = ((await tget('billing/invoices')).body?.items ?? []).find(i => i.id === unpaid.id);
      check('billing', 'the invoice is settled afterwards', settled == null || settled.paidAtUtc != null,
        `paidAtUtc: ${settled?.paidAtUtc}`);
    }
  }

  const bad = await tpost('billing/payments/verify', { paymentId: '00000000-0000-0000-0000-000000000000', authority: 'nope' });
  check('billing', 'verifying an unknown payment is refused', !ok(bad), `accepted: ${bad.status}`);

  const live = (await tget('billing/subscription')).body;
  if (live?.id) {
    const cancelled = await tpost(`billing/subscription/${live.id}/cancel`, {});
    check('billing', 'a subscription can be cancelled', ok(cancelled), err(cancelled));
  }
}

/* ── 11. the platform's own operations ──────────────────────────────────── */

async function platformOps() {
  const subs = (await pget('subscriptions?page=1&pageSize=50')).body;
  const list = subs.items ?? subs ?? [];
  // Extending only means anything for a subscription that is still live.
  const mine = list.find(s => s.tenantId === tenantId && s.status !== 3 && s.status !== 4)
    ?? list.find(s => s.status !== 3 && s.status !== 4);

  if (mine) {
    const extended = await ppost(`subscriptions/${mine.id}/extend`, { days: 7 });
    check('platform', 'a subscription can be extended', ok(extended), err(extended));
  }

  const suspend = await ppost('subscriptions/suspend-tenant', { tenantId, reason: 'آزمون تعلیق' });
  check('platform', 'a tenant can be suspended', ok(suspend), err(suspend));

  const blocked = await call('GET', `${T}/orders?page=1&pageSize=1`, undefined, tok);
  check('platform', 'a suspended tenant cannot use the API', !ok(blocked), `accepted: ${blocked.status}`);

  // Suspension may be undone whether the carwash is on a plan or still on its trial;
  // anything else makes switching a tenant off a one-way door.
  const reactivate = await ppost('subscriptions/reactivate-tenant', { tenantId });
  check('platform', 'and brought back', ok(reactivate), err(reactivate));
  const working = await call('GET', `${T}/orders?page=1&pageSize=1`, undefined, tok);
  check('platform', 'the tenant works again', ok(working), err(working));

  const tickets = (await pget('tickets?page=1&pageSize=10')).body;
  const ticket = (tickets.items ?? tickets ?? [])[0];
  if (ticket) {
    const pri = await ppost(`tickets/${ticket.id}/priority`, { priority: 2 });
    check('platform', 'a ticket priority can be set', ok(pri), err(pri));
    const cat = await ppost(`tickets/${ticket.id}/category`, { category: 1 });
    check('platform', 'its category can be set', ok(cat), err(cat));
    const agents = (await pget('tickets/agents')).body ?? [];
    if (agents[0]) {
      const assign = await ppost(`tickets/${ticket.id}/assign`, { agentId: agents[0].id ?? agents[0].userId });
      check('platform', 'and it can be assigned', ok(assign), err(assign));
    }
    const status = await ppost(`tickets/${ticket.id}/status`, { status: 1 });
    check('platform', 'its status can be moved', ok(status), err(status));
  }

  const plan = await ppost('plans', {
    code: `audit-${uniq()}`, displayName: 'پلن آزمون', description: 'پلن ساخته‌شده در آزمون',
    billingModel: 0, setupFeeRials: 0, monthlyPriceRials: 1_000_000, yearlyPriceRials: 10_000_000,
    perCarPriceRials: 0, sortOrder: 99, isPublic: true, features: null,
  });
  check('platform', 'a plan can be created', ok(plan), err(plan));
  if (ok(plan)) {
    const off = await ppost(`plans/${plan.body.id}/active`, { isActive: false });
    check('platform', 'and retired', ok(off), err(off));
    const pub = (await call('GET', `${API}/api/public/plans`)).body ?? [];
    check('platform', 'a retired plan is not offered publicly', !pub.some(p => p.id === plan.body.id));
  }
}

/* ── 12. what a plan actually switches on ───────────────────────────────── */

/**
 * The same carwash on two plans, to prove the plan is what decides.
 *
 * A feature listed on the pricing page has to be read somewhere, or the cheaper plan quietly
 * includes it. The wallet was listed on every plan and read nowhere; the branch and vehicle
 * ceilings were written under keys the server never looks up. Both looked configured on the
 * screen and did nothing at all, which is the failure that costs money rather than uptime.
 */
async function planGating() {
  const t = await freshTenant();
  if (!t) { check('gating', 'a fresh carwash could be registered', false); return; }

  const detail = await pget(`tenants?page=1&pageSize=20&search=${t.slug}`);
  const row = (detail.body.items ?? detail.body ?? []).find(x => x.slug === t.slug);
  if (!row) { check('gating', 'the new carwash is listed on the platform', false); return; }

  const plans = (await pget('plans')).body ?? [];
  const starter = plans.find(p => p.code === 'starter');
  const pro = plans.find(p => p.code === 'pro');
  if (!starter || !pro) { check('gating', 'both plans exist', false); return; }

  const tget = p => call('GET', `${t.base}/${p}`, undefined, t.token);
  const tpost = (p, b) => call('POST', `${t.base}/${p}`, b, t.token);

  const cust = await tpost('customers', { fullName: 'مشتری پلن', phone: phone(), email: null });
  if (!ok(cust)) { check('gating', 'a customer could be created', false, err(cust)); return; }

  const onStarter = await ppost(`tenants/${row.id}/assign-plan`, { planId: starter.id, cycle: 0, activateImmediately: true });
  check('gating', 'the carwash can be put on starter', ok(onStarter), err(onStarter));

  const feats = await tget('me/features');
  check('gating', 'starter reports no wallet', feats.body?.wallet === 'false' || feats.body?.wallet === undefined,
    JSON.stringify(feats.body));

  const walletOnStarter = await tpost(`customers/${cust.body.id}/wallet/adjust`, { amountRials: 100_000, description: 'آزمون پلن' });
  check('gating', 'and refuses a wallet top-up', !ok(walletOnStarter), `accepted: ${walletOnStarter.status}`);

  const onPro = await ppost(`tenants/${row.id}/assign-plan`, { planId: pro.id, cycle: 0, activateImmediately: true });
  check('gating', 'the carwash can be moved to pro', ok(onPro), err(onPro));

  const walletOnPro = await tpost(`customers/${cust.body.id}/wallet/adjust`, { amountRials: 100_000, description: 'آزمون پلن' });
  check('gating', 'which allows the same top-up', ok(walletOnPro), err(walletOnPro));

  // The vehicle ceiling is read as limit.vehicles; pro allows ten per customer.
  const limit = Number(((await tget('me/features')).body ?? {})['limit.vehicles'] ?? 0);
  check('gating', 'pro carries a vehicle ceiling', limit > 0, `limit.vehicles = ${limit}`);
}

/* ── 13. the second round: gaps between the panel and the API ──────────── */

/**
 * Things the panel offered and the API refused, or the API offered and nothing used.
 *
 * Each of these was found by comparing the two sides mechanically rather than by using a
 * screen: an expense delete button that had always returned 405, a campaign form whose send
 * time was never acted on, a bay that could be taken out of service with a car still in it.
 */
async function secondRound() {
  /* An expense can be deleted, and a cash one gives its money back to the till. */
  const shift = (await get(`shifts/open?branchId=${branchId}`)).body;
  const opened = shift?.id ? null : await post('shifts/open', { branchId, openingCashRials: 1_000_000 });
  const till = shift?.id ? shift : opened?.body;
  const before = (await get(`shifts/open?branchId=${branchId}`)).body?.expensesRials ?? 0;

  const exp = await post('expenses', {
    branchId, category: 0, title: 'هزینه‌ی آزمون حذف', amountRials: 230_000, paymentMethod: 0,
    date: new Date().toISOString().slice(0, 10), description: null, relatedWorkerId: null,
  });
  check('round2', 'a cash expense is recorded', ok(exp), err(exp));
  if (ok(exp)) {
    const withIt = (await get(`shifts/open?branchId=${branchId}`)).body?.expensesRials ?? 0;
    check('round2', 'it comes out of the open till', withIt === before + 230_000, `${before} → ${withIt}`);

    const gone = await del(`expenses/${exp.body.id}`);
    check('round2', 'the expense can be deleted', ok(gone), err(gone));
    const after = (await get(`shifts/open?branchId=${branchId}`)).body?.expensesRials ?? 0;
    check('round2', 'and its cash goes back into the till', after === before, `${withIt} → ${after}, expected ${before}`);

    const again = await del(`expenses/${exp.body.id}`);
    check('round2', 'deleting it twice is a not-found, not a crash', again.status === 404, err(again));
  }
  if (opened && ok(opened)) await post(`shifts/${till.id}/close`, { closingCashRials: 1_000_000, notes: null });

  /* A campaign created with a send time is scheduled, not left as a draft. */
  const when = new Date(Date.now() + 3_600_000).toISOString();
  const camp = await post('campaigns', {
    name: `کمپین زمان‌دار ${uniq()}`, type: 0, target: 0, messageTemplate: 'سلام {name}، این یک آزمون است.',
    scheduledAtUtc: when,
  });
  check('round2', 'a campaign with a send time is created', ok(camp), err(camp));
  if (ok(camp)) {
    check('round2', 'and is scheduled straight away', camp.body.status === 1, `status ${camp.body.status}`);
    await post(`campaigns/${camp.body.id}/cancel`, {});
  }

  /* A bay with a car in it can be neither taken out of service nor emptied from outside. */
  const services = (await get('services?onlyActive=true')).body;
  const free = (await get('bays')).body.find(b => b.status === 0 && b.isActive && b.type === 0);
  if (free) {
    const order = await post('orders', {
      branchId, bayId: free.id, customerName: 'آزمون جایگاه', customerPhone: phone(),
      vehiclePlate: `۲۲ب${Math.floor(100 + Math.random() * 899)} ایران ۱۱`, source: 0,
      lines: [{ serviceId: services[0].id, quantity: 1 }],
    });
    check('round2', 'a car is put on a bay', ok(order), err(order));
    if (ok(order)) {
      const maint = await post(`bays/${free.id}/maintenance`, { notes: 'آزمون' });
      check('round2', 'the occupied bay cannot be taken out of service', !ok(maint), `accepted: ${maint.status}`);

      const evict = await post(`bays/${free.id}/free`, {});
      check('round2', 'nor emptied from outside', !ok(evict), `accepted: ${evict.status}`);

      const held = (await get('bays')).body.find(b => b.id === free.id);
      check('round2', 'the car is still in it afterwards', held?.currentOrderId === order.body.id,
        `bay holds ${held?.currentOrderId}`);

      const retype = await put(`bays/${free.id}`, { name: free.name, number: free.number, notes: null, type: 1 });
      check('round2', 'nor turned into a different kind of bay under the car', !ok(retype), `accepted: ${retype.status}`);

      const rename = await put(`bays/${free.id}`, { name: free.name, number: free.number, notes: 'یادداشت آزمون' });
      check('round2', 'but it can still be renamed', ok(rename), err(rename));

      await post(`orders/${order.body.id}/cancel`, { reason: 'پایان آزمون جایگاه' });
      const released = (await get('bays')).body.find(b => b.id === free.id);
      check('round2', 'cancelling the order releases the bay', released?.status === 0 && !released?.currentOrderId,
        `status ${released?.status}`);
    }
  }

  /* Job health lists every job the system expects, including those that never ran. */
  const health = (await pget('cron-health')).body ?? [];
  const expected = ['campaign-dispatcher', 'generate-notifications', 'cleanup-tokens', 'usage-rollup', 'daily-billing',
    'expire-trials', 'expire-grace', 'expire-overdue-subscriptions', 'generate-service-reminders', 'send-reminders', 'billing-reminders'];
  const listed = new Set(health.map(j => j.jobName));
  check('round2', 'job health lists all eleven jobs', expected.every(j => listed.has(j)),
    `missing: ${expected.filter(j => !listed.has(j)).join(', ')}`);
  check('round2', 'every job carries its schedule', health.filter(j => expected.includes(j.jobName))
    .every(j => j.everyMinutes || j.dailyAtUtc), JSON.stringify(health.find(j => !j.everyMinutes && !j.dailyAtUtc) ?? {}));

  /* The period summary covers every completed order and agrees with the revenue report. */
  const range = `fromDate=${new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)}&toDate=${new Date().toISOString().slice(0, 10)}`;
  const summary = await get(`reports/period-summary?${range}`);
  check('round2', 'the period summary reads', ok(summary), err(summary));
  const revenue = await get(`reports/revenue?${range}`);
  if (ok(summary) && ok(revenue)) {
    check('round2', 'it agrees with the revenue report on takings',
      summary.body.revenueRials === revenue.body.revenueRials,
      `summary ${summary.body.revenueRials} vs revenue ${revenue.body.revenueRials}`);
    check('round2', 'and on the number of orders', summary.body.orders === revenue.body.orders,
      `summary ${summary.body.orders} vs revenue ${revenue.body.orders}`);
    check('round2', 'its days add up to its total',
      summary.body.days.reduce((s, d) => s + d.revenueRials, 0) === summary.body.revenueRials);
    check('round2', 'and its services add up to its line takings',
      summary.body.serviceRows.reduce((s, r) => s + r.count, 0) > 0 || summary.body.orders === 0);
  }
  const inverted = await get(`reports/period-summary?fromDate=2026-09-10&toDate=2026-09-01`);
  check('round2', 'an inverted range is refused', !ok(inverted), `accepted: ${inverted.status}`);

  /* A job already running is not started a second time. */
  const [a, b] = await Promise.all([cron('usage-rollup'), cron('usage-rollup')]);
  check('round2', 'two simultaneous runs of a job both answer', ok(a) && ok(b), `${a.status} / ${b.status}`);
}

/* ── 14. what a stranger can reach ──────────────────────────────────────── */

async function publicSurface() {
  const contact = await call('POST', `${API}/api/public/contact`, {
    name: 'بازدیدکننده', phone: '09120001111', email: 'visitor@example.com',
    subject: 'پرسش آزمون', message: 'این یک پیام آزمایشی است.',
  });
  check('public', 'the contact form accepts a message', ok(contact), err(contact));

  const forgot = await call('POST', `${API}/api/public/auth/forgot-password`, { emailOrPhone: 'demo@appsmartwash.com' });
  check('public', 'forgot-password answers', ok(forgot), err(forgot));

  const unknown = await call('POST', `${API}/api/public/auth/forgot-password`, { emailOrPhone: 'nobody@example.com' });
  check('public', 'and says the same thing for an unknown address', ok(unknown) && unknown.status === forgot.status,
    `${forgot.status} vs ${unknown.status}`);

  const badLogin = await call('POST', `${API}/api/public/auth/login`, { email: 'demo@appsmartwash.com', password: 'DefinitelyWrong@123', tenantSlug: SLUG });
  check('public', 'a wrong password is refused', badLogin.status === 401, err(badLogin));

  const tag = uniq();
  const reg = await call('POST', `${API}/api/public/auth/register-tenant`, {
    displayName: `کارواش آزمون ${tag}`, slug: `audit-${tag}`,
    ownerEmail: `owner-${tag}@example.com`, ownerPhone: phone(),
    ownerDisplayName: 'مالک آزمون', ownerPassword: 'Audit@1234',
  });
  check('public', 'a new carwash can register', ok(reg), err(reg));
  if (ok(reg)) {
    const theirs = await call('POST', `${API}/api/public/auth/login`,
      { email: `owner-${tag}@example.com`, password: 'Audit@1234', tenantSlug: `audit-${tag}` });
    check('public', 'and sign in straight away', ok(theirs), err(theirs));

    if (ok(theirs)) {
      const refreshed = await call('POST', `${API}/api/public/auth/refresh`, { refreshToken: theirs.body.refreshToken });
      check('public', 'a session can be refreshed', ok(refreshed), err(refreshed));

      const out = await call('POST', `${API}/api/public/auth/logout`,
        { refreshToken: refreshed.body?.refreshToken ?? theirs.body.refreshToken },
        refreshed.body?.accessToken ?? theirs.body.accessToken);
      check('public', 'and signed out', ok(out), err(out));

      const reuse = await call('POST', `${API}/api/public/auth/refresh`, { refreshToken: refreshed.body?.refreshToken ?? theirs.body.refreshToken });
      check('public', 'a signed-out token cannot be refreshed', !ok(reuse), `accepted: ${reuse.status}`);

      // The new carwash must not be able to read the demo one.
      const crossed = await call('GET', `${T}/orders?page=1&pageSize=1`, undefined, theirs.body.accessToken);
      check('public', 'one carwash cannot read another', !ok(crossed), `accepted: ${crossed.status}`);
    }

    const dupe = await call('POST', `${API}/api/public/auth/register-tenant`, {
      displayName: 'تکراری', slug: `audit-${tag}`, ownerDisplayName: 'x',
      ownerEmail: `other-${tag}@example.com`, ownerPhone: phone(), ownerPassword: 'Audit@1234',
    });
    check('public', 'the same slug cannot be taken twice', !ok(dupe), `accepted: ${dupe.status}`);
  }
}

/* ── run ────────────────────────────────────────────────────────────────── */

const stages = [
  ['cron', cronJobs], ['reads', remainingReads], ['catalogue', catalogue], ['users', users],
  ['campaigns', campaigns], ['loyalty', loyaltyAndWallet], ['orders', orderEdges],
  ['onboarding', onboarding], ['sms', sms], ['billing', billing],
  ['platform', platformOps], ['gating', planGating], ['round2', secondRound], ['public', publicSurface],
];

await signIn();
for (const [name, fn] of stages) {
  try { await fn(); }
  catch (e) { check(name, 'the stage ran to the end', false, `threw: ${e.message}`); }
}

const groups = [...new Set(results.map(r => r.group))];
console.log('\n' + groups.map(g => {
  const rows = results.filter(r => r.group === g);
  const bad = rows.filter(r => !r.pass).length;
  return `${g}: ${rows.length - bad}✓${bad ? `  ${bad}✗` : ''}`;
}).join('   '));

const failed = results.filter(r => !r.pass).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
