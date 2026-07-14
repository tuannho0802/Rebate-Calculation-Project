#!/usr/bin/env node
/**
 * SCRATCH TEST — PUT /rebate/config/bulk
 * File được track trong git để tái sử dụng. Dữ liệu test được GIỮ LẠI trong DB sau khi chạy
 * (không restore) để kiểm tra trên frontend.
 * Chạy: node scratch/test-bulk-rebate.js
 * Yêu cầu: backend chạy tại http://localhost:3001, DB đã seed theo 08_LOCAL_MIGRATION_SEED.md.
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3001/api';

const ADMIN_CREDS = { email: 'admin_test@azrebate.com', password: 'Test@1234' };
const IB_CREDS = { email: 'lv1-a@test.com', password: 'Test@1234' };

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log(`  \u2705 ${msg}`);
  } else {
    failed++;
    console.log(`  \u274c ${msg}`);
  }
}

async function login(creds) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(creds),
  });
  const json = await res.json();
  if (!json.success) throw new Error(`Login failed for ${creds.email}: ${JSON.stringify(json)}`);
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

function flatten(node) {
  let out = [node];
  for (const c of node.children || []) out = out.concat(flatten(c));
  return out;
}

async function main() {
  console.log('== Login ==');
  const adminToken = await login(ADMIN_CREDS);
  const ibToken = await login(IB_CREDS);
  console.log('  admin + ib token OK');

  console.log('\n== Lay cay IB de chon target ==');
  const { json: treeRes } = await call('GET', '/ib/tree?depth=all', adminToken);
  assert(treeRes?.success === true, 'GET /ib/tree?depth=all tra success:true cho ADMIN');
  const roots = Array.isArray(treeRes.data) ? treeRes.data : [treeRes.data];
  const flat = roots.flatMap(flatten).filter((n) => n.level > 0);
  assert(flat.length >= 2, `Co it nhat 2 IB cap >0 trong seed data (tim thay ${flat.length})`);

  const targetA = flat[0]; // se set gia tri HOP LE
  const targetB = flat[1]; // se set gia tri VUOT MAX (de test REBATE_EXCEEDS_MAX)
  console.log(`  targetA = ${targetA.email} (${targetA.id})`);
  console.log(`  targetB = ${targetB.email} (${targetB.id})`);

  console.log('\n== Snapshot config goc (chi de so sanh TEST 6, khong restore) ==');
  const { json: origA } = await call('GET', `/rebate/config/${targetA.id}`, adminToken);
  const { json: origB } = await call('GET', `/rebate/config/${targetB.id}`, adminToken);

  {
    console.log('\n== TEST 1: IB thuong goi endpoint bulk => phai bi 403 FORBIDDEN_ROLES_ONLY ==');
    const t1 = await call('PUT', '/rebate/config/bulk', ibToken, {
      items: [{ ibId: targetA.id, assets: [{ assetType: 'FOREX', rebatePips: 1, markupPips: 1, markupPercent: 100 }] }],
    });
    assert(t1.status === 403, `HTTP status = 403 (thuc te: ${t1.status})`);
    assert(t1.json?.error?.code === 'FORBIDDEN_ROLES_ONLY', `error.code = FORBIDDEN_ROLES_ONLY (thuc te: ${t1.json?.error?.code})`);

    console.log('\n== TEST 2: Route order - /rebate/config/bulk KHONG bi hieu la :ibId="bulk" ==');
    const t2 = await call('PUT', '/rebate/config/bulk', adminToken, { items: [] });
    assert(t2.json?.error?.code !== 'IB_NOT_FOUND', `Khong tra IB_NOT_FOUND (neu co nghia la bi Nest match nham route :ibId). Thuc te: ${t2.json?.error?.code}`);

    console.log('\n== TEST 3: items rong => VALIDATION_ERROR ==');
    assert(t2.status === 422 || t2.json?.error?.code === 'VALIDATION_ERROR', `items:[] => 422 VALIDATION_ERROR (thuc te: ${t2.status} ${t2.json?.error?.code})`);

    console.log('\n== TEST 4: 1 item hop le + 1 item vuot maxPips => partial success ==');
    const forexMax = origA?.data?.assets?.find((a) => a.assetType === 'FOREX')?.maxPips ?? 12;
    const t4 = await call('PUT', '/rebate/config/bulk', adminToken, {
      items: [
        { ibId: targetA.id, assets: [{ assetType: 'FOREX', rebatePips: 1, markupPips: 1, markupPercent: 100 }] },
        { ibId: targetB.id, assets: [{ assetType: 'FOREX', rebatePips: forexMax + 100, markupPips: 0, markupPercent: 100 }] },
      ],
    });
    assert(t4.status === 200, `HTTP 200 (thuc te: ${t4.status})`);
    assert(t4.json?.data?.successCount === 1, `successCount = 1 (thuc te: ${t4.json?.data?.successCount})`);
    assert(t4.json?.data?.failCount === 1, `failCount = 1 (thuc te: ${t4.json?.data?.failCount})`);
    const resA = t4.json?.data?.results?.find((r) => r.ibId === targetA.id);
    const resB = t4.json?.data?.results?.find((r) => r.ibId === targetB.id);
    assert(resA?.success === true, 'targetA (hop le) => success:true');
    assert(resB?.success === false && resB?.error?.code === 'REBATE_EXCEEDS_MAX', `targetB (vuot max) => success:false, error.code=REBATE_EXCEEDS_MAX (thuc te: ${resB?.error?.code})`);

    console.log('\n== TEST 5: Config cua targetA thuc su duoc luu vao DB ==');
    const { json: checkA } = await call('GET', `/rebate/config/${targetA.id}`, adminToken);
    const savedForexA = checkA?.data?.assets?.find((a) => a.assetType === 'FOREX');
    assert(savedForexA?.rebatePips === 1, `GET lai thay rebatePips=1 (thuc te: ${savedForexA?.rebatePips})`);

    console.log('\n== TEST 6: Config cua targetB KHONG bi thay doi (item loi khong ghi de) ==');
    const { json: checkB } = await call('GET', `/rebate/config/${targetB.id}`, adminToken);
    const savedForexB = checkB?.data?.assets?.find((a) => a.assetType === 'FOREX');
    const origForexB = origB?.data?.assets?.find((a) => a.assetType === 'FOREX');
    assert(savedForexB?.rebatePips === origForexB?.rebatePips, `targetB.rebatePips khong doi (${origForexB?.rebatePips} -> ${savedForexB?.rebatePips})`);

    console.log('\n== TEST 7: History co ghi nhan thay doi cho targetA ==');
    const { json: histA } = await call('GET', `/rebate/config/${targetA.id}/history?limit=1`, adminToken);
    assert(Array.isArray(histA?.data) && histA.data.length > 0, 'Co it nhat 1 record history moi cho targetA');
  }

  console.log('\n== Giu du lieu test trong DB (khong restore) ==');
  console.log(`  targetA (${targetA.email}): FOREX rebatePips=1, markupPips=1 — dung de check FE`);
  console.log(`  targetB (${targetB.email}): config khong doi (item loi khong ghi de)`);

  console.log(`\n=== KET QUA: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Test script crash:', err);
  process.exit(1);
});
