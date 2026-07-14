const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const API_URL = 'http://localhost:3001/api';

async function api(path, method = 'GET', body = null, token = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(`${API_URL}${path}`, options);
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
}

async function run() {
    try {
        const bcrypt = require('bcrypt');
        const mib = await prisma.ibNode.findFirst({ where: { level: 0, role: 'IB' } });
        if (!mib) {
            console.log('No MIB found');
            return;
        }

        // update password to 123456
        await prisma.ibNode.update({
            where: { id: mib.id },
            data: { password: await bcrypt.hash('123456', 10) }
        });

        // Login lấy token
        const loginRes = await api('/auth/login', 'POST', { email: mib.email, password: '123456' });
        if (loginRes.status !== 200 || !loginRes.data?.data?.accessToken) {
            console.log('Login failed:', loginRes);
            return;
        }
        const token = loginRes.data.data.accessToken;

        const targetIbId = mib.id;

        console.log('Fetching config for IB:', targetIbId);
        // Gọi API
        const res = await api(`/rebate/config/${targetIbId}`, 'GET', null, token);
        console.log('Status:', res.status);
        console.log('Data:', JSON.stringify(res.data, null, 2));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

run();
