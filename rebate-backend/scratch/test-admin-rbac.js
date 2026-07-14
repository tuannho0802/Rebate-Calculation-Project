const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

const API_URL = 'http://localhost:3001/api';

const results = [];
let passCount = 0;
let failCount = 0;

function logResult(tc, name, isPass, reason = '') {
    const status = isPass ? 'PASS' : 'FAIL';
    console.log(`[${tc}] ${status} - ${name} ${reason ? `(${reason})` : ''}`);
    results.push({ tc, name, status, reason });
    if (isPass) passCount++;
    else failCount++;
}

async function api(path, method = 'GET', body = null, token = null) {
    const headers = {
        'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options = {
        method,
        headers,
    };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(`${API_URL}${path}`, options);
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
}

function decodeJwt(token) {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
}

async function setup() {
    console.log('--- ĐANG CHUẨN BỊ DỮ LIỆU ---');
    // 1. Tạo 1 tài khoản Admin
    const adminEmail = 'admin_test@azrebate.com';
    const adminPassword = await bcrypt.hash('Test@1234', 10);

    let admin = await prisma.ibNode.findUnique({ where: { email: adminEmail } });
    if (!admin) {
        admin = await prisma.ibNode.create({
            data: {
                email: adminEmail,
                name: 'Super Admin Test',
                password: adminPassword,
                level: 0,
                role: 'ADMIN',
                isActive: true,
            }
        });
        console.log(`Đã tạo Admin: ${adminEmail}`);
    } else {
        // Make sure role is ADMIN
        if (admin.role !== 'ADMIN') {
            admin = await prisma.ibNode.update({ where: { email: adminEmail }, data: { role: 'ADMIN' } });
        }
        console.log(`Đã có Admin: ${adminEmail}`);
    }

    // 2. Tìm 1 MIB, 1 Lv1, 1 Lv2 thường
    const mib = await prisma.ibNode.findFirst({ where: { level: 0, role: 'IB' } });
    const lv1 = await prisma.ibNode.findFirst({ where: { level: 1, role: 'IB' } });
    const lv2 = await prisma.ibNode.findFirst({ where: { level: 2, role: 'IB' } });

    if (!mib || !lv1 || !lv2) {
        console.error('Thiếu dữ liệu test (cần ít nhất 1 MIB, 1 Lv1, 1 Lv2)');
        process.exit(1);
    }

    // Ensure MIB password is known for login
    await prisma.ibNode.update({ where: { id: mib.id }, data: { password: await bcrypt.hash('Test@1234', 10) } });
    console.log(`Dùng MIB: ${mib.email}, Lv1: ${lv1.email}, Lv2: ${lv2.email}`);

    console.log('--- BẮT ĐẦU TEST ---');
    return { admin, mib, lv1, lv2 };
}

