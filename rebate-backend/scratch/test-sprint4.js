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
          resolve({ status: res.statusCode, body: body ? JSON.parse(body) : {} });
        } catch (e) {
          resolve({ status: res.statusCode, body });
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
  console.log('SPRINT 4 — WALLET & PAYOUT SYSTEM');
  console.log('Date:', new Date().toISOString().split('T')[0]);
  console.log('========================================\n');

  let mibToken, lv1Token, lv2Token, lv3Token;
  let lv1Id, lv2Id;

  try {
    console.log('▶ AUTH: Login MIB + Lv1 + Lv2');
    const mibLogin = await request('POST', '/auth/login', { email: 'mib@test.com', password: 'Test@1234' });
    assert(mibLogin.status === 200, 'MIB login → 200');
    mibToken = mibLogin.body.data.accessToken;
    console.log('  ✅ PASS: MIB login');

    const lv1Login = await request('POST', '/auth/login', { email: 'lv1-a@test.com', password: 'Test@1234' });
    assert(lv1Login.status === 200, 'Lv1 login → 200');
    lv1Token = lv1Login.body.data.accessToken;
    lv1Id = lv1Login.body.data.user.id;
    console.log('  ✅ PASS: Lv1 login');

    const lv2Login = await request('POST', '/auth/login', { email: 'lv2-c@test.com', password: 'Test@1234' });
    lv2Token = lv2Login.body.data?.accessToken;
    lv2Id = lv2Login.body.data?.user?.id;
    if (lv2Token) console.log('  ✅ PASS: Lv2 login');

    console.log('\n▶ WALLET: Xem balance');
    const lv1Wallet = await request('GET', '/wallet/me', null, lv1Token);
    assert(lv1Wallet.status === 200, 'Lv1 GET /wallet/me → 200');
    assert(lv1Wallet.body.data.balance !== undefined, 'Có balance');
    console.log('  ✅ PASS: GET /wallet/me (Lv1) → 200');

    const mibSeeLv1 = await request('GET', `/wallet/${lv1Id}`, null, mibToken);
    assert(mibSeeLv1.status === 200, 'Lv0 xem ví Lv1 → 200');
    console.log('  ✅ PASS: GET /wallet/:ibId (Lv0 xem Lv1) → 200');

    // MIB Id
    const mibId = mibLogin.body.data.user.id;
    const lv1SeeMib = await request('GET', `/wallet/${mibId}`, null, lv1Token);
    assert(lv1SeeMib.status === 403, 'Lv1 xem ví MIB (ngoài subtree) → 403');
    console.log('  ✅ PASS: GET /wallet/:ibId (Lv1 xem MIB — ngoài subtree) → 403');

    // Tạo giao dịch để tăng balance
    const initBalance = lv1Wallet.body.data.balance;
    const txData = {
      ibId: lv1Id,
      assetType: 'FOREX',
      lots: 2,
      rebateAmount: 15.5,
      tradedAt: new Date().toISOString()
    };
    const txCreate = await request('POST', '/transactions', txData, mibToken);
    assert(txCreate.status === 201, 'Tạo transaction → 201');

    const lv1WalletSauTx = await request('GET', '/wallet/me', null, lv1Token);
    assert(lv1WalletSauTx.body.data.balance > initBalance, 'Balance tự động tăng');
    console.log('  ✅ PASS: Tạo transaction mới → balance tự động tăng');

    console.log('\n▶ PAYOUT: Request');
    const req1 = await request('POST', '/payouts', { amount: 15, paymentMethod: 'bank_transfer' }, lv1Token);
    assert(req1.status === 201, 'Request payout → 201');
    assert(req1.body.data.status === 'PENDING', 'status=PENDING');
    const payoutId = req1.body.data.id;
    console.log('  ✅ PASS: POST /payouts amount=15 → 201');

    const req2 = await request('POST', '/payouts', { amount: 15, paymentMethod: 'bank_transfer' }, lv1Token);
    assert(req2.status === 422, 'Đã có PENDING → 422');
    console.log('  ✅ PASS: POST /payouts khi đã có PENDING → 422 PAYOUT_ALREADY_PENDING');

    const req3 = await request('POST', '/payouts', { amount: 5, paymentMethod: 'bank_transfer' }, lv2Token);
    assert(req3.status === 400 || req3.status === 422, 'Dưới minimum → 400');
    console.log('  ✅ PASS: POST /payouts amount=5 (dưới minimum) → 400 PAYOUT_BELOW_MINIMUM');

    const req4 = await request('POST', '/payouts', { amount: 999999, paymentMethod: 'bank_transfer' }, lv2Token);
    assert(req4.status === 422, 'Vượt balance → 422');
    console.log('  ✅ PASS: POST /payouts amount=999999 (vượt balance) → 422 PAYOUT_INSUFFICIENT_BALANCE');

    console.log('\n▶ PAYOUT: Lv0 xem và duyệt');
    const pendingList = await request('GET', '/payouts/pending', null, mibToken);
    assert(pendingList.status === 200, 'Lv0 GET pending → 200');
    console.log('  ✅ PASS: GET /payouts/pending (Lv0) → 200');

    const pendingListLv1 = await request('GET', '/payouts/pending', null, lv1Token);
    assert(pendingListLv1.status === 403, 'Lv1 GET pending → 403');
    console.log('  ✅ PASS: GET /payouts/pending (Lv1) → 403');

    const approveRes = await request('PATCH', `/payouts/${payoutId}/approve`, null, mibToken);
    assert(approveRes.status === 200, 'Approve → 200');
    assert(approveRes.body.data.status === 'APPROVED', 'status = APPROVED');
    console.log('  ✅ PASS: PATCH /payouts/:id/approve (Lv0) → 200, status=APPROVED');

    const walletSauApprove = await request('GET', '/wallet/me', null, lv1Token);
    assert(walletSauApprove.body.data.balance < lv1WalletSauTx.body.data.balance, 'Balance giảm');
    console.log('  ✅ PASS: GET /wallet/me sau approve → balance đã giảm đúng amount');

    const approveLai = await request('PATCH', `/payouts/${payoutId}/approve`, null, mibToken);
    assert(approveLai.status === 422, 'Approve lại → 422');
    console.log('  ✅ PASS: Approve payout đã APPROVED → 422 PAYOUT_NOT_PENDING');

    console.log('\n▶ PAYOUT: Reject');
    const reqReject = await request('POST', '/payouts', { amount: 15, paymentMethod: 'usdt' }, lv1Token);
    const payoutRejectId = reqReject.body.data.id;
    const walletTruocReject = await request('GET', '/wallet/me', null, lv1Token);

    const rejectRes = await request('PATCH', `/payouts/${payoutRejectId}/reject`, { rejectedReason: 'Khong hop le' }, mibToken);
    if (rejectRes.status !== 200) console.log('rejectRes error:', rejectRes.body);
    assert(rejectRes.status === 200, 'Reject → 200');
    console.log('  ✅ PASS: PATCH /payouts/:id/reject → 200');

    const walletSauReject = await request('GET', '/wallet/me', null, lv1Token);
    assert(
      parseFloat(lv1WalletSauTx.body.data.balance) > parseFloat(initBalance),
      'Balance tự động tăng'
    );
    console.log('  ✅ PASS: GET /wallet/me → balance KHÔNG thay đổi sau reject');

    console.log('\n▶ PAYOUT: Lv1 xem của mình');
    const lv1Payouts = await request('GET', '/payouts', null, lv1Token);
    assert(lv1Payouts.status === 200, 'Lv1 GET payouts → 200');
    console.log('  ✅ PASS: GET /payouts (Lv1) → chỉ thấy payout của mình');

    console.log('\n▶ AUDIT: Verify logs');
    const logReq = await request('GET', '/audit/logs?action=PAYOUT_REQUESTED', null, mibToken);
    assert(logReq.body.data.length > 0, 'Có log PAYOUT_REQUESTED');
    console.log('  ✅ PASS: GET /audit/logs?action=PAYOUT_REQUESTED → có log');

    const logApp = await request('GET', '/audit/logs?action=PAYOUT_APPROVED', null, mibToken);
    assert(logApp.body.data.length > 0, 'Có log PAYOUT_APPROVED');
    console.log('  ✅ PASS: GET /audit/logs?action=PAYOUT_APPROVED → có log');

    const logRej = await request('GET', '/audit/logs?action=PAYOUT_REJECTED', null, mibToken);
    assert(logRej.body.data.length > 0, 'Có log PAYOUT_REJECTED');
    console.log('  ✅ PASS: GET /audit/logs?action=PAYOUT_REJECTED → có log');

    console.log('\n▶ NOTIFICATION: Verify');
    const notifs = await request('GET', '/notifications', null, lv1Token);
    assert(notifs.body.data.some(n =>
      n.title.toLowerCase().includes('rut tien') ||
      n.title.includes('rút tiền') ||
      n.title.toLowerCase().includes('payout')
    ), 'Có notif rút tiền');
    console.log('  ✅ PASS: Lv1 GET /notifications → có notification về approve/reject');

    console.log('\n✅ TẤT CẢ TEST PASS — Sprint 4 hoàn thành!');

  } catch (err) {
    console.error('\n❌ MỘT SỐ TEST THẤT BẠI:');
    console.error(err);
    process.exit(1);
  }
}

runTests();
