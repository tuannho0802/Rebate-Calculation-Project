/**
 * test-sprint3.js — Sprint 3 API Test Suite
 * Gap fixes: A3 (direct-child rebate), A4 (report scope), B1 (reset-password Lv0), C2 (rebateType filter), C3 (chartData)
 */

const BASE = 'http://localhost:3001/api';
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function request(method, path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let responseBody;
  try { responseBody = await res.json(); } catch { responseBody = {}; }
  return { status: res.status, body: responseBody };
}

async function main() {
  console.log('\n========================================');
  console.log('SPRINT 3 — API TEST SUITE');
  console.log(`Date: ${new Date().toISOString().split('T')[0]}`);
  console.log('========================================\n');

  // ── AUTH ─────────────────────────────────────────────────────────
  console.log('▶ AUTH: Login');
  const mibLogin = await request('POST', '/auth/login', { email: 'mib@test.com', password: 'Test@1234' });
  assert(mibLogin.status === 200, 'MIB login → 200');
  const mibToken = mibLogin.body.data?.accessToken;

  const lv1Login = await request('POST', '/auth/login', { email: 'lv1-a@test.com', password: 'Test@1234' });
  assert(lv1Login.status === 200, 'Lv1 login → 200');
  const lv1Token = lv1Login.body.data?.accessToken;

  // Lấy ID của Lv1 và Lv2 (lv2-c là con trực tiếp của lv1)
  const lv1Me = await request('GET', '/ib/me', null, lv1Token);
  const lv1Id = lv1Me.body.data?.id;
  assert(!!lv1Id, `Lấy được ID của Lv1`);

  // Lấy Lv2 (con trực tiếp của Lv1)
  const lv2Login = await request('POST', '/auth/login', { email: 'lv2-c@test.com', password: 'Test@1234' });
  const lv2Token = lv2Login.body.data?.accessToken;
  const lv2Me = await request('GET', '/ib/me', null, lv2Token);
  const lv2Id = lv2Me.body.data?.id;
  assert(!!lv2Id, `Lấy được ID của Lv2 (lv2-c@test.com)`);

  // Sau khi có lv2Id, tạo thêm 1 Lv3 làm test data
  const lv3CreateRes = await request('POST', '/ib', 
    { email: `sprint3-lv3-${Date.now()}@example.com`, password: 'Test@1234', name: 'Test Lv3' }, 
    lv2Token  // dùng token của lv2-c để tạo con trực tiếp
  );
  const lv3Id = lv3CreateRes.body.data?.id;
  assert(!!lv3Id, 'Lấy được ID của Lv3 (tạo mới trong test)');

  // ── A3: PUT /rebate/config — direct-child check ──────────────────
  console.log('\n▶ A3: Phân quyền rebate config (direct-child)');

  // Lấy config hiện tại của Lv2 để lấy assetType/rebateType hợp lệ
  const lv2Config = await request('GET', `/rebate/config/${lv2Id}`, null, lv1Token);
  const firstAsset = lv2Config.body.data?.assets?.[0];

  // [P2] Lv1 set cho con trực tiếp (Lv2) → 200
  if (firstAsset) {
    const p2 = await request('PUT', `/rebate/config/${lv2Id}`, {
      assets: [{
        assetType: firstAsset.assetType,
        rebateType: firstAsset.rebateType || 'STP_REBATE',
        rebatePips: firstAsset.rebatePips,
        markupPips: firstAsset.markupPips,
        markupPercent: firstAsset.markupPercent,
      }],
    }, lv1Token);
    assert(p2.status === 200, '[P2] Lv1 set rebate config cho con trực tiếp (Lv2) → 200');
  } else {
    console.log('  ⚠ SKIP P2: Lv2 chưa có config');
  }

  // [P1] Lv1 set cho cháu nội (Lv3) → 403 REBATE_TARGET_NOT_DIRECT_CHILD
  if (lv3Id && firstAsset) {
    const lv3Config = await request('GET', `/rebate/config/${lv3Id}`, null, mibToken);
    const lv3Asset = lv3Config.body.data?.assets?.[0];
    if (lv3Asset) {
      const p1 = await request('PUT', `/rebate/config/${lv3Id}`, {
        assets: [{
          assetType: lv3Asset.assetType,
          rebateType: lv3Asset.rebateType || 'STP_REBATE',
          rebatePips: lv3Asset.rebatePips,
          markupPips: lv3Asset.markupPips,
          markupPercent: lv3Asset.markupPercent,
        }],
      }, lv1Token);
      assert(p1.status === 403, '[P1] Lv1 set rebate config cho cháu nội (Lv3) → 403');
      assert(p1.body.error?.code === 'REBATE_TARGET_NOT_DIRECT_CHILD', '[P1] Error code = REBATE_TARGET_NOT_DIRECT_CHILD');
    } else {
      console.log('  ⚠ SKIP P1: Lv3 chưa có config');
    }

    // [P3] Lv0 set cho cháu nội (Lv3) → 200 (bypass direct-child check)
    if (lv3Asset) {
      const p3 = await request('PUT', `/rebate/config/${lv3Id}`, {
        assets: [{
          assetType: lv3Asset.assetType,
          rebateType: lv3Asset.rebateType || 'STP_REBATE',
          rebatePips: lv3Asset.rebatePips,
          markupPips: lv3Asset.markupPips,
          markupPercent: lv3Asset.markupPercent,
        }],
      }, mibToken);
      assert(p3.status === 200, '[P3] Lv0 set rebate config cho cháu nội (Lv3) → 200 (bypass direct-child)');
    }
  } else {
    console.log('  ⚠ SKIP P1/P3: Lv3 không tồn tại hoặc Lv2 chưa có config');
  }

  // ── A4: Report — scope validation ─────────────────────────────────
  console.log('\n▶ A4: Report scope validation (ibId ngoài subtree)');

  // [P4] Lv1 gọi report với ibId của MIB (ngoài subtree Lv1) → 403
  const mibMe = await request('GET', '/ib/me', null, mibToken);
  const mibId = mibMe.body.data?.id;

  const p4 = await request('GET', `/report/summary?ibId=${mibId}`, null, lv1Token);
  assert(p4.status === 403, '[P4] Lv1 GET /report/summary?ibId={MIB ngoài subtree} → 403');
  assert(p4.body.error?.code === 'IB_NOT_IN_SUBTREE', '[P4] Error code = IB_NOT_IN_SUBTREE');

  const p4b = await request('GET', `/report/transactions?ibId=${mibId}`, null, lv1Token);
  assert(p4b.status === 403, '[P4b] Lv1 GET /report/transactions?ibId={MIB ngoài subtree} → 403');

  // [P5] Lv0 gọi report với ibId của Lv2 (cháu nội) → 200 (bypass)
  const p5 = await request('GET', `/report/summary?ibId=${lv2Id}`, null, mibToken);
  assert(p5.status === 200, '[P5] Lv0 GET /report/summary?ibId={bất kỳ} → 200 (bypass)');

  const p5b = await request('GET', `/report/transactions?ibId=${lv2Id}`, null, mibToken);
  assert(p5b.status === 200, '[P5b] Lv0 GET /report/transactions?ibId={bất kỳ} → 200 (bypass)');

  // Lv1 gọi report với ibId của Lv2 (trong subtree) → 200
  const p4c = await request('GET', `/report/summary?ibId=${lv2Id}`, null, lv1Token);
  assert(p4c.status === 200, 'Lv1 GET /report/summary?ibId={con trong subtree} → 200');

  // ── C2: Report transactions — rebateType filter ───────────────────
  console.log('\n▶ C2: GET /report/transactions?rebateType filter');

  // [P6] Với filter rebateType=STP_REBATE → chỉ trả STP_REBATE rows
  const p6 = await request('GET', '/report/transactions?rebateType=STP_REBATE', null, mibToken);
  assert(p6.status === 200, '[P6] GET /report/transactions?rebateType=STP_REBATE → 200');
  assert(Array.isArray(p6.body.data), '[P6] Response có data array');
  const allStp = p6.body.data.every((tx) => !tx.rebateType || tx.rebateType === 'STP_REBATE');
  assert(allStp, '[P6] Tất cả rows đều là STP_REBATE');
  assert(p6.body.data[0]?.rebateType !== undefined || p6.body.data.length === 0, '[P6] Response có trường rebateType');

  // Không có filter → trả tất cả
  const p6b = await request('GET', '/report/transactions', null, mibToken);
  assert(p6b.status === 200, '[P6b] GET /report/transactions không filter → 200');

  // ── B1: PATCH /ib/:id/reset-password ──────────────────────────────
  console.log('\n▶ B1: PATCH /ib/:id/reset-password (Lv0 only)');

  // Tạo IB test để reset
  const testEmail = `sprint3-reset-${Date.now()}@example.com`;
  const createRes = await request('POST', '/ib', { email: testEmail, password: 'OldPass123', name: 'Sprint3 Test IB' }, mibToken);
  assert(createRes.status === 201, 'Tạo IB test để reset password → 201');
  const testIbId = createRes.body.data?.id;
  assert(!!testIbId, 'Tạo được IB test có ID');

  // [P7] Lv1 gọi reset-password → 403 (FORBIDDEN_LV0_ONLY)
  const p7 = await request('PATCH', `/ib/${testIbId}/reset-password`, { newPassword: 'NewPass456' }, lv1Token);
  assert(p7.status === 403, '[P7] Lv1 PATCH /ib/:id/reset-password → 403');
  assert(p7.body.error?.code === 'FORBIDDEN_LV0_ONLY', '[P7] Error code = FORBIDDEN_LV0_ONLY');

  // [P8] Lv0 gọi reset-password → 200
  const p8 = await request('PATCH', `/ib/${testIbId}/reset-password`, { newPassword: 'NewPass456' }, mibToken);
  assert(p8.status === 200, '[P8] Lv0 PATCH /ib/:id/reset-password → 200');
  assert(typeof p8.body.data?.message === 'string', '[P8] Response có message');

  // [P8b] Login lại với mật khẩu mới
  const loginNew = await request('POST', '/auth/login', { email: testEmail, password: 'NewPass456' });
  assert(loginNew.status === 200, '[P8b] Login với mật khẩu mới sau reset → 200');
  assert(!!loginNew.body.data?.accessToken, '[P8b] Nhận được accessToken sau reset');

  // [P8c] Mật khẩu cũ không còn dùng được
  const loginOld = await request('POST', '/auth/login', { email: testEmail, password: 'OldPass123' });
  assert(loginOld.status === 401, '[P8c] Mật khẩu cũ không còn hợp lệ → 401');

  // Validate: body thiếu newPassword → 400
  const p8d = await request('PATCH', `/ib/${testIbId}/reset-password`, {}, mibToken);
  assert([400, 422].includes(p8d.status), '[P8d] Thiếu newPassword → 400/422');

  // Validate: newPassword quá ngắn → 400
  const p8e = await request('PATCH', `/ib/${testIbId}/reset-password`, { newPassword: 'abc' }, mibToken);
  assert([400, 422].includes(p8e.status), '[P8e] newPassword < 6 ký tự → 400/422');

  // ── C3: Dashboard chartData ────────────────────────────────────────
  console.log('\n▶ C3: GET /dashboard/summary — chartData 6 tháng');

  const dash = await request('GET', '/dashboard/summary', null, mibToken);
  assert(dash.status === 200, '[P9] GET /dashboard/summary → 200');
  assert(Array.isArray(dash.body.data?.chartData), '[P9] Response có chartData array');
  assert(dash.body.data?.chartData?.length === 6, '[P9] chartData có đúng 6 phần tử');

  const months = dash.body.data?.chartData ?? [];
  const allHaveMonth = months.every((m) => typeof m.month === 'string' && /^\d{4}-\d{2}$/.test(m.month));
  assert(allHaveMonth, '[P9] Mỗi entry có month dạng YYYY-MM');
  const allHaveLots = months.every((m) => typeof m.totalLots === 'number');
  assert(allHaveLots, '[P9] Mỗi entry có totalLots là number');
  const allHaveRebate = months.every((m) => typeof m.totalRebate === 'number');
  assert(allHaveRebate, '[P9] Mỗi entry có totalRebate là number');

  // Kiểm tra thứ tự tăng dần theo tháng
  const monthsSorted = months.map((m) => m.month);
  const isSorted = monthsSorted.every((m, i) => i === 0 || m > monthsSorted[i - 1]);
  assert(isSorted, '[P9] chartData được sắp xếp tăng dần theo tháng');

  // ── CLEANUP ────────────────────────────────────────────────────────
  console.log('\n▶ CLEANUP');
  if (testIbId) {
    await request('DELETE', `/ib/${testIbId}`, null, mibToken);
    console.log(`  [INFO] Đã cleanup IB test: ${testEmail}`);
  }
  if (lv3Id) {
    await request('DELETE', `/ib/${lv3Id}`, null, mibToken);
    console.log(`  [INFO] Đã cleanup IB test Lv3`);
  }

  // ── REGRESSION: Sprint 1 + 2 ──────────────────────────────────────
  console.log('\n▶ REGRESSION: Các endpoint Sprint 1 & 2 vẫn hoạt động');

  const auditRes = await request('GET', '/audit/logs', null, mibToken);
  assert(auditRes.status === 200, 'GET /audit/logs vẫn hoạt động → 200');

  const dashLv1 = await request('GET', '/dashboard/summary', null, lv1Token);
  assert(dashLv1.status === 200, 'GET /dashboard/summary (Lv1) vẫn hoạt động → 200');

  const notifRes = await request('GET', '/notifications', null, lv1Token);
  assert(notifRes.status === 200, 'GET /notifications vẫn hoạt động → 200');

  const reportRes = await request('GET', '/report/summary', null, lv1Token);
  assert(reportRes.status === 200, 'GET /report/summary (không ibId filter) vẫn hoạt động → 200');

  // ── SUMMARY ───────────────────────────────────────────────────────
  console.log('\n========================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('✅ TẤT CẢ TEST PASS — Sprint 3 hoàn thành!');
  } else {
    console.log('❌ MỘT SỐ TEST THẤT BẠI — xem chi tiết ở trên');
    process.exit(1);
  }
  console.log('========================================\n');
}

main().catch((err) => {
  console.error('Lỗi không mong đợi:', err);
  process.exit(1);
});