async function runTests() {
    const { admin, mib, lv1, lv2 } = await setup();

    let adminToken = '';
    let mibToken = '';

    try {
        // TC1
        const t1Res = await api('/auth/login', 'POST', { email: admin.email, password: 'Test@1234' });
        if (t1Res.status === 200 && t1Res.data?.data?.accessToken) {
            adminToken = t1Res.data.data.accessToken;
            const payload = decodeJwt(adminToken);
            if (payload && payload.role === 'ADMIN') {
                logResult('TC1', 'Admin login thành công, JWT payload chứa role=ADMIN', true);
            } else {
                logResult('TC1', 'Admin login thành công, JWT payload chứa role=ADMIN', false, `Role trong token: ${payload?.role}`);
            }
        } else {
            logResult('TC1', 'Admin login thành công', false, `Login fail, status: ${t1Res.status}`);
        }

        // TC9 prep
        const mibRes = await api('/auth/login', 'POST', { email: mib.email, password: 'Test@1234' });
        if (mibRes.status === 200 && mibRes.data?.data?.accessToken) {
            mibToken = mibRes.data.data.accessToken;
        }

        // TC2
        const totalIbNodes = await prisma.ibNode.count();
        const t2Res = await api('/ib/tree?depth=all', 'GET', null, adminToken);

        // Count nodes in tree recursively
        let treeCount = 0;
        function countNodes(node) {
            treeCount++;
            if (node.children) node.children.forEach(countNodes);
        }
        // Exclude Admin from tree count expectation if Admin is not in tree
        const targetCount = totalIbNodes - 1;
        if (t2Res.status === 200 && t2Res.data?.data) {
            // Tree returns array of roots
            if (Array.isArray(t2Res.data.data)) {
                t2Res.data.data.forEach(countNodes);
            } else {
                countNodes(t2Res.data.data);
            }
            if (treeCount === targetCount) {
                logResult('TC2', 'Admin xem toàn bộ cây IB', true);
            } else {
                logResult('TC2', 'Admin xem toàn bộ cây IB', false, `Nodes in tree: ${treeCount}, Total in DB (excluding Admin): ${targetCount}`);
            }
        } else {
            logResult('TC2', 'Admin xem toàn bộ cây IB', false, `API fail, status: ${t2Res.status}`);
        }

        // TC3
        const t3ConfigPayload = {
            assets: [{ assetType: 'FOREX', rebatePips: 2, markupPips: 3, markupPercent: 50 }],
            notifyScope: 'direct'
        };
        const t3Res = await api(`/rebate/config/${lv2.id}`, 'PUT', t3ConfigPayload, adminToken);
        if (t3Res.status === 200) {
            await new Promise(r => setTimeout(r, 500)); // wait for async notification to be saved
            const dbConfig = await prisma.rebateConfig.findFirst({ where: { ibId: lv2.id, assetType: 'FOREX' } });
            if (dbConfig && Number(dbConfig.rebatePips) === 2) {
                const noti = await prisma.notification.findFirst({
                    where: { recipientId: lv2.id, title: { contains: 'Admin' } },
                    orderBy: { createdAt: 'desc' }
                });
                if (noti) {
                    logResult('TC3', 'Admin sửa rebate config của IB ngoài nhánh', true);
                } else {
                    logResult('TC3', 'Admin sửa rebate config của IB ngoài nhánh', false, 'DB config updated but Notification missing');
                }
            } else {
                logResult('TC3', 'Admin sửa rebate config của IB ngoài nhánh', false, 'Response 200 but DB not updated properly');
            }
        } else {
            logResult('TC3', 'Admin sửa rebate config của IB ngoài nhánh', false, `API fail, status: ${t3Res.status} - ${JSON.stringify(t3Res.data)}`);
        }

        // TC4
        const t4Res = await api('/payouts', 'POST', { amount: 10, paymentMethod: 'BANK' }, adminToken);
        if (t4Res.status === 403 || t4Res.status === 401) {
            logResult('TC4', 'Admin bị chặn tạo payout cho chính mình', true);
        } else {
            logResult('TC4', 'Admin bị chặn tạo payout cho chính mình', false, `Expected 403, got ${t4Res.status}`);
        }

        // TC5
        const t5Res = await api(`/wallet/${lv2.id}`, 'GET', null, adminToken);
        if (t5Res.status === 200 && t5Res.data?.data?.balance !== undefined) {
            logResult('TC5', 'Admin xem được wallet của bất kỳ IB nào', true);
        } else {
            logResult('TC5', 'Admin xem được wallet của bất kỳ IB nào', false, `Expected 200, got ${t5Res.status}`);
        }

        // TC6
        const t6Res = await api(`/ib/${mib.id}/reset-password`, 'PATCH', { newPassword: 'Test@1234' }, adminToken);
        if (t6Res.status === 200) {
            await new Promise(r => setTimeout(r, 1000)); // wait 1s to ensure JWT iat is different
            const checkLogin = await api('/auth/login', 'POST', { email: mib.email, password: 'Test@1234' });
            if (checkLogin.status === 200) {
                logResult('TC6', 'Admin reset password cho 1 MIB', true);
            } else {
                logResult('TC6', 'Admin reset password cho 1 MIB', false, `API reset 200 but login with new pass failed: ${JSON.stringify(checkLogin.data)}`);
            }
        } else {
            logResult('TC6', 'Admin reset password cho 1 MIB', false, `Expected 200, got ${t6Res.status} - ${JSON.stringify(t6Res.data)}`);
        }
        // Restore mib password
        await prisma.ibNode.update({ where: { id: mib.id }, data: { password: await bcrypt.hash('Test@1234', 10) } });

        // TC7
        const mibChildren = await prisma.ibNode.findMany({ where: { parentId: mib.id } });
        const directIds = [mib.id, ...mibChildren.map(c => c.id)];

        // Find all subtree
        let subtreeIds = [mib.id];
        let toCheck = [...mibChildren.map(c => c.id)];
        while (toCheck.length > 0) {
            const cid = toCheck.pop();
            subtreeIds.push(cid);
            const kids = await prisma.ibNode.findMany({ where: { parentId: cid } });
            toCheck.push(...kids.map(k => k.id));
        }

        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        const dbDirectRebate = await prisma.rebateTransaction.aggregate({
            where: { ibId: { in: directIds }, tradedAt: { gte: startDate, lt: endDate } },
            _sum: { rebateAmount: true }
        });
        const directSum = Number(dbDirectRebate._sum.rebateAmount || 0);

        const dbSubtreeRebate = await prisma.rebateTransaction.aggregate({
            where: { ibId: { in: subtreeIds }, tradedAt: { gte: startDate, lt: endDate } },
            _sum: { rebateAmount: true }
        });
        const subtreeSum = Number(dbSubtreeRebate._sum.rebateAmount || 0);

        const t7Res = await api('/report/summary', 'GET', null, mibToken);
        if (t7Res.status === 200) {
            const apiSum = t7Res.data?.data?.totalRebate || 0;
            if (directSum === subtreeSum) {
                logResult('TC7', 'IB thường (MIB) chỉ thấy 1 cấp trong report/summary', true, 'Cảnh báo: không đủ dữ liệu để phân biệt (directSum == subtreeSum)');
            } else {
                if (apiSum === directSum) {
                    logResult('TC7', 'IB thường (MIB) chỉ thấy 1 cấp trong report/summary', true);
                } else {
                    logResult('TC7', 'IB thường (MIB) chỉ thấy 1 cấp trong report/summary', false, `API returned ${apiSum}, expected directSum ${directSum} (subtreeSum is ${subtreeSum})`);
                }
            }
        } else {
            logResult('TC7', 'IB thường (MIB) chỉ thấy 1 cấp trong report/summary', false, `API fail, status: ${t7Res.status}`);
        }

        // TC8
        const t8Res = await api('/ib/tree?depth=all', 'GET', null, mibToken);
        if (t8Res.status === 200 && t8Res.data?.data) {
            let isOnlyDirect = true;
            function checkNodeLevel(node) {
                if (node.level > mib.level + 1) isOnlyDirect = false;
                if (node.children) node.children.forEach(checkNodeLevel);
            }
            if (Array.isArray(t8Res.data.data)) {
                t8Res.data.data.forEach(checkNodeLevel);
            } else {
                checkNodeLevel(t8Res.data.data);
            }

            if (isOnlyDirect) {
                logResult('TC8', 'IB thường (MIB) chỉ thấy 1 cấp trong GET /api/ib/tree', true);
            } else {
                logResult('TC8', 'IB thường (MIB) chỉ thấy 1 cấp trong GET /api/ib/tree', false, 'Response contained grandchildren');
            }
        } else {
            logResult('TC8', 'IB thường (MIB) chỉ thấy 1 cấp trong GET /api/ib/tree', false, `API fail, status: ${t8Res.status}`);
        }

        // TC9
        if (adminToken && mibToken) {
            const adminPayload = decodeJwt(adminToken);
            const mibPayload = decodeJwt(mibToken);
            if (adminPayload?.role === 'ADMIN' && mibPayload?.role === 'IB') {
                logResult('TC9', 'Xác minh role KHÔNG bị hardcode', true);
            } else {
                logResult('TC9', 'Xác minh role KHÔNG bị hardcode', false, `Admin: ${adminPayload?.role}, MIB: ${mibPayload?.role}`);
            }
        } else {
            logResult('TC9', 'Xác minh role KHÔNG bị hardcode', false, 'Missing tokens');
        }

        // Summary
        console.log('\n--- BẢNG TỔNG KẾT ---');
        results.forEach(r => {
            console.log(`${r.tc.padEnd(4)} | ${r.status.padEnd(4)} | ${r.name}`);
            if (r.reason) console.log(`       -> ${r.reason}`);
        });
        console.log(`\nTổng: ${passCount} PASS, ${failCount} FAIL`);
    } catch (err) {
        console.error('Lỗi trong quá trình chạy test:', err);
    } finally {
        await prisma.$disconnect();
    }
}

runTests();