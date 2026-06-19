// scratch/test-sprint1.js
// Chay: node scratch/test-sprint1.js
// Yeu cau: server dang chay tai localhost:3001, seed data da co

const BASE = 'http://localhost:3001/api';
// Unique email moi lan chay test de tranh conflict
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
  console.log('\n========================================');
  console.log('SPRINT 1 - API TEST SUITE');
  console.log('========================================\n');

  // -- AUTH: LOGIN --
  console.log('> AUTH: Login MIB');
  const loginMIB = await request('POST', '/auth/login', { email: 'mib@test.com', password: 'Test@1234' });
  assert(loginMIB.status === 200, 'MIB login -> 200');
  assert(loginMIB.body.data?.accessToken, 'MIB nhan duoc accessToken');
  const mibToken = loginMIB.body.data.accessToken;
  const mibId = loginMIB.body.data.user.id;

  console.log('\n> AUTH: Login Lv1');
  const loginLv1 = await request('POST', '/auth/login', { email: 'lv1-a@test.com', password: 'Test@1234' });
  assert(loginLv1.status === 200, 'Lv1 login -> 200');
  const lv1Token = loginLv1.body.data.accessToken;
  const lv1Id = loginLv1.body.data.user.id;

  // -- AUTH: Kiem tra endpoint khong co token -> 401 --
  console.log('\n> AUTH: Bao ve endpoint');
  const noToken = await request('GET', '/transactions/some-id', null, null);
  assert(noToken.status === 401, 'GET /transactions/:id khong co token -> 401');

  const noTokenBatch = await request('POST', '/transactions/batch', { transactions: [] }, null);
  assert(noTokenBatch.status === 401, 'POST /transactions/batch khong co token -> 401');

  // -- IB SEARCH --
  console.log('\n> IB SEARCH');
  const searchOk = await request('GET', '/ib/search?q=lv2', null, mibToken);
  assert(searchOk.status === 200, 'Search "lv2" -> 200');
  assert(Array.isArray(searchOk.body.data), 'Response co data array');
  assert(searchOk.body.meta?.total >= 0, 'Response co meta.total');
  assert(searchOk.body.meta?.query === 'lv2', 'Response co meta.query');

  const searchShort = await request('GET', '/ib/search?q=l', null, mibToken);
  assert(searchShort.status === 400, 'Search query 1 ky tu -> 400');
  assert(searchShort.body.error?.code === 'SEARCH_QUERY_TOO_SHORT', 'Error code SEARCH_QUERY_TOO_SHORT');

  const searchNoQ = await request('GET', '/ib/search', null, mibToken);
  assert(searchNoQ.status === 400, 'Search khong co query param -> 400');

  const searchWithInactive = await request('GET', '/ib/search?q=lv2&includeInactive=true', null, mibToken);
  assert(searchWithInactive.status === 200, 'Search voi includeInactive=true -> 200');

  // Dung cung query cho ca MIB va Lv1 de so sanh chinh xac
  const searchMibSameQ = await request('GET', '/ib/search?q=lv2', null, mibToken);
  const searchByLv1 = await request('GET', '/ib/search?q=lv2', null, lv1Token);
  assert(searchByLv1.status === 200, 'Lv1 search -> 200');
  // MIB thay tat ca, Lv1 chi thay subtree cua minh
  const mibTotal = searchMibSameQ.body.meta?.total ?? 0;
  const lv1Total = searchByLv1.body.meta?.total ?? 0;
  assert(lv1Total <= mibTotal, `Lv1 (${lv1Total}) thay it hon hoac bang MIB (${mibTotal}) voi cung query`);

  // -- IB DEACTIVATE & RESTORE --
  console.log('\n> IB DEACTIVATE & RESTORE');

  // Su dung email unique moi lan chay de tranh IB_EMAIL_TAKEN
  const newIb = await request('POST', '/ib', {
    email: TEST_EMAIL,
    password: 'Test@1234',
    name: 'Test Restore IB',
  }, mibToken);
  assert(newIb.status === 201, `Tao IB test (${TEST_EMAIL}) -> 201`);
  const testIbId = newIb.body.data?.id;
  assert(!!testIbId, 'Tao IB test co ID');

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

  // Restore IB dang active -> 422
  const restoreAgain = await request('PATCH', `/ib/${testIbId}/restore`, null, mibToken);
  assert(restoreAgain.status === 422, 'Restore IB dang active -> 422');
  assert(restoreAgain.body.error?.code === 'IB_ALREADY_ACTIVE', 'Error code IB_ALREADY_ACTIVE');

  // -- TRANSACTION: Lay Lv2 --
  const children = await request('GET', `/ib/${lv1Id}/children`, null, lv1Token);
  // Tim lv2 child dau tien co isActive=true
  const lv2 = children.body.data?.find(c => c.isActive === true && c.id !== testIbId);
  const lv2Id = lv2?.id;
  assert(!!lv2Id, `Lay duoc ID cua Lv2 (${lv2?.email}) de dung cho transaction tests`);

  // -- TRANSACTION: Tao don --
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

  // MIB tao transaction cho Lv2 (MIB la root cua subtree -> duoc phep)
  const txByMIB = await request('POST', '/transactions', {
    ibId: lv2Id,
    assetType: 'GOLD',
    lots: 1.0,
    rebateAmount: 4.00,
    tradedAt: new Date().toISOString(),
  }, mibToken);
  assert(txByMIB.status === 201, 'MIB tao transaction cho Lv2 -> 201');
  const mibTxId = txByMIB.body.data?.id;

  // Validation: lots toi thieu (project tra ve 422 cho validation errors)
  const createTxBadLots = await request('POST', '/transactions', {
    ibId: lv2Id,
    assetType: 'FOREX',
    lots: 0,
    rebateAmount: 5.00,
    tradedAt: new Date().toISOString(),
  }, lv1Token);
  assert(createTxBadLots.status === 422 || createTxBadLots.status === 400, 'Lots = 0 -> 422 (validation error)');

  // Validation: ibId khong trong subtree
  const createTxOutOfTree = await request('POST', '/transactions', {
    ibId: mibId, // MIB khong phai subtree cua Lv1
    assetType: 'FOREX',
    lots: 1.0,
    rebateAmount: 2.00,
    tradedAt: new Date().toISOString(),
  }, lv1Token);
  assert(createTxOutOfTree.status === 403, 'Lv1 tao transaction cho MIB -> 403');
  assert(createTxOutOfTree.body.error?.code === 'IB_NOT_IN_SUBTREE', 'Error code IB_NOT_IN_SUBTREE');

  // -- TRANSACTION: Xem chi tiet --
  console.log('\n> TRANSACTION: Xem chi tiet');

  const getTx = await request('GET', `/transactions/${lv1TxId}`, null, lv1Token);
  assert(getTx.status === 200, 'GET /transactions/:id -> 200');
  assert(getTx.body.data?.id === lv1TxId, 'Response dung transaction');
  assert(getTx.body.data?.ib !== undefined, 'Response co ib info');
  assert(getTx.body.data?.createdBy !== undefined, 'Response co createdBy info');
  assert(getTx.body.data?.ib?.password === undefined, 'Khong lo password cua IB');

  const getTxByMIB = await request('GET', `/transactions/${lv1TxId}`, null, mibToken);
  assert(getTxByMIB.status === 200, 'MIB xem transaction cua Lv2 -> 200 (trong subtree)');

  const getTxNotFound = await request('GET', '/transactions/00000000-0000-0000-0000-000000000000', null, mibToken);
  assert(getTxNotFound.status === 404, 'GET transaction khong ton tai -> 404');
  assert(getTxNotFound.body.error?.code === 'TRANSACTION_NOT_FOUND', 'Error code TRANSACTION_NOT_FOUND');

  // -- TRANSACTION: Batch --
  console.log('\n> TRANSACTION: Batch import');

  const batchResult = await request('POST', '/transactions/batch', {
    transactions: [
      { ibId: lv2Id, assetType: 'FOREX', lots: 1.0, rebateAmount: 2.0, tradedAt: new Date().toISOString() },
      { ibId: lv2Id, assetType: 'GOLD', lots: 0.5, rebateAmount: 2.0, tradedAt: new Date().toISOString() },
      { ibId: lv2Id, assetType: 'FOREX', lots: 3.0, rebateAmount: 6.0, tradedAt: new Date().toISOString(), note: 'Batch test' },
    ],
  }, lv1Token);
  assert(batchResult.status === 201, 'Batch import 3 transactions -> 201');
  assert(batchResult.body.data?.created === 3, 'created = 3');

  // Batch rong -> 422 (validation error trong project nay)
  const batchEmpty = await request('POST', '/transactions/batch', { transactions: [] }, mibToken);
  assert(batchEmpty.status === 422 || batchEmpty.status === 400, 'Batch rong -> 422 (validation error)');

  // Batch co ibId ngoai subtree -> 403
  const batchOutOfTree = await request('POST', '/transactions/batch', {
    transactions: [
      { ibId: lv2Id, assetType: 'FOREX', lots: 1.0, rebateAmount: 2.0, tradedAt: new Date().toISOString() },
      { ibId: mibId, assetType: 'FOREX', lots: 1.0, rebateAmount: 2.0, tradedAt: new Date().toISOString() },
    ],
  }, lv1Token);
  assert(batchOutOfTree.status === 403, 'Batch co ibId ngoai subtree -> 403');

  // -- TRANSACTION: Xoa --
  console.log('\n> TRANSACTION: Xoa giao dich');

  // Lv1 xoa transaction do minh tao -> 200
  const deleteTx = await request('DELETE', `/transactions/${lv1TxId}`, null, lv1Token);
  assert(deleteTx.status === 200, 'Lv1 xoa transaction cua minh -> 200');
  assert(deleteTx.body.data?.message !== undefined, 'Response co message');

  const getDeleted = await request('GET', `/transactions/${lv1TxId}`, null, lv1Token);
  assert(getDeleted.status === 404, 'GET transaction da xoa -> 404');

  // Lv1 xoa transaction do MIB tao -> 403
  const deleteByLv1 = await request('DELETE', `/transactions/${mibTxId}`, null, lv1Token);
  assert(deleteByLv1.status === 403, 'Lv1 xoa transaction cua MIB -> 403');
  assert(deleteByLv1.body.error?.code === 'TRANSACTION_DELETE_FORBIDDEN', 'Error code TRANSACTION_DELETE_FORBIDDEN');

  // MIB xoa bat ky transaction nao trong subtree -> 200
  const deleteByMIB = await request('DELETE', `/transactions/${mibTxId}`, null, mibToken);
  assert(deleteByMIB.status === 200, 'MIB xoa transaction cua minh -> 200');

  // -- AUDIT LOG --
  console.log('\n> AUDIT LOG: Co ban');

  const auditAll = await request('GET', '/audit/logs', null, mibToken);
  assert(auditAll.status === 200, 'GET /audit/logs -> 200');
  assert(Array.isArray(auditAll.body.data), 'Response co data array');
  assert(auditAll.body.meta?.total >= 0, 'Response co meta.total');
  assert(auditAll.body.meta?.page !== undefined, 'Response co meta.page');
  assert(auditAll.body.meta?.limit !== undefined, 'Response co meta.limit');

  // Filter theo action
  const auditTx = await request('GET', '/audit/logs?action=TRANSACTION_CREATE', null, mibToken);
  assert(auditTx.status === 200, 'Filter action=TRANSACTION_CREATE -> 200');
  if (auditTx.body.data?.length > 0) {
    assert(auditTx.body.data[0].action === 'TRANSACTION_CREATE', 'Tat ca log co action dung');
    assert(auditTx.body.data[0].actor !== undefined, 'Log co actor info');
  }

  // Filter theo targetId
  const auditByTarget = await request('GET', `/audit/logs?targetId=${lv2Id}`, null, mibToken);
  assert(auditByTarget.status === 200, 'Filter targetId -> 200');

  // Filter theo date range
  const today = new Date().toISOString().split('T')[0];
  const auditDate = await request('GET', `/audit/logs?from=${today}&to=${today}`, null, mibToken);
  assert(auditDate.status === 200, 'Filter date range -> 200');

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
    assert(lv1AuditTotal <= mibAuditTotal, `Lv1 (${lv1AuditTotal}) thay it log hon hoac bang MIB (${mibAuditTotal})`);
  }

  // -- AUDIT LOG: Verify noi dung --
  console.log('\n> AUDIT LOG: Verify cac action da duoc ghi');

  const allLogs = await request('GET', '/audit/logs?limit=100', null, mibToken);
  const actions = allLogs.body.data?.map((l) => l.action) || [];

  assert(actions.includes('IB_CREATE'), 'Audit log co IB_CREATE');
  assert(actions.includes('IB_DEACTIVATE'), 'Audit log co IB_DEACTIVATE');
  assert(actions.includes('IB_RESTORE'), 'Audit log co IB_RESTORE');
  assert(actions.includes('TRANSACTION_CREATE'), 'Audit log co TRANSACTION_CREATE');
  assert(actions.includes('TRANSACTION_BATCH_CREATE'), 'Audit log co TRANSACTION_BATCH_CREATE');
  assert(actions.includes('TRANSACTION_DELETE'), 'Audit log co TRANSACTION_DELETE');

  // -- SUMMARY --
  console.log('\n========================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('ALL TESTS PASSED!');
  } else {
    console.log(`${failed} TESTS FAILED. Xem chi tiet o tren.`);
  }
  console.log('========================================\n');
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
