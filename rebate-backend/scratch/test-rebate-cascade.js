// scratch/test-rebate-cascade.js
// Test riêng cho logic phân bổ ngân sách rebate theo flowchart 3 cấp (MIB -> Lv1 -> Lv2 -> Lv3)
// Chạy: node scratch/test-rebate-cascade.js
// Yêu cầu: server đang chạy tại localhost:3001, đã seed data gốc (mib@test.com / Test@1234)
//
// Test KHÔNG hardcode số liệu của flowchart mẫu — nó ĐỌC ngân sách thật của MIB
// (asset GOLD) tại thời điểm chạy, rồi tự tính các mức cấp phát (60% / 40%) và
// assert các quan hệ phải đúng ở MỌI cấp:
//   parent_sau = parent_truoc - giao_cho_con
//   maxPips_con = rebatePips_con + markupPips_con
//   vuot ngan sach -> bi reject (422) va KHONG lam thay doi du lieu (rollback)
//   cap nhat lai allocation -> parent duoc hoan tien dung
//   cascade: doi allocation cua con -> maxPips cua chau phai doi theo TONG moi,
//            nhung rebatePips/markupPips cua chau KHONG bi dong vao

const BASE = 'http://localhost:3001/api';
const ASSET = 'GOLD';
const REBATE_TYPE = 'STP_REBATE';

async function request(method, path, body, token) {
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    let json;
    try { json = await res.json(); } catch { json = null; }
    return { status: res.status, body: json };
}

let passed = 0;
let failed = 0;

function assert(condition, message, extra) {
    if (!condition) {
        console.error(`  ❌ FAIL: ${message}${extra ? ' | ' + JSON.stringify(extra) : ''}`);
        failed++;
        process.exitCode = 1;
    } else {
        console.log(`  ✅ PASS: ${message}`);
        passed++;
    }
}

function round(n, d = 4) {
    const f = 10 ** d;
    return Math.round((n + Number.EPSILON) * f) / f;
}

function approxEq(a, b, eps = 0.001) {
    return Math.abs(Number(a) - Number(b)) < eps;
}

async function login(email, password) {
    const r = await request('POST', '/auth/login', { email, password });
    if (r.status !== 200) {
        throw new Error(`Login failed cho ${email}: ${JSON.stringify(r.body)}`);
    }
    return { token: r.body.data.accessToken, id: r.body.data.user.id };
}

async function createSubIb(token, parentLabel) {
    const ts = Date.now() + Math.floor(Math.random() * 1000);
    const email = `rebate-cascade-${parentLabel}-${ts}@example.com`;
    const r = await request('POST', '/ib', {
        email,
        password: 'Test@1234',
        name: `Test ${parentLabel} ${ts}`,
    }, token);
    if (r.status !== 201) {
        throw new Error(`Tạo sub-IB thất bại (${parentLabel}): ${JSON.stringify(r.body)}`);
    }
    return { id: r.body.data.id, email };
}

async function getAssetConfig(ibId, token) {
    const r = await request('GET', `/rebate/config/${ibId}`, null, token);
    if (r.status !== 200) {
        throw new Error(`GET config thất bại cho ${ibId}: ${JSON.stringify(r.body)}`);
    }
    const asset = r.body.data.assets.find(
        (a) => a.assetType === ASSET && (a.rebateType || 'STP_REBATE') === REBATE_TYPE
    );
    return asset || { rebatePips: 0, markupPips: 0, maxPips: 0 };
}

async function putAssetConfig(targetIbId, token, rebatePips, markupPips, markupPercent = 100) {
    return request('PUT', `/rebate/config/${targetIbId}`, {
        assets: [{
            assetType: ASSET,
            rebateType: REBATE_TYPE,
            rebatePips: round(rebatePips),
            markupPips: round(markupPips),
            markupPercent,
        }],
    }, token);
}

