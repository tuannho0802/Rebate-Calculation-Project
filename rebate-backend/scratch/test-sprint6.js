const http = require('http');

const PORT = 3001;
const BASE = '/api';

function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : null;
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: `${BASE}${path}`,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    if (body) options.headers['Content-Length'] = Buffer.byteLength(body);

    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// Global interceptor wraps all responses as { success, data }
// so "body.data" is the actual service return value
function unwrap(res) {
  return res.body?.data ?? res.body;
}

let pass = 0, fail = 0;
function check(label, condition) {
  if (condition) { console.log(`  ✅ PASS: ${label}`); pass++; }
  else           { console.log(`  ❌ FAIL: ${label}`); fail++; }
}

async function run() {
  console.log('\n========================================');
  console.log('SPRINT 6 — Dashboard, Reporting & Notifications');
  console.log(`Date: ${new Date().toISOString().split('T')[0]}`);
  console.log('========================================\n');

  // ── AUTH ──────────────────────────────────────────────────────────────────
  console.log('▶ AUTH: Login MIB + Lv1');
  const mibLogin = await request('POST', '/auth/login', { email: 'mib@test.com', password: 'Test@1234' });
  check('MIB login → 200', mibLogin.status === 200);
  const mibToken = mibLogin.body.data?.accessToken;

  const lv1Login = await request('POST', '/auth/login', { email: 'lv1-a@test.com', password: 'Test@1234' });
  check('Lv1 login → 200', lv1Login.status === 200);
  const lv1Token = lv1Login.body.data?.accessToken;
  const lv1Id    = lv1Login.body.data?.user?.id;

  // ── DASHBOARD: Overview ───────────────────────────────────────────────────
  console.log('\n▶ DASHBOARD — Overview');

  const noTokenRes = await request('GET', '/dashboard/overview');
  check('GET /dashboard/overview không token → 401', noTokenRes.status === 401);

  const overviewMibRes = await request('GET', '/dashboard/overview', null, mibToken);
  check('GET /dashboard/overview (MIB) → 200', overviewMibRes.status === 200);
  const ov = unwrap(overviewMibRes);
  check('Có wallet.balance', ov?.wallet?.balance !== undefined);
  check('Có rebate.thisMonth', ov?.rebate?.thisMonth !== undefined);
  check('Có rebate.lastMonth', ov?.rebate?.lastMonth !== undefined);
  check('Có subtree.totalIbs', ov?.subtree?.totalIbs !== undefined);
  check('Có subtree.activeIbs', ov?.subtree?.activeIbs !== undefined);
  check('Có lots.thisMonth', ov?.lots?.thisMonth !== undefined);
  check('Có topIbs (array)', Array.isArray(ov?.topIbs));

  const overviewLv1Res = await request('GET', '/dashboard/overview', null, lv1Token);
  check('GET /dashboard/overview (Lv1) → 200', overviewLv1Res.status === 200);

  // ── DASHBOARD: Rebate Summary ─────────────────────────────────────────────
  console.log('\n▶ DASHBOARD — Rebate Summary');

  const sumRes = await request('GET', '/dashboard/rebate-summary?period=2026-06', null, lv1Token);
  check('GET /dashboard/rebate-summary?period=2026-06 → 200', sumRes.status === 200);
  const sd = unwrap(sumRes);
  check('Có period = 2026-06', sd?.period === '2026-06');
  check('Có total (number)', typeof sd?.total === 'number');
  check('Có byAsset (array)', Array.isArray(sd?.byAsset));
  check('Có byRebateType (array)', Array.isArray(sd?.byRebateType));
  check('Có byLevel (array)', Array.isArray(sd?.byLevel));

  const sumBad = await request('GET', '/dashboard/rebate-summary?period=invalid', null, lv1Token);
  check('period không hợp lệ → 400', sumBad.status === 400);

  const sumNone = await request('GET', '/dashboard/rebate-summary', null, lv1Token);
  check('period bị thiếu → 400', sumNone.status === 400);

  // ── DASHBOARD: IB Performance ─────────────────────────────────────────────
  console.log('\n▶ DASHBOARD — IB Performance');

  const perfRes = await request('GET', '/dashboard/ib-performance?period=2026-06', null, mibToken);
  check('GET /dashboard/ib-performance?period=2026-06 → 200', perfRes.status === 200);
  // interceptor wraps: { success, data: <service_return> }
  // service returns: { period, data:[], total, page, limit }
  // interceptor sees an object and wraps its whole value into .data
  const perfRaw = unwrap(perfRes); // = { period, data:[], total, page, limit }
  check('Có items (array)', Array.isArray(perfRaw?.items));
  check('Có total', perfRaw?.total !== undefined);
  check('Có page', perfRaw?.page !== undefined);
  check('Có limit', perfRaw?.limit !== undefined);
  if (Array.isArray(perfRaw?.items) && perfRaw.items.length > 0) {
    const first = perfRaw.items[0];
    check('Item có id', !!first.id);
    check('Item có email', !!first.email);
    check('Item có level', first.level !== undefined);
    check('Item có lots', first.lots !== undefined);
    check('Item có rebate', first.rebate !== undefined);
    check('Item có txCount', first.txCount !== undefined);
  } else {
    console.log('  ℹ️  INFO: data rỗng, bỏ qua deep check');
  }

  const perfPaged = await request('GET', '/dashboard/ib-performance?period=2026-06&page=1&limit=5', null, mibToken);
  check('Pagination limit=5 → 200', perfPaged.status === 200);
  const pp = unwrap(perfPaged);
  check('items.length <= 5', (pp?.items?.length ?? 0) <= 5);
  check('limit field = 5', pp?.limit === 5);

  // ── NOTIFICATIONS ─────────────────────────────────────────────────────────
  console.log('\n▶ NOTIFICATIONS');

  const notifListRes = await request('GET', '/notifications', null, lv1Token);
  check('GET /notifications → 200', notifListRes.status === 200);
  const nl = unwrap(notifListRes); // { data:[], meta:{...} }
  check('Có items (array)', Array.isArray(nl?.items));
  check('Có meta.unreadCount', nl?.meta?.unreadCount !== undefined);

  const countRes = await request('GET', '/notifications/count', null, lv1Token);
  check('GET /notifications/count → 200', countRes.status === 200);
  const cn = unwrap(countRes);
  check('Có unreadCount', cn?.unreadCount !== undefined);

  const unreadRes = await request('GET', '/notifications?isRead=false', null, lv1Token);
  check('GET /notifications?isRead=false → 200', unreadRes.status === 200);
  const uo = unwrap(unreadRes);
  if (Array.isArray(uo?.items) && uo.items.length > 0) {
    check('Chỉ trả unread', uo.items.every((n) => n.isRead === false));
  } else {
    console.log('  ℹ️  INFO: Không có unread để kiểm tra');
  }

  // Tạo notification để test mark read
  const sendRes = await request('POST', '/notifications/send',
    { recipientId: lv1Id, title: 'Sprint 6 Test', body: 'Test notification S6' },
    mibToken
  );
  check('MIB gửi notification cho Lv1 → 201', sendRes.status === 201);
  const notifId = unwrap(sendRes)?.id;

  if (notifId) {
    const readRes = await request('PATCH', `/notifications/${notifId}/read`, null, lv1Token);
    check('PATCH /notifications/:id/read (đúng user) → 200', readRes.status === 200);
    const rn = unwrap(readRes);
    check('isRead = true sau read', rn?.isRead === true);

    const wrongRead = await request('PATCH', `/notifications/${notifId}/read`, null, mibToken);
    check('PATCH /notifications/:id/read (sai user) → 403/404', [403, 404].includes(wrongRead.status));
  } else {
    console.log('  ⚠️  SKIP: Không lấy được notifId');
  }

  const readAllRes = await request('PATCH', '/notifications/read-all', null, lv1Token);
  check('PATCH /notifications/read-all → 200', readAllRes.status === 200);
  const ra = unwrap(readAllRes);
  check('updated là number', typeof ra?.updated === 'number');

  const countAfterRes = await request('GET', '/notifications/count', null, lv1Token);
  const cna = unwrap(countAfterRes);
  check('unreadCount = 0 sau read-all', cna?.unreadCount === 0);

  // ── SUMMARY ────────────────────────────────────────────────────────────────
  console.log('\n========================================');
  console.log(`Results: ${pass} passed, ${fail} failed`);
  if (fail === 0) console.log('✅ TẤT CẢ TEST SPRINT 6 PASS!');
  else { console.log('❌ MỘT SỐ TEST THẤT BẠI'); process.exit(1); }
  console.log('========================================\n');
}

run().catch((err) => {
  console.error('\n❌ CRASH:', err.message);
  process.exit(1);
});
