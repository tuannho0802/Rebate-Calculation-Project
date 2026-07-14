/**
 * test-admin-management.js
 * Test tự động toàn bộ luồng Admin Management + Trash Can
 * Chạy: node scratch/test-admin-management.js
 * (Cần server đang chạy tại http://localhost:3001)
 */

const { PrismaClient } = require('@prisma/client');

const BASE_URL = 'http://localhost:3001/api';
const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function api(path, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(`${BASE_URL}${path}`, opts);
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } catch (e) {
    return { status: 0, data: { error: e.message } };
  }
}

const results = [];
function logResult(tc, name, pass, detail = '') {
  const icon = pass ? '[PASS]' : '[FAIL]';
  console.log(`${icon} ${tc} - ${name}${detail ? ' (' + detail + ')' : ''}`);
  results.push({ tc, name, pass, detail });
}

// ─── Setup ────────────────────────────────────────────────────────────────────

async function setup() {
  console.log('\n--- CHUẨN BỊ DỮ LIỆU ---');

  // Dọn admin test cũ nếu có (xóa phụ thuộc trước)
  const existingTestAdmins = await prisma.ibNode.findMany({
    where: { email: { in: ['admin_extra@test.com', 'admin_todelete@test.com'] } },
    select: { id: true },
  });
  for (const a of existingTestAdmins) {
    await prisma.notification.deleteMany({ where: { recipientId: a.id } });
    await prisma.notification.deleteMany({ where: { senderId: a.id } });
    await prisma.refreshToken.deleteMany({ where: { ibId: a.id } });
  }
  await prisma.ibNode.deleteMany({
    where: { email: { in: ['admin_extra@test.com', 'admin_todelete@test.com'] } },
  });

  // Lấy Root Admin
  const rootAdmin = await prisma.ibNode.findFirst({
    where: { isRootAdmin: true },
  });
  if (!rootAdmin) throw new Error('Root Admin (isRootAdmin=true) chưa tồn tại trong DB!');
  console.log(`Root Admin: ${rootAdmin.email} (isRootAdmin=${rootAdmin.isRootAdmin})`);

  // Lấy một IB có dữ liệu transaction
  const ibWithTx = await prisma.rebateTransaction.findFirst({
    select: { ibId: true },
  });
  const ibWithData = ibWithTx
    ? await prisma.ibNode.findUnique({ where: { id: ibWithTx.ibId } })
    : null;
  if (ibWithData) console.log(`IB có transaction: ${ibWithData.email}`);

  // Lấy một IB không có dữ liệu gì để test hard-delete
  // Tạo mới 1 Admin không có relation gì
  const ibcrypt = require('bcrypt');
  const adminToDeleteData = await prisma.ibNode.create({
    data: {
      email: 'admin_todelete@test.com',
      name: 'Admin To Delete',
      password: await ibcrypt.hash('Test@1234', 10),
      role: 'ADMIN',
      level: 0,
    },
  });
  console.log(`Admin để test hard-delete: ${adminToDeleteData.email}`);

  return { rootAdmin, ibWithData, adminToDelete: adminToDeleteData };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function runTests() {
  const { rootAdmin, ibWithData, adminToDelete } = await setup();

  // Login lấy Root Admin token
  const loginRes = await api('/auth/login', 'POST', {
    email: 'admin_test@azrebate.com',
    password: 'Test@1234',
  });
  if (loginRes.status !== 200) {
    console.error('FATAL: Không thể login Root Admin. Abort.', loginRes.data);
    process.exit(1);
  }
  const adminToken = loginRes.data.data.accessToken;

  console.log('\n--- BẮT ĐẦU TEST ---');

  // TC1: Tạo Admin mới
  const t1Res = await api('/admin/users', 'POST', {
    email: 'admin_extra@test.com',
    name: 'Admin Extra',
    password: 'Test@1234',
  }, adminToken);
  if (t1Res.status === 201) {
    logResult('TC1', 'Admin tạo Admin mới', true);
  } else {
    logResult('TC1', 'Admin tạo Admin mới', false, `status=${t1Res.status}: ${JSON.stringify(t1Res.data)}`);
  }

  // TC2: GET /api/admin/users — thấy cả 2 Admin (root + extra)
  await new Promise(r => setTimeout(r, 300));
  const t2Res = await api('/admin/users', 'GET', null, adminToken);
  if (t2Res.status === 200 && Array.isArray(t2Res.data)) {
    const count = t2Res.data.length;
    if (count >= 2) {
      logResult('TC2', 'GET /api/admin/users thấy đủ Admin', true, `count=${count}`);
    } else {
      logResult('TC2', 'GET /api/admin/users thấy đủ Admin', false, `chỉ thấy ${count} admin`);
    }
  } else if (t2Res.status === 200 && t2Res.data?.data) {
    const count = t2Res.data.data.length;
    if (count >= 2) {
      logResult('TC2', 'GET /api/admin/users thấy đủ Admin', true, `count=${count}`);
    } else {
      logResult('TC2', 'GET /api/admin/users thấy đủ Admin', false, `chỉ thấy ${count} admin`);
    }
  } else {
    logResult('TC2', 'GET /api/admin/users thấy đủ Admin', false, `status=${t2Res.status}`);
  }

  // Tìm Admin extra để dùng cho TC3+
  const adminExtra = await prisma.ibNode.findUnique({ where: { email: 'admin_extra@test.com' } });

  // TC3: Soft-delete Admin thường (không phải root) → thành công
  const t3Res = await api(`/admin/users/${adminExtra.id}`, 'DELETE', null, adminToken);
  if (t3Res.status === 200) {
    logResult('TC3', 'Soft-delete Admin thường thành công', true);
  } else {
    logResult('TC3', 'Soft-delete Admin thường thành công', false, `status=${t3Res.status}: ${JSON.stringify(t3Res.data)}`);
  }

  // TC3b: Xác nhận biến mất khỏi GET /api/admin/users
  const t3bRes = await api('/admin/users', 'GET', null, adminToken);
  const adminList = t3bRes.data?.data || t3bRes.data || [];
  const stillVisible = Array.isArray(adminList) && adminList.some(a => a.id === adminExtra.id);
  if (!stillVisible) {
    logResult('TC3b', 'Admin bị soft-delete biến khỏi GET /admin/users', true);
  } else {
    logResult('TC3b', 'Admin bị soft-delete biến khỏi GET /admin/users', false, 'Vẫn còn xuất hiện trong danh sách');
  }

  // TC3c: Xuất hiện trong GET /api/trash
  const t3cRes = await api('/trash', 'GET', null, adminToken);
  const trashList = t3cRes.data?.data || t3cRes.data || [];
  const inTrash = Array.isArray(trashList) && trashList.some(a => a.id === adminExtra.id);
  if (inTrash) {
    logResult('TC3c', 'Admin bị soft-delete xuất hiện trong GET /trash', true);
  } else {
    logResult('TC3c', 'Admin bị soft-delete xuất hiện trong GET /trash', false, `trash count=${trashList.length}, not found`);
  }

  // TC4: Soft-delete Root Admin → 403
  const t4Res = await api(`/admin/users/${rootAdmin.id}`, 'DELETE', null, adminToken);
  if (t4Res.status === 403 && t4Res.data?.error?.code === 'ROOT_ADMIN_PROTECTED') {
    logResult('TC4', 'Soft-delete Root Admin bị chặn 403', true);
  } else {
    logResult('TC4', 'Soft-delete Root Admin bị chặn 403', false, `status=${t4Res.status}: ${JSON.stringify(t4Res.data)}`);
  }

  // TC5: Restore Admin vừa xóa
  const t5Res = await api(`/trash/${adminExtra.id}/restore`, 'PATCH', null, adminToken);
  if (t5Res.status === 200) {
    // Xác nhận isActive = true trong DB
    const restored = await prisma.ibNode.findUnique({ where: { id: adminExtra.id } });
    if (restored?.isActive) {
      logResult('TC5', 'Restore Admin từ Trash thành công', true);
    } else {
      logResult('TC5', 'Restore Admin từ Trash thành công', false, 'API 200 nhưng isActive vẫn false trong DB');
    }
  } else {
    logResult('TC5', 'Restore Admin từ Trash thành công', false, `status=${t5Res.status}: ${JSON.stringify(t5Res.data)}`);
  }

  // TC6: Hard-delete IB đang có transaction → bị chặn với thông báo rõ bảng
  if (ibWithData) {
    // Deactivate trước để nằm trong trash
    await prisma.ibNode.update({ where: { id: ibWithData.id }, data: { isActive: false } });
    const t6Res = await api(`/trash/${ibWithData.id}/permanent`, 'DELETE', null, adminToken);
    if (t6Res.status === 400 && t6Res.data?.error?.code === 'HAS_RELATIONS') {
      logResult('TC6', 'Hard-delete IB có transaction bị chặn rõ ràng', true, t6Res.data.error.message);
    } else {
      logResult('TC6', 'Hard-delete IB có transaction bị chặn rõ ràng', false, `status=${t6Res.status}: ${JSON.stringify(t6Res.data)}`);
    }
    // Restore lại IB đó để không làm vỡ dữ liệu seed
    await prisma.ibNode.update({ where: { id: ibWithData.id }, data: { isActive: true } });
  } else {
    logResult('TC6', 'Hard-delete IB có transaction bị chặn', false, 'Không có IB có transaction trong DB để test');
  }

  // TC7: Hard-delete Admin vừa tạo (không có dữ liệu) → thành công
  // Phải deactivate trước để nằm trong trash
  await prisma.ibNode.update({ where: { id: adminToDelete.id }, data: { isActive: false } });
  const t7Res = await api(`/trash/${adminToDelete.id}/permanent`, 'DELETE', null, adminToken);
  if (t7Res.status === 200) {
    // Xác nhận DB: không còn record
    const afterDelete = await prisma.ibNode.findUnique({ where: { id: adminToDelete.id } });
    if (!afterDelete) {
      logResult('TC7', 'Hard-delete Admin trống → xóa thành công, DB xác nhận biến mất', true);
    } else {
      logResult('TC7', 'Hard-delete Admin trống → xóa thành công, DB xác nhận biến mất', false, 'API 200 nhưng record vẫn còn trong DB');
    }
  } else {
    logResult('TC7', 'Hard-delete Admin trống → xóa thành công, DB xác nhận biến mất', false, `status=${t7Res.status}: ${JSON.stringify(t7Res.data)}`);
  }

  // TC8: Hard-delete Root Admin → 403 (dù đã ở trong trash)
  await prisma.ibNode.update({ where: { id: rootAdmin.id }, data: { isActive: false } });
  const t8Res = await api(`/trash/${rootAdmin.id}/permanent`, 'DELETE', null, adminToken);
  if (t8Res.status === 403 && t8Res.data?.error?.code === 'ROOT_ADMIN_PROTECTED') {
    logResult('TC8', 'Hard-delete Root Admin bị chặn 403', true);
  } else {
    logResult('TC8', 'Hard-delete Root Admin bị chặn 403', false, `status=${t8Res.status}: ${JSON.stringify(t8Res.data)}`);
  }
  // Restore Root Admin lại
  await prisma.ibNode.update({ where: { id: rootAdmin.id }, data: { isActive: true } });

  // Dọn Admin extra test (xóa notification trước để tránh FK constraint)
  const extraAdmin = await prisma.ibNode.findUnique({ where: { email: 'admin_extra@test.com' } });
  if (extraAdmin) {
    await prisma.notification.deleteMany({ where: { recipientId: extraAdmin.id } });
    await prisma.notification.deleteMany({ where: { senderId: extraAdmin.id } });
    await prisma.refreshToken.deleteMany({ where: { ibId: extraAdmin.id } });
    await prisma.ibNode.deleteMany({ where: { email: 'admin_extra@test.com' } });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TC9 — Bảo mật: IB thường KHÔNG được gọi API quản trị
  // ─────────────────────────────────────────────────────────────────────────
  const mibLoginRes = await api('/auth/login', 'POST', { email: 'mib@test.com', password: 'Test@1234' });
  if (mibLoginRes.status !== 200) {
    logResult('TC9', 'Bảo mật IB không được gọi admin API', false, `Không login được MIB: ${JSON.stringify(mibLoginRes.data)}`);
    console.error('\n⚠️  CRITICAL: Không thể login MIB để test TC9 — dừng báo cáo.');
    process.exit(1);
  }
  const mibToken = mibLoginRes.data.data.accessToken;

  const t9a = await api('/admin/users', 'GET', null, mibToken);
  const t9b = await api('/trash', 'GET', null, mibToken);
  // Dùng id giả — guard phải chặn ở tầng role trước khi lookup DB
  const t9c = await api('/trash/00000000-0000-0000-0000-000000000001/permanent', 'DELETE', null, mibToken);

  const all403 = t9a.status === 403 && t9b.status === 403 && t9c.status === 403;
  if (all403) {
    logResult('TC9', 'IB thường bị chặn khỏi toàn bộ admin/trash API', true,
      `GET /admin/users=${t9a.status}, GET /trash=${t9b.status}, DELETE /trash/permanent=${t9c.status}`);
  } else {
    const issues = [];
    if (t9a.status !== 403) issues.push(`GET /admin/users=${t9a.status} ← LỖ HỔNG BẢO MẬT`);
    if (t9b.status !== 403) issues.push(`GET /trash=${t9b.status} ← LỖ HỔNG BẢO MẬT`);
    if (t9c.status !== 403) issues.push(`DELETE /trash/permanent=${t9c.status} ← LỖ HỔNG BẢO MẬT`);
    logResult('TC9', 'IB thường bị chặn khỏi toàn bộ admin/trash API', false, issues.join('; '));
    console.error('\n⚠️  CRITICAL SECURITY: TC9 FAIL — có lỗ hổng bảo mật nghiêm trọng! Dừng lại để sửa ngay.');
    process.exit(1);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TC10 — Kiểm tra HAS_RELATIONS phát hiện đúng bảng (wallet, không phải config)
  // ─────────────────────────────────────────────────────────────────────────
  const bcrypt10 = require('bcrypt');
  const adminWalletTest = await prisma.ibNode.create({
    data: {
      email: 'admin_wallettest@test.com',
      name: 'Admin Wallet Test',
      password: await bcrypt10.hash('Test@1234', 10),
      role: 'ADMIN',
      level: 0,
    },
  });

  // Tạo wallet giả cho admin này (không có rebate_config nào)
  await prisma.wallet.create({
    data: { ibId: adminWalletTest.id, balance: 0, totalEarned: 0, totalPaid: 0 },
  });

  // Deactivate rồi thử hard-delete
  await prisma.ibNode.update({ where: { id: adminWalletTest.id }, data: { isActive: false } });
  const t10Res = await api(`/trash/${adminWalletTest.id}/permanent`, 'DELETE', null, adminToken);

  if (t10Res.status === 400 && t10Res.data?.error?.code === 'HAS_RELATIONS') {
    const msg = t10Res.data.error.message || '';
    const mentionsWallet = msg.toLowerCase().includes('wallet');
    const mentionsConfig = msg.toLowerCase().includes('rebate_config');
    if (mentionsWallet && !mentionsConfig) {
      logResult('TC10', 'HAS_RELATIONS chỉ ra đúng bảng "wallets" (không nhầm rebate_configs)', true, msg);
    } else {
      logResult('TC10', 'HAS_RELATIONS chỉ ra đúng bảng "wallets" (không nhầm rebate_configs)', false,
        `msg="${msg}" — mentionsWallet=${mentionsWallet}, mentionsConfig=${mentionsConfig}`);
    }
  } else {
    logResult('TC10', 'HAS_RELATIONS chỉ ra đúng bảng "wallets" (không nhầm rebate_configs)', false,
      `status=${t10Res.status}: ${JSON.stringify(t10Res.data)}`);
  }

  // Dọn wallet test + admin
  await prisma.wallet.deleteMany({ where: { ibId: adminWalletTest.id } });
  await prisma.notification.deleteMany({ where: { recipientId: adminWalletTest.id } });
  await prisma.refreshToken.deleteMany({ where: { ibId: adminWalletTest.id } });
  await prisma.ibNode.delete({ where: { id: adminWalletTest.id } });

  // ─────────────────────────────────────────────────────────────────────────
  // TC11 — PATCH /admin/users/:id không cho sửa role/isRootAdmin
  // ─────────────────────────────────────────────────────────────────────────
  const bcrypt11 = require('bcrypt');
  const adminPatchTest = await prisma.ibNode.create({
    data: {
      email: 'admin_patchtest@test.com',
      name: 'Admin Patch Test',
      password: await bcrypt11.hash('Test@1234', 10),
      role: 'ADMIN',
      level: 0,
    },
  });

  const t11Res = await api(`/admin/users/${adminPatchTest.id}`, 'PATCH', {
    name: 'Ten Moi Updated',
    role: 'IB',
    isRootAdmin: true,
  }, adminToken);

  if (t11Res.status === 200) {
    const dbAfter = await prisma.ibNode.findUnique({ where: { id: adminPatchTest.id } });
    const nameChanged = dbAfter?.name === 'Ten Moi Updated';
    const roleUnchanged = dbAfter?.role === 'ADMIN';
    const rootAdminUnchanged = dbAfter?.isRootAdmin === false;

    if (nameChanged && roleUnchanged && rootAdminUnchanged) {
      logResult('TC11', 'PATCH không cho sửa role/isRootAdmin, chỉ sửa được name', true,
        `name=${dbAfter.name}, role=${dbAfter.role}, isRootAdmin=${dbAfter.isRootAdmin}`);
    } else {
      const issues = [];
      if (!nameChanged) issues.push(`name không đổi: ${dbAfter?.name}`);
      if (!roleUnchanged) issues.push(`role bị đổi thành: ${dbAfter?.role}`);
      if (!rootAdminUnchanged) issues.push(`isRootAdmin bị đổi thành: ${dbAfter?.isRootAdmin}`);
      logResult('TC11', 'PATCH không cho sửa role/isRootAdmin, chỉ sửa được name', false, issues.join('; '));
    }
  } else {
    logResult('TC11', 'PATCH không cho sửa role/isRootAdmin, chỉ sửa được name', false,
      `Expected 200, got ${t11Res.status}: ${JSON.stringify(t11Res.data)}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TC12 — PATCH email trùng với Admin đang tồn tại → lỗi rõ ràng, không phải 500
  // ─────────────────────────────────────────────────────────────────────────
  // Tạo thêm 1 Admin thứ 2 để dùng email của nó làm email trùng
  const bcrypt12 = require('bcrypt');
  const adminPatchTest2 = await prisma.ibNode.create({
    data: {
      email: 'admin_patchtest2@test.com',
      name: 'Admin Patch Test 2',
      password: await bcrypt12.hash('Test@1234', 10),
      role: 'ADMIN',
      level: 0,
    },
  });

  // Thử PATCH admin1 với email của admin2 (đang tồn tại)
  const t12Res = await api(`/admin/users/${adminPatchTest.id}`, 'PATCH', {
    email: 'admin_patchtest2@test.com',
  }, adminToken);

  if (t12Res.status === 409) {
    logResult('TC12', 'PATCH email trùng → 409 rõ ràng, không phải 500', true,
      t12Res.data?.error?.code || t12Res.data?.error?.message || '');
  } else {
    logResult('TC12', 'PATCH email trùng → 409 rõ ràng, không phải 500', false,
      `Expected 409, got ${t12Res.status}: ${JSON.stringify(t12Res.data)}`);
  }

  // Dọn 2 admin patch test
  for (const id of [adminPatchTest.id, adminPatchTest2.id]) {
    await prisma.notification.deleteMany({ where: { recipientId: id } });
    await prisma.refreshToken.deleteMany({ where: { ibId: id } });
    await prisma.ibNode.delete({ where: { id } });
  }

  // ─── Bảng tổng kết ────────────────────────────────────────────────────────
  console.log('\n--- BẢNG TỔNG KẾT ---');
  for (const r of results) {
    const icon = r.pass ? 'PASS' : 'FAIL';
    console.log(`${r.tc.padEnd(4)} | ${icon} | ${r.name}`);
    if (!r.pass && r.detail) console.log(`       -> ${r.detail}`);
    if (r.pass && r.detail) console.log(`       (${r.detail})`);
  }
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`\nTổng: ${passed} PASS, ${failed} FAIL\n`);
}

runTests()
  .catch((e) => {
    console.error('Lỗi trong quá trình chạy test:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