async function run() {
    console.log('\n========================================');
    console.log('REBATE CASCADE TEST — 3 cấp Lv1 → Lv2 → Lv3');
    console.log(`Asset: ${ASSET} | Date: ${new Date().toISOString().slice(0, 10)}`);
    console.log('========================================\n');

    // ── SETUP: login MIB, đọc ngân sách GOLD thật hiện tại ─────────────
    console.log('▶ SETUP');
    const mib = await login('mib@test.com', 'Test@1234');
    const mibBefore = await getAssetConfig(mib.id, mib.token);
    assert(mibBefore.rebatePips > 0 || mibBefore.markupPips > 0,
        `MIB có ngân sách GOLD ban đầu (rebate=${mibBefore.rebatePips}, markup=${mibBefore.markupPips})`);

    if (mibBefore.rebatePips <= 0 && mibBefore.markupPips <= 0) {
        console.error('FATAL: MIB không có ngân sách GOLD để test. Kiểm tra lại seed data.');
        process.exit(1);
    }

    const lv1 = await createSubIb(mib.token, 'lv1');
    assert(!!lv1.id, `Tạo Lv1Test (${lv1.email}) thành công`);
    const lv1Login = await login(lv1.email, 'Test@1234');

    // ─────────────────────────────────────────────────────────────────
    // CASE 1: MIB → Lv1Test (cấp lần đầu) — verify trừ đúng từng field,
    //         maxPips con = tổng vừa nhận
    // ─────────────────────────────────────────────────────────────────
    console.log('\n▶ CASE 1: MIB cấp ngân sách cho Lv1Test (giao 60%)');

    const giveLv1 = {
        rebatePips: round(mibBefore.rebatePips * 0.6),
        markupPips: round(mibBefore.markupPips * 0.6),
    };
    console.log(`  [INFO] MIB trước: rebate=${mibBefore.rebatePips}, markup=${mibBefore.markupPips}`);
    console.log(`  [INFO] Giao cho Lv1Test: rebate=${giveLv1.rebatePips}, markup=${giveLv1.markupPips}`);

    const putLv1 = await putAssetConfig(lv1.id, mib.token, giveLv1.rebatePips, giveLv1.markupPips);
    assert(putLv1.status === 200, 'PUT /rebate/config/:lv1Id (MIB giao cho Lv1Test) → 200', putLv1.body);

    const mibAfter1 = await getAssetConfig(mib.id, mib.token);
    assert(
        approxEq(mibAfter1.rebatePips, mibBefore.rebatePips - giveLv1.rebatePips),
        `MIB.rebatePips bị trừ đúng (kỳ vọng ${round(mibBefore.rebatePips - giveLv1.rebatePips)}, thực tế ${mibAfter1.rebatePips})`
    );
    assert(
        approxEq(mibAfter1.markupPips, mibBefore.markupPips - giveLv1.markupPips),
        `MIB.markupPips bị trừ đúng (kỳ vọng ${round(mibBefore.markupPips - giveLv1.markupPips)}, thực tế ${mibAfter1.markupPips})`
    );

    const lv1Config1 = await getAssetConfig(lv1.id, mib.token);
    assert(approxEq(lv1Config1.rebatePips, giveLv1.rebatePips), 'Lv1Test.rebatePips = số MIB vừa giao');
    assert(approxEq(lv1Config1.markupPips, giveLv1.markupPips), 'Lv1Test.markupPips = số MIB vừa giao');
    assert(
        approxEq(lv1Config1.maxPips, giveLv1.rebatePips + giveLv1.markupPips),
        `Lv1Test.maxPips = tổng vừa nhận (${round(giveLv1.rebatePips + giveLv1.markupPips)})`
    );

    // ─────────────────────────────────────────────────────────────────
    // CASE 2: Lv1Test → Lv2Test (cấp lần đầu), sau đó thử VƯỢT NGÂN SÁCH
    //         (phải bị reject + rollback), rồi UPDATE giảm allocation
    //         (Lv1Test phải được hoàn tiền đúng)
    // ─────────────────────────────────────────────────────────────────
    console.log('\n▶ CASE 2: Lv1Test cấp cho Lv2Test, test vượt ngân sách, test update/hoàn tiền');

    const lv2 = await createSubIb(lv1Login.token, 'lv2');
    assert(!!lv2.id, `Tạo Lv2Test (${lv2.email}) thành công`);
    const lv2Login = await login(lv2.email, 'Test@1234');

    const giveLv2 = {
        rebatePips: round(giveLv1.rebatePips * 0.6),
        markupPips: round(giveLv1.markupPips * 0.6),
    };
    console.log(`  [INFO] Giao cho Lv2Test: rebate=${giveLv2.rebatePips}, markup=${giveLv2.markupPips}`);

    const putLv2 = await putAssetConfig(lv2.id, lv1Login.token, giveLv2.rebatePips, giveLv2.markupPips);
    assert(putLv2.status === 200, 'PUT /rebate/config/:lv2Id (Lv1Test giao cho Lv2Test) → 200', putLv2.body);

    const lv1ConfigAfterGive2 = await getAssetConfig(lv1.id, lv1Login.token);
    assert(
        approxEq(lv1ConfigAfterGive2.rebatePips, giveLv1.rebatePips - giveLv2.rebatePips),
        `Lv1Test.rebatePips còn lại đúng (${round(giveLv1.rebatePips - giveLv2.rebatePips)})`
    );
    assert(
        approxEq(lv1ConfigAfterGive2.markupPips, giveLv1.markupPips - giveLv2.markupPips),
        `Lv1Test.markupPips còn lại đúng (${round(giveLv1.markupPips - giveLv2.markupPips)})`
    );

    const lv2Config1 = await getAssetConfig(lv2.id, lv1Login.token);
    assert(approxEq(lv2Config1.rebatePips, giveLv2.rebatePips), 'Lv2Test.rebatePips = số Lv1Test vừa giao');
    assert(
        approxEq(lv2Config1.maxPips, giveLv2.rebatePips + giveLv2.markupPips),
        `Lv2Test.maxPips = tổng vừa nhận (${round(giveLv2.rebatePips + giveLv2.markupPips)})`
    );

    // --- Thử giao VƯỢT ngân sách (gấp đôi số Lv1Test từng nhận từ MIB) ---
    const overRequest = {
        rebatePips: round(giveLv1.rebatePips * 2),
        markupPips: round(giveLv1.markupPips * 2),
    };
    const putOver = await putAssetConfig(lv2.id, lv1Login.token, overRequest.rebatePips, overRequest.markupPips);
    assert(putOver.status === 422, 'Giao vượt ngân sách (gấp đôi) → 422', putOver.body);
    assert(
        putOver.body?.error?.code === 'REBATE_EXCEEDS_MAX' || putOver.body?.error?.code === 'MARKUP_EXCEEDS_MAX',
        `Error code đúng là REBATE_EXCEEDS_MAX hoặc MARKUP_EXCEEDS_MAX (thực tế: ${putOver.body?.error?.code})`
    );

    // Verify ROLLBACK — Lv1Test và Lv2Test phải KHÔNG đổi sau request bị reject
    const lv1ConfigAfterOver = await getAssetConfig(lv1.id, lv1Login.token);
    const lv2ConfigAfterOver = await getAssetConfig(lv2.id, lv1Login.token);
    assert(
        approxEq(lv1ConfigAfterOver.rebatePips, lv1ConfigAfterGive2.rebatePips) &&
        approxEq(lv1ConfigAfterOver.markupPips, lv1ConfigAfterGive2.markupPips),
        'Lv1Test KHÔNG bị thay đổi sau request vượt ngân sách bị reject (rollback đúng)'
    );
    assert(
        approxEq(lv2ConfigAfterOver.rebatePips, lv2Config1.rebatePips) &&
        approxEq(lv2ConfigAfterOver.markupPips, lv2Config1.markupPips),
        'Lv2Test KHÔNG bị thay đổi sau request vượt ngân sách bị reject (rollback đúng)'
    );

    // --- UPDATE: giảm allocation cho Lv2Test xuống 1 nửa, Lv1Test phải được hoàn tiền ---
    const newGiveLv2 = {
        rebatePips: round(giveLv2.rebatePips * 0.5),
        markupPips: round(giveLv2.markupPips * 0.5),
    };
    console.log(`  [INFO] Update giảm Lv2Test xuống: rebate=${newGiveLv2.rebatePips}, markup=${newGiveLv2.markupPips}`);

    const putLv2Update = await putAssetConfig(lv2.id, lv1Login.token, newGiveLv2.rebatePips, newGiveLv2.markupPips);
    assert(putLv2Update.status === 200, 'PUT giảm allocation Lv2Test → 200', putLv2Update.body);

    const lv1ConfigAfterRefund = await getAssetConfig(lv1.id, lv1Login.token);
    assert(
        approxEq(lv1ConfigAfterRefund.rebatePips, giveLv1.rebatePips - newGiveLv2.rebatePips),
        `Lv1Test.rebatePips được hoàn tiền đúng (kỳ vọng ${round(giveLv1.rebatePips - newGiveLv2.rebatePips)}, thực tế ${lv1ConfigAfterRefund.rebatePips})`
    );
    assert(
        approxEq(lv1ConfigAfterRefund.markupPips, giveLv1.markupPips - newGiveLv2.markupPips),
        `Lv1Test.markupPips được hoàn tiền đúng (kỳ vọng ${round(giveLv1.markupPips - newGiveLv2.markupPips)}, thực tế ${lv1ConfigAfterRefund.markupPips})`
    );

    const lv2Config2 = await getAssetConfig(lv2.id, lv1Login.token);
    assert(approxEq(lv2Config2.rebatePips, newGiveLv2.rebatePips), 'Lv2Test.rebatePips = số mới sau update');
    assert(
        approxEq(lv2Config2.maxPips, newGiveLv2.rebatePips + newGiveLv2.markupPips),
        `Lv2Test.maxPips cập nhật đúng tổng mới (${round(newGiveLv2.rebatePips + newGiveLv2.markupPips)})`
    );

    // ─────────────────────────────────────────────────────────────────
    // CASE 3: Lv2Test → Lv3Test, rồi Lv1Test đổi allocation của Lv2Test
    //         lần nữa → verify CASCADE: maxPips của Lv3Test phải đổi theo
    //         tổng mới, nhưng rebatePips/markupPips của Lv3Test không đổi
    // ─────────────────────────────────────────────────────────────────
    console.log('\n▶ CASE 3: Lv2Test cấp cho Lv3Test + verify cascade maxPips khi Lv2Test bị đổi allocation');

    const lv3 = await createSubIb(lv2Login.token, 'lv3');
    assert(!!lv3.id, `Tạo Lv3Test (${lv3.email}) thành công`);

    const giveLv3 = {
        rebatePips: round(newGiveLv2.rebatePips * 0.5),
        markupPips: round(newGiveLv2.markupPips * 0.5),
    };
    console.log(`  [INFO] Giao cho Lv3Test: rebate=${giveLv3.rebatePips}, markup=${giveLv3.markupPips}`);

    const putLv3 = await putAssetConfig(lv3.id, lv2Login.token, giveLv3.rebatePips, giveLv3.markupPips);
    assert(putLv3.status === 200, 'PUT /rebate/config/:lv3Id (Lv2Test giao cho Lv3Test) → 200', putLv3.body);

    const lv2ConfigAfterGive3 = await getAssetConfig(lv2.id, lv2Login.token);
    assert(
        approxEq(lv2ConfigAfterGive3.rebatePips, newGiveLv2.rebatePips - giveLv3.rebatePips),
        'Lv2Test.rebatePips còn lại đúng sau khi giao cho Lv3Test'
    );

    const lv3Config1 = await getAssetConfig(lv3.id, lv2Login.token);
    assert(approxEq(lv3Config1.rebatePips, giveLv3.rebatePips), 'Lv3Test.rebatePips = số Lv2Test vừa giao');
    assert(
        approxEq(lv3Config1.maxPips, giveLv3.rebatePips + giveLv3.markupPips),
        `Lv3Test.maxPips ban đầu = tổng vừa nhận (${round(giveLv3.rebatePips + giveLv3.markupPips)})`
    );

    // --- Lv1Test đổi allocation của Lv2Test (đổi tổng) → phải cascade xuống Lv3Test.maxPips ---
    const lv1Remaining = await getAssetConfig(lv1.id, lv1Login.token);
    const budgetForLv2 = lv1Remaining.rebatePips + lv1Remaining.markupPips +
        newGiveLv2.rebatePips + newGiveLv2.markupPips; // remaining + đã giao trước đó cho Lv2Test
    const scaleFactor = (budgetForLv2 * 0.8) / (newGiveLv2.rebatePips + newGiveLv2.markupPips);
    const changedGiveLv2 = {
        rebatePips: round(newGiveLv2.rebatePips * scaleFactor),
        markupPips: round(newGiveLv2.markupPips * scaleFactor),
    };
    console.log(`  [INFO] Lv1Test đổi allocation Lv2Test thành: rebate=${changedGiveLv2.rebatePips}, markup=${changedGiveLv2.markupPips} (trong budget=${round(budgetForLv2)})`);

    const putLv2Changed = await putAssetConfig(lv2.id, lv1Login.token, changedGiveLv2.rebatePips, changedGiveLv2.markupPips);
    assert(putLv2Changed.status === 200, 'PUT đổi allocation Lv2Test (trigger cascade) → 200', putLv2Changed.body);

    const lv3ConfigAfterCascade = await getAssetConfig(lv3.id, lv2Login.token);
    const expectedNewMaxPips = round(changedGiveLv2.rebatePips + changedGiveLv2.markupPips);
    assert(
        approxEq(lv3ConfigAfterCascade.maxPips, expectedNewMaxPips),
        `Lv3Test.maxPips CASCADE đúng theo tổng mới của Lv2Test (kỳ vọng ${expectedNewMaxPips}, thực tế ${lv3ConfigAfterCascade.maxPips})`
    );
    assert(
        approxEq(lv3ConfigAfterCascade.rebatePips, lv3Config1.rebatePips) &&
        approxEq(lv3ConfigAfterCascade.markupPips, lv3Config1.markupPips),
        'Lv3Test.rebatePips/markupPips KHÔNG bị đụng vào khi cascade (chỉ maxPips đổi)'
    );

    // ─────────────────────────────────────────────────────────────────
    // CLEANUP
    // ─────────────────────────────────────────────────────────────────
    console.log('\n▶ CLEANUP');
    await request('DELETE', `/ib/${lv1.id}`, null, mib.token);
    console.log(`  [INFO] Đã deactivate cây test: ${lv1.email} (và subtree Lv2Test/Lv3Test theo sau)`);

    console.log('\n========================================');
    console.log(`Results: ${passed} passed, ${failed} failed`);
    if (failed === 0) {
        console.log('✅ TẤT CẢ TEST CASCADE PASS — logic ngân sách rebate đúng theo flowchart!');
    } else {
        console.log('❌ MỘT SỐ TEST THẤT BẠI — xem chi tiết ở trên');
    }
    console.log('========================================\n');
}

run().catch((err) => {
    console.error('Lỗi không mong đợi:', err);
    process.exit(1);
});