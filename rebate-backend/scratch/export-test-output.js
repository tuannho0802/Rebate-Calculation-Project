const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const OUTPUT_DIR = path.join(__dirname, 'export-test-output');

// ── UTILS ────────────────────────────────────────────────────────────────────

function request(method, reqPath, data = null, token = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: PORT,
            path: `/api${reqPath}`,
            method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (token) options.headers['Authorization'] = `Bearer ${token}`;
        if (data) options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));

        const req = http.request(options, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const raw = Buffer.concat(chunks);
                const contentType = res.headers['content-type'] || '';
                if (contentType.includes('spreadsheetml')) {
                    resolve({ status: res.statusCode, buffer: raw, headers: res.headers });
                } else {
                    try {
                        resolve({ status: res.statusCode, body: JSON.parse(raw.toString()), headers: res.headers });
                    } catch {
                        resolve({ status: res.statusCode, body: raw.toString(), headers: res.headers });
                    }
                }
            });
        });

        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

function saveFile(buffer, filename) {
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const filepath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filepath, buffer);
    return filepath;
}

function pass(msg) { console.log(`  ✅ PASS: ${msg}`); }
function fail(msg) { console.log(`  ❌ FAIL: ${msg}`); }
function section(msg) { console.log(`\n▶ ${msg}`); }

// ── MAIN ─────────────────────────────────────────────────────────────────────

async function runExportTests() {
    console.log('\n========================================');
    console.log('EXPORT TEST SUITE');
    console.log('Date:', new Date().toISOString().split('T')[0]);
    console.log('Output dir:', OUTPUT_DIR);
    console.log('========================================');

    let mibToken, lv1Token, mibId, lv1Id;
    const period = new Date().toISOString().slice(0, 7); // YYYY-MM hiện tại

    // ── AUTH ──────────────────────────────────────────────────────────────────
    section('AUTH: Login');
    const mibLogin = await request('POST', '/auth/login', { email: 'mib@test.com', password: 'Test@1234' });
    if (mibLogin.status !== 200) { fail('MIB login thất bại'); process.exit(1); }
    mibToken = mibLogin.body.data.accessToken;
    mibId = mibLogin.body.data.user.id;

    const lv1Login = await request('POST', '/auth/login', { email: 'lv1-a@test.com', password: 'Test@1234' });
    if (lv1Login.status !== 200) { fail('Lv1 login thất bại'); process.exit(1); }
    lv1Token = lv1Login.body.data.accessToken;
    lv1Id = lv1Login.body.data.user.id;
    pass('MIB + Lv1 đăng nhập thành công');

    // ── EXPORT REBATE CONFIG ──────────────────────────────────────────────────
    section('EXPORT: Rebate Config');

    // Test 1: MIB export — phải 200 + file hợp lệ
    const mibConfigRes = await request('GET', `/export/rebate-config?period=${period}`, null, mibToken);
    if (mibConfigRes.status === 200) {
        pass(`MIB export rebate-config → 200`);
        if (mibConfigRes.buffer && mibConfigRes.buffer.length > 0) {
            const filepath = saveFile(mibConfigRes.buffer, `rebate-config-MIB-${period}.xlsx`);
            pass(`File saved: ${filepath} (${mibConfigRes.buffer.length} bytes)`);
        } else {
            fail('Buffer rỗng');
        }
    } else {
        fail(`MIB export rebate-config → ${mibConfigRes.status} | ${JSON.stringify(mibConfigRes.body)}`);
    }

    // Test 2: Lv1 export — phải 200 + file hợp lệ
    const lv1ConfigRes = await request('GET', `/export/rebate-config?period=${period}`, null, lv1Token);
    if (lv1ConfigRes.status === 200) {
        pass(`Lv1 export rebate-config → 200`);
        if (lv1ConfigRes.buffer && lv1ConfigRes.buffer.length > 0) {
            const filepath = saveFile(lv1ConfigRes.buffer, `rebate-config-Lv1-${period}.xlsx`);
            pass(`File saved: ${filepath} (${lv1ConfigRes.buffer.length} bytes)`);
        } else {
            fail('Buffer rỗng');
        }
    } else {
        fail(`Lv1 export rebate-config → ${lv1ConfigRes.status} | ${JSON.stringify(lv1ConfigRes.body)}`);
    }

    // Test 3: Content-Type phải đúng
    const ct = lv1ConfigRes.headers?.['content-type'] || '';
    if (ct.includes('spreadsheetml')) {
        pass(`Content-Type đúng: ${ct}`);
    } else {
        fail(`Content-Type sai: ${ct}`);
    }

    // Test 4: Content-Disposition có filename .xlsx
    const cd = lv1ConfigRes.headers?.['content-disposition'] || '';
    if (cd.includes('.xlsx')) {
        pass(`Content-Disposition có filename .xlsx: ${cd}`);
    } else {
        fail(`Content-Disposition thiếu .xlsx: ${cd}`);
    }

    // ── EXPORT TRANSACTIONS ───────────────────────────────────────────────────
    section('EXPORT: Transactions');

    // Test 5: MIB export transactions — phải 200
    const mibTxRes = await request('GET', `/export/transactions?period=${period}`, null, mibToken);
    if (mibTxRes.status === 200) {
        pass(`MIB export transactions → 200`);
        if (mibTxRes.buffer && mibTxRes.buffer.length > 0) {
            const filepath = saveFile(mibTxRes.buffer, `transactions-MIB-${period}.xlsx`);
            pass(`File saved: ${filepath} (${mibTxRes.buffer.length} bytes)`);
        } else {
            fail('Buffer rỗng');
        }
    } else {
        fail(`MIB export transactions → ${mibTxRes.status} | ${JSON.stringify(mibTxRes.body)}`);
    }

    // Test 6: Lv1 export transactions của chính mình — phải 200
    const lv1TxRes = await request('GET', `/export/transactions?period=${period}`, null, lv1Token);
    if (lv1TxRes.status === 200) {
        pass(`Lv1 export transactions (own) → 200`);
        if (lv1TxRes.buffer && lv1TxRes.buffer.length > 0) {
            const filepath = saveFile(lv1TxRes.buffer, `transactions-Lv1-${period}.xlsx`);
            pass(`File saved: ${filepath} (${lv1TxRes.buffer.length} bytes)`);
        }
    } else {
        fail(`Lv1 export transactions → ${lv1TxRes.status} | ${JSON.stringify(lv1TxRes.body)}`);
    }

    // Test 7: Lv1 export transactions của MIB (ngoài subtree) → phải 403
    const forbiddenTxRes = await request('GET', `/export/transactions?ibId=${mibId}`, null, lv1Token);
    if (forbiddenTxRes.status === 403) {
        pass(`Lv1 export transactions của MIB → 403 (đúng)`);
    } else {
        fail(`Lv1 export transactions của MIB → ${forbiddenTxRes.status} (expected 403)`);
    }

    // Test 8: Không có token → phải 401
    const noTokenRes = await request('GET', `/export/rebate-config?period=${period}`);
    if (noTokenRes.status === 401) {
        pass(`Không có token → 401`);
    } else {
        fail(`Không có token → ${noTokenRes.status} (expected 401)`);
    }

    // ── SUMMARY ───────────────────────────────────────────────────────────────
    console.log('\n========================================');
    console.log('✅ EXPORT TEST HOÀN THÀNH');
    console.log(`📁 File Excel đã lưu tại: ${OUTPUT_DIR}`);
    console.log('========================================\n');
}

runExportTests().catch((err) => {
    console.error('\n❌ TEST CRASH:', err.message || err);
    process.exit(1);
});