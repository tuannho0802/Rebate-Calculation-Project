#!/usr/bin/env node
/**
 * SCRATCH TEST — PUT /rebate/config/mib/:mibId/max-override + updateConfig preserve override
 * Chạy: node scratch/test-mib-max-override.js
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3001/api';
const ADMIN = { email: 'admin_test@azrebate.com', password: 'Test@1234' };

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; console.log(`  \u2705 ${msg}`); }
  else { failed++; console.log(`  \u274c ${msg}`); }
}

async function login(creds) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(creds),
  });
  const json = await res.json();
  if (!json.success) throw new Error(`Login failed: ${JSON.stringify(json)}`);
  return json.data.accessToken;
}

async function call(method, path, token, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

async function main() {
  console.log('== Login admin ==');
  const token = await login(ADMIN);

  console.log('\n== Lay MIB tu tree ==');
  const tree = await call('GET', '/ib/tree?depth=all', token);
  const roots = Array.isArray(tree.json?.data) ? tree.json.data : [tree.json?.data];
  const mib = roots.find((r) => r.email === 'mib@test.com');
  assert(!!mib, `Tim thay mib@test.com (id=${mib?.id})`);
  if (!mib) { process.exit(1); }

  const lv1A = (mib.children || []).find((c) => c.email === 'lv1-a@test.com');
  assert(!!lv1A, `Tim thay lv1-a duoi mib (id=${lv1A?.id})`);

  console.log('\n== Backup config MIB FOREX ==');
  const orig = await call('GET', `/rebate/config/${mib.id}`, token);
  const origForex = orig.json?.data?.assets?.find(
    (a) => a.assetType === 'FOREX' && a.rebateType === 'STP_REBATE',
  );

  try {
    console.log('\n== TEST 1: NOT_A_MIB — lv1-a => 400 ==');
    const t1 = await call('PUT', `/rebate/config/mib/${lv1A.id}/max-override`, token, {
      overrides: [{ assetType: 'FOREX', rebateType: 'STP_REBATE', maxPips: 8 }],
    });
    assert(t1.status === 400, `HTTP 400 (thuc te: ${t1.status})`);
    assert(t1.json?.error?.code === 'NOT_A_MIB', `code NOT_A_MIB (thuc te: ${t1.json?.error?.code})`);

    console.log('\n== TEST 2: Cho phep vuot tran cong ty — FOREX max 999 => 200 ==');
    const t2 = await call('PUT', `/rebate/config/mib/${mib.id}/max-override`, token, {
      overrides: [{ assetType: 'FOREX', rebateType: 'STP_REBATE', maxPips: 999 }],
    });
    assert(t2.status === 200, `HTTP 200 (thuc te: ${t2.status})`);
    const cfg999 = t2.json?.data?.assets?.find(
      (a) => a.assetType === 'FOREX' && a.rebateType === 'STP_REBATE',
    );
    assert(cfg999?.maxPips === 999, `MIB maxPips=999 (thuc te: ${cfg999?.maxPips})`);

    console.log('\n== TEST 2b: History ghi nhan override ==');
    const hist = await call('GET', `/rebate/config/${mib.id}/history?limit=5`, token);
    const forexHist = (hist.json?.data || []).find(
      (h) => h.rebateConfig?.assetType === 'FOREX' && h.after?.maxPips === 999,
    );
    assert(!!forexHist, 'Co record history after.maxPips=999');
    assert(!!forexHist?.changedBy?.email, `changedBy co email (thuc te: ${forexHist?.changedBy?.email})`);

    console.log('\n== TEST 3: Set override FOREX = 8 cho MIB (sau khi da 999, ghi de) ==');
    const t3 = await call('PUT', `/rebate/config/mib/${mib.id}/max-override`, token, {
      overrides: [{ assetType: 'FOREX', rebateType: 'STP_REBATE', maxPips: 8 }],
    });
    assert(t3.status === 200, `HTTP 200 (thuc te: ${t3.status})`);
    const cfgForex = t3.json?.data?.assets?.find(
      (a) => a.assetType === 'FOREX' && a.rebateType === 'STP_REBATE',
    );
    assert(cfgForex?.maxPips === 8, `MIB maxPips=8 (thuc te: ${cfgForex?.maxPips})`);

    console.log('\n== TEST 4: Cascade xuong lv1-a — maxPips <= 8 ==');
    const lv1Cfg = await call('GET', `/rebate/config/${lv1A.id}`, token);
    const lv1Forex = lv1Cfg.json?.data?.assets?.find(
      (a) => a.assetType === 'FOREX' && a.rebateType === 'STP_REBATE',
    );
    assert(lv1Forex?.maxPips <= 8, `lv1-a FOREX maxPips <= 8 (thuc te: ${lv1Forex?.maxPips})`);

    console.log('\n== TEST 4b: MAX_OVERRIDE_INVALID — maxPips am => 422 ==');
    const t4b = await call('PUT', `/rebate/config/mib/${mib.id}/max-override`, token, {
      overrides: [{ assetType: 'GOLD', rebateType: 'STP_REBATE', maxPips: -1 }],
    });
    assert(t4b.status === 422, `HTTP 422 (thuc te: ${t4b.status})`);
    assert(
      t4b.json?.error?.code === 'MAX_OVERRIDE_INVALID' || t4b.json?.error?.code === 'VALIDATION_ERROR',
      `code MAX_OVERRIDE_INVALID hoac VALIDATION_ERROR (thuc te: ${t4b.json?.error?.code})`,
    );

    console.log('\n== TEST 5: updateConfig binh thuong — override KHONG mat ==');
    const t5 = await call('PUT', `/rebate/config/${mib.id}`, token, {
      assets: [{
        assetType: 'FOREX',
        rebateType: 'STP_REBATE',
        rebatePips: 2,
        markupPips: 3,
        markupPercent: 100,
      }],
    });
    assert(t5.status === 200, `HTTP 200 (thuc te: ${t5.status}, code: ${t5.json?.error?.code})`);
    const afterForex = t5.json?.data?.assets?.find(
      (a) => a.assetType === 'FOREX' && a.rebateType === 'STP_REBATE',
    );
    assert(afterForex?.maxPips === 8, `Sau updateConfig maxPips van = 8 (thuc te: ${afterForex?.maxPips})`);
  } finally {
    console.log('\n== Restore config goc ==');
    if (orig.json?.success && origForex) {
      await call('PUT', `/rebate/config/${mib.id}`, token, {
        assets: orig.json.data.assets.map(({ updatedAt, ...rest }) => rest),
      });
    }
    console.log('  Da restore.');
  }

  console.log(`\n=== KET QUA: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Test script crash:', err);
  process.exit(1);
});
