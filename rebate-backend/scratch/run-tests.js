const http = require('http');

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api' + path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = 'Bearer ' + token;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          if (data) {
             resolve({ status: res.statusCode, data: JSON.parse(data) });
          } else {
             resolve({ status: res.statusCode, data: null });
          }
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING TESTS ---');

  const mibRes = await request('POST', '/auth/login', { email: 'mib@test.com', password: 'Test@1234' });
  if (mibRes.status !== 200) { console.error('Failed to login as MIB', mibRes); return; }
  const mibToken = mibRes.data.data.accessToken;
  const mibId = mibRes.data.data.user.id;
  console.log('MIB Login OK, ID:', mibId);

  const lv1Res = await request('POST', '/auth/login', { email: 'lv1-a@test.com', password: 'Test@1234' });
  if (lv1Res.status !== 200) { console.error('Failed to login as LV1A', lv1Res); return; }
  const lv1Token = lv1Res.data.data.accessToken;
  const lv1Id = lv1Res.data.data.user.id;
  console.log('LV1A Login OK, ID:', lv1Id);

  console.log('\\n--- Suite E: rebateType param in calculate ---');
  let res;
  
  res = await request('GET', '/rebate/calculate?ibId=' + mibId + '&assetType=FOREX&lots=1', null, mibToken);
  console.log('E1 status:', res.status, 'rebateType:', res.data.data?.rebateType);
  if (res.status === 200 && res.data.data.rebateType === 'STP_REBATE') console.log('E1 PASSED'); else console.log('E1 FAILED', res.data);

  res = await request('GET', '/rebate/calculate?ibId=' + mibId + '&assetType=FOREX&lots=1&rebateType=STP_REBATE', null, mibToken);
  console.log('E2 status:', res.status, 'rebateType:', res.data.data?.rebateType);
  if (res.status === 200 && res.data.data.rebateType === 'STP_REBATE') console.log('E2 PASSED'); else console.log('E2 FAILED');

  res = await request('GET', '/rebate/calculate?ibId=' + mibId + '&assetType=FOREX&lots=1&rebateType=CENT_REBATE', null, mibToken);
  console.log('E3 status:', res.status, 'rebateType:', res.data.data?.rebateType);
  if (res.status === 200 && res.data.data.rebateType === 'CENT_REBATE') console.log('E3 PASSED'); else console.log('E3 FAILED');

  res = await request('GET', '/rebate/calculate?ibId=' + lv1Id + '&assetType=FOREX&lots=1&rebateType=CENT_REBATE', null, mibToken);
  console.log('E4 status:', res.status, 'code:', res.data?.error?.code);
  if (res.status === 404 && res.data.error?.code === 'REBATE_CONFIG_NOT_FOUND') console.log('E4 PASSED'); else console.log('E4 FAILED');

  console.log('\\n--- Suite G: updatedAt reflects latest PUT ---');

  res = await request('GET', '/rebate/config/' + lv1Id, null, mibToken);
  const T1 = res.data.data.updatedAt;
  console.log('G1 status:', res.status, 'T1:', T1);

  await new Promise(r => setTimeout(r, 1500));

  res = await request('PUT', '/rebate/config/' + lv1Id, {
      assets: [{ assetType: 'FOREX', rebateType: 'STP_REBATE', rebatePips: 1, markupPips: 1, markupPercent: 100 }]
  }, mibToken);
  if (res.status !== 200) { console.error('G2 FAILED with', res.data); return; }
  const T2 = res.data.data.updatedAt;
  console.log('G2 status:', res.status, 'T2:', T2);
  if (res.status === 200 && new Date(T2) > new Date(T1)) console.log('G2 PASSED'); else console.log('G2 FAILED');

  res = await request('GET', '/rebate/config/' + lv1Id, null, mibToken);
  if (res.status !== 200) { console.error('G3 FAILED with', res.data); return; }
  const T3 = res.data.data.updatedAt;
  console.log('G3 status:', res.status, 'T3:', T3);
  if (res.status === 200 && new Date(T3) > new Date(T1)) console.log('G3 PASSED'); else console.log('G3 FAILED');

  const assetForex = res.data.data.assets.find(a => a.assetType === 'FOREX' && a.rebateType === 'STP_REBATE');
  console.log('G4 asset updatedAt:', assetForex?.updatedAt);
  if (assetForex && assetForex.updatedAt === T2) console.log('G4 PASSED'); else console.log('G4 FAILED');

  console.log('\\n--- Regression Tests ---');
  res = await request('GET', '/ib/' + mibId + '/children?page=1&limit=10', null, mibToken);
  if (res.status === 200 && res.data.data.data) console.log('B3 PASSED'); else console.log('B3 FAILED', res.data);

  res = await request('PUT', '/ib/' + lv1Id, { name: 'LV1A Updated' }, mibToken);
  if (res.status === 200) console.log('B4 PASSED'); else console.log('B4 FAILED', res.data);

  res = await request('GET', '/rebate/config/' + mibId, null, mibToken);
  if (res.status === 200) console.log('C1 PASSED'); else console.log('C1 FAILED');

  res = await request('PUT', '/rebate/config/' + lv1Id, {
      assets: [{ assetType: 'FOREX', rebateType: 'STP_REBATE', rebatePips: 100, markupPips: 100, markupPercent: 100 }]
  }, mibToken);
  if (res.status === 422 && res.data.error?.code === 'REBATE_EXCEEDS_MAX') console.log('C4 PASSED'); else console.log('C4 FAILED', res.data);

  res = await request('GET', '/rebate/calculate?ibId=' + lv1Id + '&assetType=FOREX&lots=1', null, mibToken);
  if (res.status === 200 && res.data.data.breakdown.distributed) console.log('D1 PASSED'); else console.log('D1 FAILED', res.data);

  res = await request('POST', '/auth/change-password', { oldPassword: 'Test@1234', newPassword: 'NewPassword@123' }, lv1Token);
  if (res.status === 200) {
      console.log('F PASSED (part 1)');
      const lv1Res2 = await request('POST', '/auth/login', { email: 'lv1-a@test.com', password: 'NewPassword@123' });
      await request('POST', '/auth/change-password', { oldPassword: 'NewPassword@123', newPassword: 'Test@1234' }, lv1Res2.data.data.accessToken);
  } else {
      console.log('F FAILED', res.data);
  }

  res = await request('DELETE', '/ib/' + lv1Id, null, mibToken);
  if (res.status === 200) console.log('B6 PASSED'); else console.log('B6 FAILED', res.data);
}

runTests().catch(console.error);
