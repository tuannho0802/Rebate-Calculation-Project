// scratch/test-sprint1.js
// Chay: node scratch/test-sprint1.js
// Yeu cau: server dang chay tai localhost:3001, seed data da co

const BASE = 'http://localhost:3001/api';
const TEST_EMAIL = `test-restore-${Date.now()}@example.com`;

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
    console.error(`  [FAIL] ${message}`);
    failed++;
    process.exitCode = 1;
  } else {
    console.log(`  [PASS] ${message}`);
    passed++;
  }
}

async function run() {
  // Khai bao som de dung xuyen suot
  const today = new Date().toISOString().split('T')[0];
  let testIbId = null;

  console.log('\n========================================');
  console.log('SPRINT 1 - API TEST SUITE');
  console.log(`Date: ${today} | Test email: ${TEST_EMAIL}`);
  console.log('========================================\n');

  // ── AUTH: LOGIN ────────────────────────────────────────────────────────────
  console.log('> AUTH: Login');

  const loginMIB = await request('POST', '/auth/login', {
    email: 'mib@test.com',
    password: 'Test@1234',
  });
  assert(loginMIB.status === 200, 'MIB login -> 200');
  assert(!!loginMIB.body.data?.accessToken, 'MIB nhan duoc accessToken');
  const mibToken = loginMIB.body.data.accessToken;
  const mibId = loginMIB.body.data.user.id;

  const loginLv1 = await request('POST', '/auth/login', {
    email: 'lv1-a@test.com',
    password: 'Test@1234',
  });
  assert(loginLv1.status === 200, 'Lv1 login -> 200');
  const lv1Token = loginLv1.body.data.accessToken;
  const lv1Id = loginLv1.body.data.user.id;

  // ── AUTH: Bảo vệ endpoint ─────────────────────────────────────────────────
  // [F3 FIX] Dung body hop le de buoc JWT check chay - khong phu thuoc vao validation
  console.log('\n> AUTH: Bao ve endpoint (401 checks)');

  const validTxBody = {
    ibId: '00000000-0000-0000-0000-000000000000',
    assetType: 'FOREX',
    lots: 1.0,
    rebateAmount: 1.0,
    tradedAt: new Date().toISOString(),
  };

  const noToken1 = await request('GET', '/transactions/00000000-0000-0000-0000-000000000000', null, null);
  assert(noToken1.status === 401, 'GET /transactions/:id khong token -> 401');

  const noToken2 = await request('POST', '/transactions', validTxBody, null);
  assert(noToken2.status === 401, 'POST /transactions hop le nhung khong token -> 401');

  const noToken3 = await request('POST', '/transactions/batch', {
    transactions: [validTxBody],
  }, null);
  assert(noToken3.status === 401, 'POST /transactions/batch hop le nhung khong token -> 401');

  // Body KHONG hop le (rong) + KHONG co token
  // Neu Guard chay truoc Pipe dung nhu ky vong -> phai la 401, KHONG phai 422
  const noTokenInvalidBody = await request('POST', '/transactions/batch', {
    transactions: []
  }, null);
  assert(
    noTokenInvalidBody.status === 401,
    'Body invalid + khong token -> van phai 401 (guard chay truoc pipe, khong phai 422)'
  );

  const noToken4 = await request('GET', '/audit/logs', null, null);
  assert(noToken4.status === 401, 'GET /audit/logs khong token -> 401');

  const noToken5 = await request('GET', '/ib/search?q=test', null, null);
  assert(noToken5.status === 401, 'GET /ib/search khong token -> 401');

  const noToken6 = await request('PATCH', '/ib/00000000-0000-0000-0000-000000000000/restore', null, null);
  assert(noToken6.status === 401, 'PATCH /ib/:id/restore khong token -> 401');

  // ── IB SEARCH ─────────────────────────────────────────────────────────────
  console.log('\n> IB SEARCH');

  const searchOk = await request('GET', '/ib/search?q=lv2', null, mibToken);
  assert(searchOk.status === 200, 'Search "lv2" -> 200');
  assert(Array.isArray(searchOk.body.data), 'Response co data array');
  assert(searchOk.body.meta?.total >= 0, 'Response co meta.total');
  assert(searchOk.body.meta?.query === 'lv2', 'Response co meta.query = "lv2"');

  const searchShort = await request('GET', '/ib/search?q=l', null, mibToken);
  assert(searchShort.status === 400, 'Search query 1 ky tu -> 400');
  assert(searchShort.body.error?.code === 'SEARCH_QUERY_TOO_SHORT', 'Error code SEARCH_QUERY_TOO_SHORT (1 ky tu)');

  // [F5 FIX] Khong co q -> service phai catch undefined.trim() va tra 400
  const searchNoQ = await request('GET', '/ib/search', null, mibToken);
  assert(searchNoQ.status === 400, 'Search khong co query param -> 400 (khong phai 500)');
  assert(
    searchNoQ.body.error?.code === 'SEARCH_QUERY_TOO_SHORT',
    'Error code SEARCH_QUERY_TOO_SHORT khi khong co q'
  );

  const searchWithInactive = await request('GET', '/ib/search?q=lv2&includeInactive=true', null, mibToken);
  assert(searchWithInactive.status === 200, 'Search voi includeInactive=true -> 200');

  const searchByLv1 = await request('GET', '/ib/search?q=lv2', null, lv1Token);
  assert(searchByLv1.status === 200, 'Lv1 search "lv2" -> 200');
  const mibSearchTotal = searchOk.body.meta?.total ?? 0;
  const lv1SearchTotal = searchByLv1.body.meta?.total ?? 0;
  assert(
    lv1SearchTotal <= mibSearchTotal,
    `Lv1 (${lv1SearchTotal}) thay it hon hoac bang MIB (${mibSearchTotal}) voi cung query`
  );

  // Pagination search
  const searchPaged = await request('GET', '/ib/search?q=lv&page=1&limit=2', null, mibToken);
  assert(searchPaged.status === 200, 'Search voi pagination -> 200');
  assert((searchPaged.body.data?.length ?? 0) <= 2, 'Search pagination limit hoat dong');

  // ── IB DEACTIVATE & RESTORE ───────────────────────────────────────────────
  console.log('\n> IB DEACTIVATE & RESTORE');

  const newIb = await request('POST', '/ib', {
    email: TEST_EMAIL,
    password: 'Test@1234',
    name: 'Test Restore IB',
  }, mibToken);
  assert(newIb.status === 201, `Tao IB test (${TEST_EMAIL}) -> 201`);
  testIbId = newIb.body.data?.id;
  assert(!!testIbId, 'Tao IB test co ID');

  // [F6 FIX] Update IB truoc khi deactivate de trigger IB_UPDATE audit log
  // Kiem tra endpoint la PUT hay PATCH trong ib.controller.ts
  const updateIb = await request('PUT', `/ib/${testIbId}`, {
    name: 'Test Restore IB (Updated)',
  }, mibToken);
  assert(
    updateIb.status === 200 || updateIb.status === 204,
    'PUT /ib/:id -> 200/204 (trigger IB_UPDATE audit log)'
  );

  const deactivate = await request('DELETE', `/ib/${testIbId}`, null, mibToken);
  assert(deactivate.status === 200, 'Deactivate IB -> 200');

  const loginDeactivated = await request('POST', '/auth/login', {
    email: TEST_EMAIL,
    password: 'Test@1234',
  });
  assert(loginDeactivated.status === 401, 'Login sau deactivate -> 401');

  const restore = await request('PATCH', `/ib/${testIbId}/restore`, null, mibToken);
  assert(restore.status === 200, 'Restore IB -> 200');
  assert(restore.body.data?.isActive === true, 'isActive = true sau restore');
  assert(restore.body.data?.id === testIbId, 'Response dung IB duoc restore');

  const loginRestored = await request('POST', '/auth/login', {
    email: TEST_EMAIL,
    password: 'Test@1234',
  });
  assert(loginRestored.status === 200, 'Login sau restore -> 200');

  const restoreAgain = await request('PATCH', `/ib/${testIbId}/restore`, null, mibToken);
  assert(restoreAgain.status === 422, 'Restore IB dang active -> 422');
  assert(restoreAgain.body.error?.code === 'IB_ALREADY_ACTIVE', 'Error code IB_ALREADY_ACTIVE');

  // ── TRANSACTION: Lay Lv2 ──────────────────────────────────────────────────
  // [F2 FIX] Guard cung neu khong tim duoc Lv2
  const children = await request('GET', `/ib/${lv1Id}/children`, null, lv1Token);
  assert(children.status === 200, 'GET /ib/:id/children -> 200');

  // isActive !== false: chap nhan ca undefined (API co the khong tra field nay)
  const lv2 = children.body.data?.find(c => c.isActive !== false && c.id !== testIbId);
  const lv2Id = lv2?.id;

  if (!lv2Id) {
    console.error('\n  [FATAL] Khong tim duoc Lv2 active trong subtree cua lv1-a@test.com');
    console.error('  -> Kiem tra seed data. Lv1 phai co it nhat 1 child IB active.');
    console.error('  -> Chay: npx prisma db seed de reset data.');
    failed++;
    process.exitCode = 1;
    console.log('\n========================================');
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log('FATAL: Khong the tiep tuc test vi thieu Lv2.');
    console.log('========================================\n');
    return;
  }
  assert(true, `Lay duoc Lv2: ${lv2?.email ?? lv2Id}`);

  // ── TRANSACTION: Tạo đơn ─────────────────────────────────────────────────
  console.log('\n> TRANSACTION: Tao giao dich don');

  const createTx = await request('POST', '/transactions', {
    ibId: lv2Id,
    assetType: 'FOREX',
    rebateType: 'STP_REBATE',
    lots: 2.5,
    rebateAmount: 5.00,
    tradedAt: new Date().toISOString(),
    note: 'Test transaction tu sprint 1',
  }, lv1Token);
  assert(createTx.status === 201, 'Lv1 tao transaction cho Lv2 -> 201');
  assert(!!createTx.body.data?.id, 'Response co id');
  const lv1TxId = createTx.body.data?.id;

  const txByMIB = await request('POST', '/transactions', {
    ibId: lv2Id,
    assetType: 'GOLD',
    lots: 1.0,
    rebateAmount: 4.00,
    tradedAt: new Date().toISOString(),
  }, mibToken);
  assert(txByMIB.status === 201, 'MIB tao transaction cho Lv2 (trong subtree) -> 201');
  const mibTxId = txByMIB.body.data?.id;

  // Validation: lots = 0
  const createTxBadLots = await request('POST', '/transactions', {
    ibId: lv2Id,
    assetType: 'FOREX',
    lots: 0,
    rebateAmount: 5.00,
    tradedAt: new Date().toISOString(),
  }, lv1Token);
  assert(
    createTxBadLots.status === 422 || createTxBadLots.status === 400,
    'Lots = 0 -> 400/422 (validation error)'
  );

  // Validation: lots am
  const createTxNegLots = await request('POST', '/transactions', {
    ibId: lv2Id,
    assetType: 'FOREX',
    lots: -1,
    rebateAmount: 5.00,
    tradedAt: new Date().toISOString(),
  }, lv1Token);
  assert(
    createTxNegLots.status === 422 || createTxNegLots.status === 400,
    'Lots am -> 400/422 (validation error)'
  );

  // Authorization: ibId ngoai subtree
  const createTxOutOfTree = await request('POST', '/transactions', {
    ibId: mibId,
    assetType: 'FOREX',
    lots: 1.0,
    rebateAmount: 2.00,
    tradedAt: new Date().toISOString(),
  }, lv1Token);
  assert(createTxOutOfTree.status === 403, 'Lv1 tao transaction cho MIB (ngoai subtree) -> 403');
  assert(createTxOutOfTree.body.error?.code === 'IB_NOT_IN_SUBTREE', 'Error code IB_NOT_IN_SUBTREE');

  // ── TRANSACTION: Xem chi tiết ────────────────────────────────────────────
  console.log('\n> TRANSACTION: Xem chi tiet');

  const getTx = await request('GET', `/transactions/${lv1TxId}`, null, lv1Token);
  assert(getTx.status === 200, 'GET /transactions/:id -> 200');
  assert(getTx.body.data?.id === lv1TxId, 'Response dung transaction');
  assert(getTx.body.data?.ib !== undefined, 'Response co ib info');
  assert(getTx.body.data?.createdBy !== undefined, 'Response co createdBy info');
  assert(getTx.body.data?.ib?.password === undefined, 'Khong lo password cua IB');
  assert(getTx.body.data?.createdBy?.password === undefined, 'Khong lo password cua createdBy');

  const getTxByMIB = await request('GET', `/transactions/${lv1TxId}`, null, mibToken);
  assert(getTxByMIB.status === 200, 'MIB xem transaction cua Lv2 (trong subtree) -> 200');

  const getTxNotFound = await request('GET', '/transactions/00000000-0000-0000-0000-000000000000', null, mibToken);
  assert(getTxNotFound.status === 404, 'GET transaction khong ton tai -> 404');
  assert(getTxNotFound.body.error?.code === 'TRANSACTION_NOT_FOUND', 'Error code TRANSACTION_NOT_FOUND');

  // ── TRANSACTION: Batch ────────────────────────────────────────────────────
  console.log('\n> TRANSACTION: Batch import');

  const batchResult = await request('POST', '/transactions/batch', {
    transactions: [
      { ibId: lv2Id, assetType: 'FOREX', lots: 1.0, rebateAmount: 2.0, tradedAt: new Date().toISOString() },
      { ibId: lv2Id, assetType: 'GOLD', lots: 0.5, rebateAmount: 2.0, tradedAt: new Date().toISOString() },
      { ibId: lv2Id, assetType: 'FOREX', lots: 3.0, rebateAmount: 6.0, tradedAt: new Date().toISOString(), note: 'Batch test' },
    ],
  }, lv1Token);
  assert(batchResult.status === 201, 'Batch 3 transactions -> 201');
  assert(batchResult.body.data?.created === 3, 'created = 3');

  // Batch rong
  const batchEmpty = await request('POST', '/transactions/batch', {
    transactions: [],
  }, mibToken);
  assert(
    batchEmpty.status === 422 || batchEmpty.status === 400,
    'Batch rong -> 400/422 (validation error)'
  );

  // Batch co ibId ngoai subtree
  const batchOutOfTree = await request('POST', '/transactions/batch', {
    transactions: [
      { ibId: lv2Id, assetType: 'FOREX', lots: 1.0, rebateAmount: 2.0, tradedAt: new Date().toISOString() },
      { ibId: mibId, assetType: 'FOREX', lots: 1.0, rebateAmount: 2.0, tradedAt: new Date().toISOString() },
    ],
  }, lv1Token);
  assert(batchOutOfTree.status === 403, 'Batch co ibId ngoai subtree -> 403');
  assert(batchOutOfTree.body.error?.code === 'IB_NOT_IN_SUBTREE', 'Error code IB_NOT_IN_SUBTREE (batch)');

  // ── TRANSACTION: Xóa ────────────────────────────────────────────────────
  console.log('\n> TRANSACTION: Xoa giao dich');

  // Lv1 xoa transaction cua chinh minh -> 200
  const deleteTx = await request('DELETE', `/transactions/${lv1TxId}`, null, lv1Token);
  assert(deleteTx.status === 200, 'Lv1 xoa transaction cua minh -> 200');
  assert(deleteTx.body.data?.message !== undefined, 'Response co message');

  // Verify da xoa that
  const getDeleted = await request('GET', `/transactions/${lv1TxId}`, null, lv1Token);
  assert(getDeleted.status === 404, 'GET transaction da xoa -> 404');

  // Lv1 xoa transaction cua MIB -> 403 (khong phai creator, khong phai MIB level=0)
  const deleteByLv1 = await request('DELETE', `/transactions/${mibTxId}`, null, lv1Token);
  assert(deleteByLv1.status === 403, 'Lv1 xoa transaction cua MIB -> 403');
  assert(
    deleteByLv1.body.error?.code === 'TRANSACTION_DELETE_FORBIDDEN',
    'Error code TRANSACTION_DELETE_FORBIDDEN'
  );

  // MIB xoa transaction (level=0 -> quyen xoa bat ky) -> 200
  const deleteByMIB = await request('DELETE', `/transactions/${mibTxId}`, null, mibToken);
  assert(deleteByMIB.status === 200, 'MIB xoa transaction -> 200 (quyen MIB level=0)');

  // Xoa transaction khong ton tai -> 404
  const deleteNotFound = await request('DELETE', '/transactions/00000000-0000-0000-0000-000000000000', null, mibToken);
  assert(deleteNotFound.status === 404, 'DELETE transaction khong ton tai -> 404');

  // ── AUDIT LOG: Cơ bản ────────────────────────────────────────────────────
  console.log('\n> AUDIT LOG: Co ban');

  const auditAll = await request('GET', '/audit/logs', null, mibToken);
  assert(auditAll.status === 200, 'GET /audit/logs -> 200');
  assert(Array.isArray(auditAll.body.data), 'Response co data array');
  assert(auditAll.body.meta?.total >= 0, 'Response co meta.total');
  assert(auditAll.body.meta?.page !== undefined, 'Response co meta.page');
  assert(auditAll.body.meta?.limit !== undefined, 'Response co meta.limit');

  // Filter theo action
  const auditTxFilter = await request('GET', '/audit/logs?action=TRANSACTION_CREATE', null, mibToken);
  assert(auditTxFilter.status === 200, 'Filter action=TRANSACTION_CREATE -> 200');
  if (auditTxFilter.body.data?.length > 0) {
    assert(
      auditTxFilter.body.data.every(l => l.action === 'TRANSACTION_CREATE'),
      'Tat ca logs trong ket qua deu co action = TRANSACTION_CREATE'
    );
    assert(auditTxFilter.body.data[0].actor !== undefined, 'Log co actor info');
    assert(auditTxFilter.body.data[0].actor?.password === undefined, 'Actor khong lo password');
  }

  // Filter theo targetId
  const auditByTarget = await request('GET', `/audit/logs?targetId=${lv2Id}`, null, mibToken);
  assert(auditByTarget.status === 200, 'Filter targetId -> 200');

  // Filter theo date range
  const auditDate = await request('GET', `/audit/logs?from=${today}&to=${today}`, null, mibToken);
  assert(auditDate.status === 200, 'Filter date range (from/to) -> 200');
  assert(Array.isArray(auditDate.body.data), 'Date range response co data array');

  // Pagination
  const auditPage = await request('GET', '/audit/logs?page=1&limit=5', null, mibToken);
  assert(auditPage.status === 200, 'Pagination -> 200');
  assert((auditPage.body.data?.length ?? 0) <= 5, 'Limit pagination hoat dong');

  // Lv1 chi thay logs trong subtree cua minh
  const auditByLv1 = await request('GET', '/audit/logs', null, lv1Token);
  assert(auditByLv1.status === 200, 'Lv1 xem audit logs -> 200');
  const mibAuditTotal = auditAll.body.meta?.total ?? 0;
  const lv1AuditTotal = auditByLv1.body.meta?.total ?? 0;
  if (mibAuditTotal > 0 && lv1AuditTotal > 0) {
    assert(
      lv1AuditTotal <= mibAuditTotal,
      `Lv1 (${lv1AuditTotal}) thay it log hon hoac bang MIB (${mibAuditTotal})`
    );
  }

  // ── AUDIT LOG: Verify nội dung ────────────────────────────────────────────
  // [F4 FIX] Them from=today de chi lay logs tu run hien tai
  console.log('\n> AUDIT LOG: Verify cac action da duoc ghi hom nay');

  const allLogs = await request('GET', `/audit/logs?limit=100&from=${today}`, null, mibToken);
  const actions = allLogs.body.data?.map((l) => l.action) || [];
  console.log(`  [INFO] Tim thay ${actions.length} audit logs hom nay: ${[...new Set(actions)].join(', ')}`);

  assert(actions.includes('IB_CREATE'), 'Audit log co IB_CREATE');
  assert(actions.includes('IB_UPDATE'), 'Audit log co IB_UPDATE');        // [F6 FIX]
  assert(actions.includes('IB_DEACTIVATE'), 'Audit log co IB_DEACTIVATE');
  assert(actions.includes('IB_RESTORE'), 'Audit log co IB_RESTORE');
  assert(actions.includes('TRANSACTION_CREATE'), 'Audit log co TRANSACTION_CREATE');
  assert(actions.includes('TRANSACTION_BATCH_CREATE'), 'Audit log co TRANSACTION_BATCH_CREATE');
  assert(actions.includes('TRANSACTION_DELETE'), 'Audit log co TRANSACTION_DELETE');

  // Verify before/after cho TRANSACTION_CREATE
  const txCreateLogs = allLogs.body.data?.filter(l => l.action === 'TRANSACTION_CREATE');
  if (txCreateLogs?.length > 0) {
    assert(txCreateLogs[0].after !== null, 'TRANSACTION_CREATE log co after data');
    assert(txCreateLogs[0].actor !== undefined, 'TRANSACTION_CREATE log co actor');
  }

  // ── CLEANUP ───────────────────────────────────────────────────────────────
  // [F1 FIX] Luon cleanup IB test du test pass hay fail
  console.log('\n> CLEANUP');
  if (testIbId) {
    // testIb hien dang active (vua duoc restore o tren)
    // Deactivate lai de cleanup
    const cleanupRes = await request('DELETE', `/ib/${testIbId}`, null, mibToken);
    assert(
      cleanupRes.status === 200 || cleanupRes.status === 404,
      `Cleanup IB test -> 200/404`
    );
    console.log(`  [INFO] Da cleanup test IB: ${TEST_EMAIL}`);
  }

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  console.log('\n========================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('ALL TESTS PASSED! Sprint 1 hoan thanh.');
  } else {
    console.log(`${failed} TESTS FAILED. Xem chi tiet o tren.`);
  }
  console.log('========================================\n');
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
