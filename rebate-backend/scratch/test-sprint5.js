const http = require('http');
const assert = require('assert');

const PORT = 3001;

function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: `/api${path}`,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    if (data) options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: body ? JSON.parse(body) : {}, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  console.log('\n========================================');
  console.log('SPRINT 5 — EXPORT & IB PROFILE');
  console.log('Date:', new Date().toISOString().split('T')[0]);
  console.log('========================================\n');

  let mibToken, lv1Token, lv2Token;
  let lv1Id, lv2Id;

  try {
    console.log('▶ AUTH: Login MIB + Lv1');
    const mibLogin = await request('POST', '/auth/login', { email: 'mib@test.com', password: 'Test@1234' });
    assert(mibLogin.status === 200, 'MIB login → 200');
    mibToken = mibLogin.body.data.accessToken;

    const lv1Login = await request('POST', '/auth/login', { email: 'lv1-a@test.com', password: 'Test@1234' });
    assert(lv1Login.status === 200, 'Lv1 login → 200');
    lv1Token = lv1Login.body.data.accessToken;
    lv1Id = lv1Login.body.data.user.id;
    console.log('  ✅ PASS: Đăng nhập thành công');

    console.log('\n▶ IB PROFILE: Update & GET');
    const updateDto = {
      phone: '0901234567',
      country: 'VN',
      bankAccount: JSON.stringify({ bank: 'VCB', acc: '123' }),
      paymentInfo: JSON.stringify({ method: 'USDT' })
    };
    const updateRes = await request('PATCH', `/ib/${lv1Id}/profile`, updateDto, lv1Token);
    assert(updateRes.status === 200, 'PATCH /profile → 200');
    console.log('  ✅ PASS: PATCH /ib/:id/profile → 200');

    const profileRes = await request('GET', `/ib/${lv1Id}/profile`, null, lv1Token);
    assert(profileRes.status === 200, 'GET /profile → 200');
    assert(profileRes.body.data.phone === '0901234567', 'Có phone mới');
    assert(profileRes.body.data.bankAccount.bank === 'VCB', 'JSON parsed đúng');
    console.log('  ✅ PASS: GET /ib/:id/profile → trả về đúng profile');

    const invalidBankRes = await request('PATCH', `/ib/${lv1Id}/profile`, { bankAccount: 'invalid json' }, lv1Token);
    assert(invalidBankRes.status === 403, 'Invalid JSON bankAccount → 403');
    console.log('  ✅ PASS: PATCH /ib/:id/profile với invalid bank JSON → 403');

    // Create sub-IB to check referral code
    const newIbRes = await request('POST', '/ib', { email: `test-ref-${Date.now()}@test.com`, password: 'Test@1234', name: 'Test' }, lv1Token);
    assert(newIbRes.status === 201, 'POST /ib → 201');
    assert(newIbRes.body.data.referralCode, 'Có referral code');
    assert(newIbRes.body.data.referralCode.startsWith('IB-'), 'Bắt đầu bằng IB-');
    console.log('  ✅ PASS: POST /ib tự động tạo referralCode hợp lệ');
    const newIbId = newIbRes.body.data.id;

    // Xem profile người ngoài subtree
    const mibId = mibLogin.body.data.user.id;
    const viewMibRes = await request('GET', `/ib/${mibId}/profile`, null, lv1Token);
    assert(viewMibRes.status === 403, 'Lv1 xem MIB → 403');
    console.log('  ✅ PASS: GET /ib/:id/profile (Lv1 xem MIB ngoài subtree) → 403');

    console.log('\n▶ EXPORT EXCEL — Rebate Config');
    const exportConfigRes = await request('GET', '/export/rebate-config?period=2026-06', null, lv1Token);
    assert(exportConfigRes.status === 200, 'GET /export/rebate-config → 200');
    assert(exportConfigRes.headers['content-type'] === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Type đúng');
    assert(exportConfigRes.headers['content-length'] > 0, 'Content-Length > 0');
    console.log('  ✅ PASS: Export rebate config trả về file Excel hợp lệ');

    console.log('\n▶ EXPORT EXCEL — Transactions');
    const exportTxRes = await request('GET', '/export/transactions?period=2026-06', null, lv1Token);
    assert(exportTxRes.status === 200, 'GET /export/transactions → 200');
    assert(exportTxRes.headers['content-type'] === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Type đúng');
    assert(exportTxRes.headers['content-length'] > 0, 'Content-Length > 0');
    console.log('  ✅ PASS: Export transactions trả về file Excel hợp lệ');

    const exportOutTxRes = await request('GET', `/export/transactions?ibId=${mibId}`, null, lv1Token);
    assert(exportOutTxRes.status === 403, 'Export ngoài subtree → 403');
    console.log('  ✅ PASS: GET /export/transactions ngoài subtree → 403');

    console.log('\n▶ AUDIT LOGS');
    const auditRes = await request('GET', '/audit/logs?action=IB_PROFILE_UPDATE', null, mibToken);
    assert(auditRes.body.data.length > 0, 'Có log IB_PROFILE_UPDATE');
    console.log('  ✅ PASS: GET /audit/logs?action=IB_PROFILE_UPDATE → có log');

    console.log('\n✅ TẤT CẢ TEST SPRINT 5 PASS!');

  } catch (err) {
    console.error('\n❌ TEST THẤT BẠI:');
    console.error(err);
    process.exit(1);
  }
}

runTests();
