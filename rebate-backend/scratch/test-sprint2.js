// scratch/test-sprint2.js
// Chạy: node scratch/test-sprint2.js
// Yêu cầu: server đang chạy tại localhost:3001, Sprint 1 đã hoàn thành

const BASE = 'http://localhost:3001/api';

async function request(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  return { status: res.status, body: json };
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
    process.exitCode = 1;
  } else {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  }
}

async function run() {
  console.log('\n========================================');
  console.log('SPRINT 2 — API TEST SUITE');
  console.log(`Date: ${new Date().toISOString().slice(0, 10)}`);
  console.log('========================================\n');

  // ── LOGIN ─────────────────────────────────────────
  console.log('▶ AUTH: Login');
  const loginMIB = await request('POST', '/auth/login', { email: 'mib@test.com', password: 'Test@1234' });
  assert(loginMIB.status === 200, 'MIB login → 200');
  const mibToken = loginMIB.body.data.accessToken;
  const mibId = loginMIB.body.data.user.id;

  const loginLv1 = await request('POST', '/auth/login', { email: 'lv1-a@test.com', password: 'Test@1234' });
  assert(loginLv1.status === 200, 'Lv1 login → 200');
  const lv1Token = loginLv1.body.data.accessToken;
  const lv1Id = loginLv1.body.data.user.id;

  // Lấy Lv2 để test
  const children = await request('GET', `/ib/${lv1Id}/children`, null, lv1Token);
  const lv2Id = children.body.data?.[0]?.id;
  assert(!!lv2Id, 'Lấy được ID của Lv2 (lv2-c@test.com)');
  if (!lv2Id) {
    console.error('FATAL: Không có Lv2 — không thể tiếp tục test');
    process.exit(1);
  }

  // ── DASHBOARD ─────────────────────────────────────
  console.log('\n▶ DASHBOARD');
  const summary = await request('GET', '/dashboard/summary', null, mibToken);
  assert(summary.status === 200, 'GET /dashboard/summary → 200');
  assert(summary.body.data?.ibStats !== undefined, 'Response có ibStats');
  assert(summary.body.data?.transactionStats !== undefined, 'Response có transactionStats');
  assert(Array.isArray(summary.body.data?.topIbsThisMonth), 'Response có topIbsThisMonth array');
  assert(summary.body.data?.generatedAt !== undefined, 'Response có generatedAt');
  assert(summary.body.data.ibStats.totalInSubtree >= 0, 'totalInSubtree là số không âm');
  assert(typeof summary.body.data.transactionStats.todayCount === 'number', 'todayCount là number');
  assert(typeof summary.body.data.transactionStats.monthLots === 'number', 'monthLots là number');

  const summaryLv1 = await request('GET', '/dashboard/summary', null, lv1Token);
  assert(summaryLv1.status === 200, 'Lv1 GET /dashboard/summary → 200');
  assert(
    summaryLv1.body.data.ibStats.totalInSubtree <= summary.body.data.ibStats.totalInSubtree,
    'Lv1 thấy subtree nhỏ hơn hoặc bằng MIB'
  );

  // ── IB PERFORMANCE ────────────────────────────────
  console.log('\n▶ IB PERFORMANCE');
  const perfCurrent = await request('GET', `/ib/${lv2Id}/performance`, null, mibToken);
  assert(perfCurrent.status === 200, 'GET /ib/:id/performance (tháng hiện tại) → 200');
  assert(perfCurrent.body.data?.ib?.id === lv2Id, 'Response đúng IB');
  assert(perfCurrent.body.data?.overall !== undefined, 'Response có overall');
  assert(Array.isArray(perfCurrent.body.data?.byAssetType), 'Response có byAssetType array');
  assert(typeof perfCurrent.body.data.overall.transactionCount === 'number', 'transactionCount là number');

  const currentMonth = new Date().toISOString().slice(0, 7);
  const perfWithMonth = await request('GET', `/ib/${lv2Id}/performance?month=${currentMonth}`, null, mibToken);
  assert(perfWithMonth.status === 200, 'GET /ib/:id/performance?month= → 200');
  assert(perfWithMonth.body.data.period?.month === currentMonth, 'period.month đúng');

  const perfBadMonth = await request('GET', `/ib/${lv2Id}/performance?month=invalid`, null, mibToken);
  assert(perfBadMonth.status === 400, 'month format sai "invalid" → 400');

  const perfBadMonth2 = await request('GET', `/ib/${lv2Id}/performance?month=2026-13`, null, mibToken);
  assert(perfBadMonth2.status === 400, 'month format sai "2026-13" → 400');

  const perfOutOfTree = await request('GET', `/ib/${mibId}/performance`, null, lv1Token);
  assert(perfOutOfTree.status === 403, 'Lv1 xem performance của MIB (ngoài subtree) → 403');

  // ── LEADERBOARD ───────────────────────────────────
  console.log('\n▶ LEADERBOARD');
  const leaderboard = await request('GET', '/ib/leaderboard', null, mibToken);
  assert(leaderboard.status === 200, 'GET /ib/leaderboard → 200');
  assert(Array.isArray(leaderboard.body.data), 'Response là array');
  if (leaderboard.body.data.length > 1) {
    assert(
      leaderboard.body.data[0].monthLots >= leaderboard.body.data[1].monthLots,
      'Leaderboard sắp xếp đúng theo lots giảm dần'
    );
  }

  const leaderboardLimit = await request('GET', '/ib/leaderboard?limit=3', null, mibToken);
  assert(leaderboardLimit.status === 200, 'GET /ib/leaderboard?limit=3 → 200');
  assert(leaderboardLimit.body.data.length <= 3, 'Limit hoạt động đúng');

  if (leaderboard.body.data.length > 0) {
    assert(leaderboard.body.data[0].rank === 1, 'Rank đầu tiên = 1');
    assert(leaderboard.body.data[0].ib !== undefined, 'Leaderboard entry có ib info');
  }

  // ── NOTIFICATIONS: Gửi thông báo ──────────────────
  console.log('\n▶ NOTIFICATIONS: Gửi thông báo');
  const sendNotif = await request('POST', '/notifications/send', {
    recipientId: lv2Id,
    title: 'Test thong bao Sprint 2',
    body: 'Day la thong bao test tu test suite.',
    type: 'MANUAL',
  }, mibToken);
  assert(sendNotif.status === 201, 'POST /notifications/send → 201');
  assert(sendNotif.body.data?.id, 'Response có id');

  // Gửi cho Lv1 từ MIB
  const sendToLv1 = await request('POST', '/notifications/send', {
    recipientId: lv1Id,
    title: 'Thong bao cho Lv1',
    body: 'Test delete flow.',
  }, mibToken);
  assert(sendToLv1.status === 201, 'MIB gửi cho Lv1 → 201');

  // Gửi cho IB không trong subtree (MIB không phải con của Lv1)
  const sendNotifBad = await request('POST', '/notifications/send', {
    recipientId: mibId,
    title: 'Bad notification',
    body: 'Khong duoc phep',
  }, lv1Token);
  assert(sendNotifBad.status === 403, 'Lv1 gửi cho MIB (ngoài subtree) → 403');

  // ── NOTIFICATIONS: Xem thông báo ──────────────────
  console.log('\n▶ NOTIFICATIONS: Xem thông báo');
  const myNotifs = await request('GET', '/notifications', null, mibToken);
  assert(myNotifs.status === 200, 'GET /notifications → 200');
  assert(Array.isArray(myNotifs.body.data), 'Response có data array');
  assert(myNotifs.body.meta?.unreadCount >= 0, 'Response có meta.unreadCount');
  assert(typeof myNotifs.body.meta?.total === 'number', 'Response có meta.total');

  // Filter isRead=false
  const unreadNotifs = await request('GET', '/notifications?isRead=false', null, mibToken);
  assert(unreadNotifs.status === 200, 'GET /notifications?isRead=false → 200');
  if (unreadNotifs.body.data?.length > 0) {
    assert(
      unreadNotifs.body.data.every(n => n.isRead === false),
      'Tất cả notification filter isRead=false đều chưa đọc'
    );
  }

  // ── NOTIFICATIONS: Đánh dấu đã đọc ───────────────
  console.log('\n▶ NOTIFICATIONS: Đánh dấu đã đọc');
  
  // Lv1 nhận notification từ MIB ở trên → dùng lv1Token để mark-read
  const lv1NotifsForRead = await request('GET', '/notifications', null, lv1Token);
  if (lv1NotifsForRead.body.data?.length > 0) {
    const notifId = lv1NotifsForRead.body.data[0].id;
  
    const markRead = await request('PATCH', `/notifications/${notifId}/read`, null, lv1Token);
    assert(markRead.status === 200, 'PATCH /notifications/:id/read → 200');
    assert(markRead.body.data?.isRead === true, 'isRead = true sau mark read');
    assert(markRead.body.data?.readAt !== null, 'readAt được set');
  
    // Idempotent
    const markReadAgain = await request('PATCH', `/notifications/${notifId}/read`, null, lv1Token);
    assert(markReadAgain.status === 200, 'PATCH mark-read idempotent → 200');
  
    // Người khác không được mark-read notification của người khác
    const markReadByMIB = await request('PATCH', `/notifications/${notifId}/read`, null, mibToken);
    assert(markReadByMIB.status === 403, 'MIB không được mark-read notification của Lv1 → 403');
  } else {
    console.log('  ⚠ SKIP: Lv1 không có notification để test mark-read');
  }
  
  // Mark all read
  const markAllRead = await request('PATCH', '/notifications/read-all', null, lv1Token);
  assert(markAllRead.status === 200, 'PATCH /notifications/read-all → 200');
  assert(typeof markAllRead.body.data?.updated === 'number', 'Response có updated count');
  
  const afterMarkAll = await request('GET', '/notifications', null, lv1Token);
  assert(afterMarkAll.body.meta?.unreadCount === 0, 'unreadCount = 0 sau read-all');

  // ── NOTIFICATIONS: Xóa thông báo ─────────────────
  console.log('\n▶ NOTIFICATIONS: Xóa thông báo');
  const lv1Notifs = await request('GET', '/notifications', null, lv1Token);
  assert(lv1Notifs.status === 200, 'Lv1 GET /notifications → 200');
  if (lv1Notifs.body.data?.length > 0) {
    const toDeleteId = lv1Notifs.body.data[0].id;
    const deleteNotif = await request('DELETE', `/notifications/${toDeleteId}`, null, lv1Token);
    assert(deleteNotif.status === 200, 'DELETE /notifications/:id → 200');
    assert(deleteNotif.body.data?.message !== undefined, 'Response có message');

    const getAfterDelete = await request('GET', '/notifications', null, lv1Token);
    const stillExists = getAfterDelete.body.data?.some(n => n.id === toDeleteId);
    assert(!stillExists, 'Notification đã biến mất sau khi xóa');
  } else {
    console.log('  ⚠ SKIP: Lv1 không có notification để test delete');
  }

  // ── REBATE CONFIG HISTORY ─────────────────────────
  console.log('\n▶ REBATE CONFIG HISTORY');
  const lv2Config = await request('GET', `/rebate/config/${lv2Id}`, null, mibToken);
  if (lv2Config.body.data?.assets?.length > 0) {
    // Lấy asset đầu tiên để update
    const firstAsset = lv2Config.body.data.assets[0];
    const oldPips = firstAsset.rebatePips ?? 0;

    const oldPercent = firstAsset.markupPercent ?? 100;
    const newPercent = oldPercent === 100 ? 90 : 100;

    // Update để tạo history entry
    await request('PUT', `/rebate/config/${lv2Id}`, {
      assets: [{
        assetType: firstAsset.assetType,
        rebateType: firstAsset.rebateType || 'STP_REBATE',
        rebatePips: oldPips,
        markupPips: 0,
        markupPercent: newPercent
      }],
    }, mibToken);

    // Revert
    await request('PUT', `/rebate/config/${lv2Id}`, {
      assets: [{
        assetType: firstAsset.assetType,
        rebateType: firstAsset.rebateType || 'STP_REBATE',
        rebatePips: oldPips,
        markupPips: 0,
        markupPercent: oldPercent
      }],
    }, mibToken);

    const history = await request('GET', `/rebate/config/${lv2Id}/history`, null, mibToken);
    assert(history.status === 200, 'GET /rebate/config/:ibId/history → 200');
    assert(Array.isArray(history.body.data), 'Response có data array');
    assert(history.body.meta?.total >= 1, `Có ít nhất 1 history entry (có ${history.body.meta?.total})`);

    if (history.body.data.length > 0) {
      const entry = history.body.data[0];
      assert(entry.before !== undefined, 'History entry có before');
      assert(entry.after !== undefined, 'History entry có after');
      assert(entry.changedBy !== undefined, 'History entry có changedBy');
      assert(!entry.changedBy?.password, 'changedBy không lộ password');
    
      // Verify before ≠ after — nếu giống nhau là backend bug
      const beforeJson = JSON.stringify(entry.before);
      const afterJson = JSON.stringify(entry.after);
      assert(
        beforeJson !== afterJson,
        `before khác after (before=${beforeJson} | after=${afterJson})`
      );
    }

    // Pagination
    const historyPage = await request('GET', `/rebate/config/${lv2Id}/history?page=1&limit=1`, null, mibToken);
    assert(historyPage.status === 200, 'Pagination hoạt động → 200');
    assert(historyPage.body.data?.length <= 1, 'Limit pagination đúng');

    // Lv1 không xem history của MIB (ngoài subtree)
    const historyBad = await request('GET', `/rebate/config/${mibId}/history`, null, lv1Token);
    assert(historyBad.status === 403, 'Lv1 xem history của MIB (ngoài subtree) → 403');
  } else {
    console.log('  ⚠ SKIP: Lv2 chưa có rebate config để test history');
  }

  // ── VERIFY: System notifications auto-trigger ─────
  console.log('\n▶ VERIFY: System notifications tự động');
  const ts = Date.now();
  const newIbEmail = `sprint2-test-${ts}@example.com`;

  const newIb = await request('POST', '/ib', {
    email: newIbEmail,
    password: 'Test@1234',
    name: 'Sprint 2 Test IB',
  }, lv1Token);

  if (newIb.status === 201) {
    const sprint2TestId = newIb.body.data.id;

    // Chờ một chút để system notification được tạo (async)
    await new Promise(r => setTimeout(r, 300));

    // Lv1 kiểm tra notification IB_JOINED
    const lv1NotifsAfterCreate = await request('GET', '/notifications?type=IB_JOINED', null, lv1Token);
    assert(lv1NotifsAfterCreate.status === 200, 'Lv1 GET /notifications?type=IB_JOINED → 200');
    const hasJoinedNotif = lv1NotifsAfterCreate.body.data?.some(n => n.type === 'IB_JOINED');
    assert(hasJoinedNotif, 'Lv1 nhận được IB_JOINED notification khi có IB mới tham gia');

    // Deactivate IB test → verify IB_DEACTIVATED notification
    const deactivateRes = await request('DELETE', `/ib/${sprint2TestId}`, null, lv1Token);
    assert([200, 204].includes(deactivateRes.status), `Deactivate IB test → ${deactivateRes.status}`);

    await new Promise(r => setTimeout(r, 300));

    // Restore IB → verify IB_RESTORED notification
    const restoreRes = await request('PATCH', `/ib/${sprint2TestId}/restore`, null, lv1Token);
    assert(restoreRes.status === 200, 'Restore IB test → 200');

    await new Promise(r => setTimeout(r, 300));

    // Đăng nhập bằng IB mới để xem notification IB_RESTORED
    const loginNewIb = await request('POST', '/auth/login', { email: newIbEmail, password: 'Test@1234' });
    if (loginNewIb.status === 200) {
      const newIbToken = loginNewIb.body.data.accessToken;
      const newIbNotifs = await request('GET', '/notifications', null, newIbToken);
      assert(newIbNotifs.status === 200, 'IB mới GET /notifications → 200');
      const hasRestoredNotif = newIbNotifs.body.data?.some(n => n.type === 'IB_RESTORED');
      assert(hasRestoredNotif, 'IB mới nhận được IB_RESTORED notification sau khi được khôi phục');
    } else {
      console.log('  ⚠ SKIP: Không đăng nhập được IB mới để test IB_RESTORED notification');
    }

    // Cleanup
    console.log('\n▶ CLEANUP');
    await request('DELETE', `/ib/${sprint2TestId}`, null, mibToken);
    console.log(`  [INFO] Đã cleanup IB test: ${newIbEmail}`);
  } else {
    console.log('  ⚠ SKIP: Không tạo được IB mới để test system notification');
    console.log('  [DEBUG]', JSON.stringify(newIb.body));
  }

  // ── REGRESSION: Sprint 1 vẫn hoạt động ─────────
  console.log('\n▶ REGRESSION: Sprint 1 endpoints');
  const auditLogs = await request('GET', '/audit/logs', null, mibToken);
  assert(auditLogs.status === 200, 'GET /audit/logs vẫn hoạt động → 200');
  const txCreate = await request('POST', '/transactions', {
    ibId: lv2Id,
    assetType: 'FOREX',
    lots: 1.0,
    rebateAmount: 2.0,
    tradedAt: new Date().toISOString(),
  }, lv1Token);
  // 201 hoặc error do encoding — cả hai đều chấp nhận (môi trường local)
  assert(txCreate.status === 201, 'POST /transactions regression → 201');

  // ── SUMMARY ───────────────────────────────────────
  console.log('\n========================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('✅ TẤT CẢ TEST PASS — Sprint 2 hoàn thành!');
  } else {
    console.log('❌ MỘT SỐ TEST THẤT BẠI — xem chi tiết ở trên');
  }
  console.log('========================================\n');
}

run().catch(err => {
  console.error('Lỗi không mong đợi:', err);
  process.exit(1);
});
