const http = require('http');

async function request(method, path, body = null, token = null) {
  return new Promise((resolve) => {
    const opts = {
      hostname: 'localhost',
      port: 3001,
      path: '/api' + path,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    if (token) {
      opts.headers['Authorization'] = 'Bearer ' + token;
    }
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', (e) => resolve({ status: 'ERROR', body: e.message }));
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function run() {
  console.log('--- 6. POST /api/auth/login ---');
  const loginRes = await request('POST', '/auth/login', { email: 'mib@test.com', password: 'Test@1234' });
  console.log('Status:', loginRes.status);
  console.log('Response:', JSON.stringify(loginRes.body, null, 2));

  if (!loginRes.body?.data?.accessToken) {
    console.log('Login failed, stopping.');
    return;
  }
  const token = loginRes.body.data.accessToken;
  const myId = loginRes.body.data.user.id;

  console.log('\n--- 7. GET /api/ib/me ---');
  const meRes = await request('GET', '/ib/me', null, token);
  console.log('Status:', meRes.status);
  console.log('Response:', JSON.stringify(meRes.body, null, 2));

  console.log('\n--- 8. GET /api/ib/' + myId + '/profile ---');
  const profileRes = await request('GET', '/ib/' + myId + '/profile', null, token);
  console.log('Status:', profileRes.status);
  console.log('Response:', JSON.stringify(profileRes.body, null, 2));

  console.log('\n--- 9. GET /api/rebate/templates/' + myId + ' ---');
  const tempGetRes = await request('GET', '/rebate/templates/' + myId, null, token);
  console.log('Status:', tempGetRes.status);
  console.log('Response:', JSON.stringify(tempGetRes.body, null, 2));

  console.log('\n--- 10. PUT /api/rebate/templates/' + myId + ' ---');
  const tempPutBody = {
    accountTypeTemplates: [
      {
        name: 'Standard Markup',
        rows: [
          { assetType: 'FOREX', rebatePips: 2, markupPips: 5, maxCeiling: '10', calcUnit: 'pip' },
          { assetType: 'GOLD', rebatePips: 4, markupPips: 10, maxCeiling: '20', calcUnit: 'pip' }
        ]
      }
    ],
    markupLinkTemplates: []
  };
  const tempPutRes = await request('PUT', '/rebate/templates/' + myId, tempPutBody, token);
  console.log('Status:', tempPutRes.status);
  console.log('Response:', JSON.stringify(tempPutRes.body, null, 2));

  console.log('\n--- Verify account_type_templates DB insert ---');
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const dbTemplates = await prisma.$queryRawUnsafe(`SELECT * FROM account_type_templates WHERE "ownerId" = '${myId}'`);
  console.log('DB Records:', dbTemplates.length);
  console.log(JSON.stringify(dbTemplates, null, 2));
  await prisma.$disconnect();

  console.log('\n--- 11. PATCH /api/ib/' + myId + '/profile ---');
  const patchRes = await request('PATCH', '/ib/' + myId + '/profile', { accountType: 'Markup 20%' }, token);
  console.log('Status:', patchRes.status);
  console.log('Response:', JSON.stringify(patchRes.body, null, 2));
}

run();
