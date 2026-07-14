import { PrismaClient, AssetType, PayoutStatus, NotificationType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function main() {
  console.log('Clearing database...');
  await prisma.refreshToken.deleteMany({});
  await prisma.payout.deleteMany({});
  await prisma.wallet.deleteMany({});
  await prisma.rebateTransaction.deleteMany({});
  await prisma.rebateConfigHistory.deleteMany({});
  await prisma.rebateConfig.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.accountTypeTemplate.deleteMany({});
  await prisma.markupLinkTemplate.deleteMany({});
  await prisma.ibNode.deleteMany({});

  console.log('Seeding test accounts...');
  const passwordHash = await bcrypt.hash('Test@1234', 10);

  // ⚠️ PRODUCTION: Tạo Root Admin thật riêng, KHÔNG dùng tài khoản test này khi deploy.
  const admin = await prisma.ibNode.create({
    data: {
      email: 'admin_test@azrebate.com',
      password: passwordHash,
      name: 'Root Admin Test',
      level: 0,
      role: 'ADMIN',
      isRootAdmin: true,
    },
  });

  // 1. MIB (Lv0)
  const mib = await prisma.ibNode.create({
    data: {
      email: 'mib@test.com',
      password: passwordHash,
      name: 'Tran Cong Toai',
      level: 0,
    },
  });

  // 2. Lv1 IBs (2 accounts)
  const lv1A = await prisma.ibNode.create({
    data: {
      email: 'lv1-a@test.com',
      password: passwordHash,
      name: 'Dong Ho Nguyen',
      level: 1,
      parentId: mib.id,
    },
  });

  const lv1B = await prisma.ibNode.create({
    data: {
      email: 'lv1-b@test.com',
      password: passwordHash,
      name: 'Ngoc Duy Nguyen',
      level: 1,
      parentId: mib.id,
    },
  });

  // 3. Lv2 IBs (3 accounts under lv1A)
  const lv2A = await prisma.ibNode.create({
    data: {
      email: 'lv2-a@test.com',
      password: passwordHash,
      name: 'Level 2 A',
      level: 2,
      parentId: lv1A.id,
    },
  });

  const lv2B = await prisma.ibNode.create({
    data: {
      email: 'lv2-b@test.com',
      password: passwordHash,
      name: 'Level 2 B',
      level: 2,
      parentId: lv1A.id,
    },
  });

  const lv2C = await prisma.ibNode.create({
    data: {
      email: 'lv2-c@test.com',
      password: passwordHash,
      name: 'Level 2 C',
      level: 2,
      parentId: lv1A.id,
    },
  });

  // 4. Lv3 IBs (2 accounts under lv2A)
  const lv3A = await prisma.ibNode.create({
    data: {
      email: 'lv3-a@test.com',
      password: passwordHash,
      name: 'Level 3 A',
      level: 3,
      parentId: lv2A.id,
    },
  });

  const lv3B = await prisma.ibNode.create({
    data: {
      email: 'lv3-b@test.com',
      password: passwordHash,
      name: 'Level 3 B',
      level: 3,
      parentId: lv2A.id,
    },
  });

  // 5. MIB thứ hai (nhánh thứ 2 — để ADMIN nhận mảng ≥2 root khi GET /ib/tree?depth=all)
  const mib2 = await prisma.ibNode.create({
    data: {
      email: 'mib2@test.com',
      password: passwordHash,
      name: 'MIB Branch Two',
      level: 0,
    },
  });

  const lv1C = await prisma.ibNode.create({
    data: {
      email: 'lv1-c@test.com',
      password: passwordHash,
      name: 'Level 1 C',
      level: 1,
      parentId: mib2.id,
    },
  });

  // lv2-c@test.com đã tồn tại dưới lv1-a — nhánh mib2 dùng lv2-c2@test.com
  const lv2C_mib2 = await prisma.ibNode.create({
    data: {
      email: 'lv2-c2@test.com',
      password: passwordHash,
      name: 'Level 2 C (MIB2)',
      level: 2,
      parentId: lv1C.id,
    },
  });

  const allIbs = [mib, lv1A, lv1B, lv2A, lv2B, lv2C, lv3A, lv3B, mib2, lv1C, lv2C_mib2];

  console.log('Seeding rebate configurations...');
  // Configure FOREX & GOLD configs for each IB
  const configs = [
    // MIB (Lv0) config
    { ibId: mib.id, assetType: AssetType.FOREX, rebateType: 'STP_REBATE' as any, rebatePips: 2, markupPips: 10, maxPips: 12 },
    { ibId: mib.id, assetType: AssetType.GOLD, rebateType: 'STP_REBATE' as any, rebatePips: 4, markupPips: 16, maxPips: 20 },
    { ibId: mib.id, assetType: AssetType.FOREX, rebateType: 'CENT_REBATE' as any, rebatePips: 0.05, markupPips: 0.1, maxPips: 0.15 },
    { ibId: mib.id, assetType: AssetType.COMMODITIES, rebateType: 'COMMISSION_PERCENT' as any, rebatePips: 50, markupPips: 50, maxPips: 100 },
    // Lv1 configs (maxPips = MIB's markupPips)
    { ibId: lv1A.id, assetType: AssetType.FOREX, rebatePips: 2, markupPips: 8, maxPips: 10 },
    { ibId: lv1A.id, assetType: AssetType.GOLD, rebatePips: 4, markupPips: 12, maxPips: 16 },
    { ibId: lv1B.id, assetType: AssetType.FOREX, rebatePips: 2, markupPips: 8, maxPips: 10 },
    { ibId: lv1B.id, assetType: AssetType.GOLD, rebatePips: 4, markupPips: 12, maxPips: 16 },
    // Lv2 configs (maxPips = Lv1's markupPips)
    { ibId: lv2A.id, assetType: AssetType.FOREX, rebatePips: 2, markupPips: 6, maxPips: 8 },
    { ibId: lv2A.id, assetType: AssetType.GOLD, rebatePips: 4, markupPips: 8, maxPips: 12 },
    { ibId: lv2B.id, assetType: AssetType.FOREX, rebatePips: 2, markupPips: 6, maxPips: 8 },
    { ibId: lv2B.id, assetType: AssetType.GOLD, rebatePips: 4, markupPips: 8, maxPips: 12 },
    { ibId: lv2C.id, assetType: AssetType.FOREX, rebatePips: 2, markupPips: 6, maxPips: 8 },
    { ibId: lv2C.id, assetType: AssetType.GOLD, rebatePips: 4, markupPips: 8, maxPips: 12 },
    // Lv3 configs (maxPips = Lv2's markupPips)
    { ibId: lv3A.id, assetType: AssetType.FOREX, rebatePips: 6, markupPips: 0, maxPips: 6 },
    { ibId: lv3A.id, assetType: AssetType.GOLD, rebatePips: 8, markupPips: 0, maxPips: 8 },
    { ibId: lv3B.id, assetType: AssetType.FOREX, rebatePips: 6, markupPips: 0, maxPips: 6 },
    { ibId: lv3B.id, assetType: AssetType.GOLD, rebatePips: 8, markupPips: 0, maxPips: 8 },
    // MIB2 branch
    { ibId: mib2.id, assetType: AssetType.FOREX, rebateType: 'STP_REBATE' as any, rebatePips: 2, markupPips: 10, maxPips: 12 },
    { ibId: mib2.id, assetType: AssetType.GOLD, rebateType: 'STP_REBATE' as any, rebatePips: 4, markupPips: 16, maxPips: 20 },
    { ibId: lv1C.id, assetType: AssetType.FOREX, rebatePips: 2, markupPips: 8, maxPips: 10 },
    { ibId: lv1C.id, assetType: AssetType.GOLD, rebatePips: 4, markupPips: 12, maxPips: 16 },
    { ibId: lv2C_mib2.id, assetType: AssetType.FOREX, rebatePips: 2, markupPips: 6, maxPips: 8 },
    { ibId: lv2C_mib2.id, assetType: AssetType.GOLD, rebatePips: 4, markupPips: 8, maxPips: 12 },
  ];

  for (const config of configs) {
    await prisma.rebateConfig.create({
      data: config,
    });
  }

  // Create default configs for other asset types to avoid issues when checking
  for (const ib of allIbs) {
    const defaultConfigsToCreate = Object.values(AssetType)
      .filter((assetType) => assetType !== AssetType.FOREX && assetType !== AssetType.GOLD)
      .map((assetType) => ({
        ibId: ib.id,
        assetType,
        rebatePips: 0,
        markupPips: 0,
        markupPercent: 100,
        maxPips: 0,
      }));

    await prisma.rebateConfig.createMany({
      data: defaultConfigsToCreate,
    });
  }

  console.log('Seeding rebate transactions (spread over 3 months)...');
  const now = new Date();
  const currentMonthDate = new Date(now.getFullYear(), now.getMonth(), 15);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  const twoMonthsAgoDate = new Date(now.getFullYear(), now.getMonth() - 2, 15);

  const transactions = [
    // Current Month Transactions
    { ibId: lv3A.id, assetType: AssetType.FOREX, lots: 10, rebateAmount: 60.0, tradedAt: currentMonthDate, createdById: mib.id },
    { ibId: lv3B.id, assetType: AssetType.GOLD, lots: 5, rebateAmount: 40.0, tradedAt: currentMonthDate, createdById: mib.id },
    { ibId: lv2B.id, assetType: AssetType.FOREX, lots: 20, rebateAmount: 40.0, tradedAt: currentMonthDate, createdById: mib.id },
    { ibId: lv1A.id, assetType: AssetType.GOLD, lots: 12.5, rebateAmount: 50.0, tradedAt: currentMonthDate, createdById: mib.id },

    // Last Month Transactions
    { ibId: lv3A.id, assetType: AssetType.GOLD, lots: 8, rebateAmount: 64.0, tradedAt: lastMonthDate, createdById: mib.id },
    { ibId: lv3B.id, assetType: AssetType.FOREX, lots: 15, rebateAmount: 90.0, tradedAt: lastMonthDate, createdById: mib.id },
    { ibId: lv2A.id, assetType: AssetType.FOREX, lots: 25, rebateAmount: 50.0, tradedAt: lastMonthDate, createdById: mib.id },
    { ibId: lv2C.id, assetType: AssetType.GOLD, lots: 6, rebateAmount: 24.0, tradedAt: lastMonthDate, createdById: mib.id },

    // 2 Months Ago Transactions
    { ibId: lv3B.id, assetType: AssetType.FOREX, lots: 12, rebateAmount: 72.0, tradedAt: twoMonthsAgoDate, createdById: mib.id },
    { ibId: lv3A.id, assetType: AssetType.GOLD, lots: 10, rebateAmount: 80.0, tradedAt: twoMonthsAgoDate, createdById: mib.id },
    { ibId: lv2A.id, assetType: AssetType.GOLD, lots: 15, rebateAmount: 60.0, tradedAt: twoMonthsAgoDate, createdById: mib.id },
    { ibId: lv1B.id, assetType: AssetType.FOREX, lots: 30, rebateAmount: 60.0, tradedAt: twoMonthsAgoDate, createdById: mib.id },
    // MIB2 branch transactions
    { ibId: lv2C_mib2.id, assetType: AssetType.FOREX, lots: 8, rebateAmount: 32.0, tradedAt: currentMonthDate, createdById: mib2.id },
    { ibId: lv1C.id, assetType: AssetType.GOLD, lots: 10, rebateAmount: 40.0, tradedAt: lastMonthDate, createdById: mib2.id },
  ];

  await prisma.rebateTransaction.createMany({ data: transactions });

  console.log('Seeding wallets (role=IB only)...');
  const walletProfiles: Record<string, { totalEarned: number; totalPaid: number }> = {
    'mib@test.com': { totalEarned: 8500, totalPaid: 3200 },
    'lv1-a@test.com': { totalEarned: 3400, totalPaid: 2149.5 },
    'lv1-b@test.com': { totalEarned: 2100, totalPaid: 800 },
    'lv2-a@test.com': { totalEarned: 1800, totalPaid: 600 },
    'lv2-b@test.com': { totalEarned: 950, totalPaid: 200 },
    'lv2-c@test.com': { totalEarned: 720, totalPaid: 150 },
    'lv3-a@test.com': { totalEarned: 2040, totalPaid: 500 },
    'lv3-b@test.com': { totalEarned: 2020, totalPaid: 480 },
    'mib2@test.com': { totalEarned: 5200, totalPaid: 1800 },
    'lv1-c@test.com': { totalEarned: 1600, totalPaid: 400 },
    'lv2-c2@test.com': { totalEarned: 880, totalPaid: 120 },
  };

  const ibNodes = await prisma.ibNode.findMany({ where: { role: 'IB' } });
  const walletByIbId = new Map<string, { id: string; ibId: string }>();

  for (const ib of ibNodes) {
    const profile = walletProfiles[ib.email] ?? { totalEarned: 500, totalPaid: 100 };
    const balance = profile.totalEarned - profile.totalPaid;
    const wallet = await prisma.wallet.create({
      data: {
        ibId: ib.id,
        balance,
        totalEarned: profile.totalEarned,
        totalPaid: profile.totalPaid,
        currency: 'USD',
      },
    });
    walletByIbId.set(ib.id, wallet);
  }

  console.log('Seeding payouts...');
  const wLv1A = walletByIbId.get(lv1A.id)!;
  const wLv1B = walletByIbId.get(lv1B.id)!;
  const wLv2A = walletByIbId.get(lv2A.id)!;
  const wLv2B = walletByIbId.get(lv2B.id)!;
  const wLv3A = walletByIbId.get(lv3A.id)!;
  const wLv3B = walletByIbId.get(lv3B.id)!;
  const wLv1C = walletByIbId.get(lv1C.id)!;
  const wMib2 = walletByIbId.get(mib2.id)!;

  await prisma.payout.createMany({
    data: [
      { ibId: lv1A.id, walletId: wLv1A.id, amount: 200, status: PayoutStatus.PENDING, paymentMethod: 'Bank Transfer', requestedAt: daysAgo(3), processedAt: null, processedBy: null },
      { ibId: lv1B.id, walletId: wLv1B.id, amount: 150, status: PayoutStatus.PENDING, paymentMethod: 'USDT-TRC20', requestedAt: daysAgo(5), processedAt: null, processedBy: null },
      { ibId: lv2A.id, walletId: wLv2A.id, amount: 300, status: PayoutStatus.APPROVED, paymentMethod: 'Bank Transfer', requestedAt: daysAgo(12), processedAt: daysAgo(10), processedBy: mib.id },
      { ibId: mib2.id, walletId: wMib2.id, amount: 500, status: PayoutStatus.APPROVED, paymentMethod: 'Bank Transfer', requestedAt: daysAgo(15), processedAt: daysAgo(14), processedBy: admin.id },
      { ibId: lv2B.id, walletId: wLv2B.id, amount: 100, status: PayoutStatus.REJECTED, paymentMethod: 'Bank Transfer', rejectedReason: 'Thiếu thông tin ngân hàng', requestedAt: daysAgo(20), processedAt: daysAgo(19), processedBy: mib.id },
      { ibId: lv3A.id, walletId: wLv3A.id, amount: 250, status: PayoutStatus.PAID, paymentMethod: 'Bank Transfer', requestedAt: daysAgo(30), processedAt: daysAgo(28), processedBy: lv1A.id },
      { ibId: lv3B.id, walletId: wLv3B.id, amount: 180, status: PayoutStatus.PAID, paymentMethod: 'USDT-TRC20', requestedAt: daysAgo(35), processedAt: daysAgo(33), processedBy: lv1A.id },
      { ibId: lv1C.id, walletId: wLv1C.id, amount: 220, status: PayoutStatus.PAID, paymentMethod: 'Bank Transfer', requestedAt: daysAgo(40), processedAt: daysAgo(38), processedBy: mib2.id },
    ],
  });

  console.log('Seeding notifications...');
  await prisma.notification.createMany({
    data: [
      { recipientId: lv1A.id, senderId: mib.id, type: NotificationType.IB_JOINED, title: 'Chào mừng IB mới', body: 'Bạn đã được thêm vào hệ thống dưới MIB.', isRead: true, readAt: daysAgo(60) },
      { recipientId: lv1C.id, senderId: mib2.id, type: NotificationType.IB_JOINED, title: 'Chào mừng IB mới', body: 'Bạn đã được thêm vào nhánh MIB2.', isRead: false },
      { recipientId: lv3A.id, senderId: mib.id, type: NotificationType.TRANSACTION_ADDED, title: 'Giao dịch mới', body: 'Có giao dịch FOREX 10 lots được ghi nhận.', isRead: false },
      { recipientId: lv2A.id, senderId: lv1A.id, type: NotificationType.TRANSACTION_ADDED, title: 'Giao dịch mới', body: 'Giao dịch rebate đã được thêm.', isRead: true, readAt: daysAgo(2) },
      { recipientId: lv1B.id, senderId: mib.id, type: NotificationType.TRANSACTION_ADDED, title: 'Giao dịch mới', body: 'Transaction FOREX 30 lots.', isRead: false },
      { recipientId: lv1A.id, senderId: mib.id, type: NotificationType.REBATE_UPDATED, title: 'Cấu hình rebate thay đổi', body: 'FOREX rebatePips đã được cập nhật.', isRead: true, readAt: daysAgo(7) },
      { recipientId: lv2C_mib2.id, senderId: lv1C.id, type: NotificationType.REBATE_UPDATED, title: 'Rebate cập nhật', body: 'GOLD config đã thay đổi.', isRead: false },
      { recipientId: lv3B.id, senderId: lv2A.id, type: NotificationType.REBATE_UPDATED, title: 'Rebate cập nhật', body: 'Markup percent đã điều chỉnh.', isRead: true, readAt: daysAgo(1) },
      { recipientId: mib.id, senderId: admin.id, type: NotificationType.MANUAL, title: 'Thông báo bảo trì hệ thống', body: 'Hệ thống sẽ bảo trì vào Chủ nhật 02:00–04:00.', isRead: false },
      { recipientId: lv1A.id, senderId: admin.id, type: NotificationType.MANUAL, title: 'Cập nhật chính sách', body: 'Vui lòng xem lại quy định payout mới.', isRead: true, readAt: daysAgo(3) },
      { recipientId: lv2B.id, senderId: null, type: NotificationType.SYSTEM, title: 'Nhắc nhở đăng nhập', body: 'Bạn chưa đăng nhập trong 30 ngày.', isRead: false },
      { recipientId: mib2.id, senderId: null, type: NotificationType.SYSTEM, title: 'Sao lưu dữ liệu', body: 'Backup hàng tuần đã hoàn tất.', isRead: true, readAt: daysAgo(5) },
    ],
  });

  console.log('Seeding audit logs...');
  await prisma.auditLog.createMany({
    data: [
      { actorId: mib.id, action: 'IB_CREATE', targetType: 'IB', targetId: lv1A.id, after: { email: lv1A.email, level: 1 } },
      { actorId: mib.id, action: 'IB_CREATE', targetType: 'IB', targetId: lv2A.id, after: { email: lv2A.email, level: 2 } },
      { actorId: lv1A.id, action: 'IB_CREATE', targetType: 'IB', targetId: lv3A.id, after: { email: lv3A.email, level: 3 } },
      { actorId: mib2.id, action: 'IB_CREATE', targetType: 'IB', targetId: lv1C.id, after: { email: lv1C.email, level: 1 } },
      { actorId: lv1C.id, action: 'IB_CREATE', targetType: 'IB', targetId: lv2C_mib2.id, after: { email: lv2C_mib2.email, level: 2 } },
      { actorId: mib.id, action: 'REBATE_CONFIG_UPDATE', targetType: 'REBATE_CONFIG', targetId: lv1A.id, before: { rebatePips: 1, markupPips: 9 }, after: { rebatePips: 2, markupPips: 8 } },
      { actorId: mib2.id, action: 'REBATE_CONFIG_UPDATE', targetType: 'REBATE_CONFIG', targetId: lv1C.id, before: { rebatePips: 1, markupPips: 9 }, after: { rebatePips: 2, markupPips: 8 } },
      { actorId: mib.id, action: 'TRANSACTION_CREATE', targetType: 'TRANSACTION', targetId: lv3A.id, after: { assetType: 'FOREX', lots: 10, rebateAmount: 60 } },
      { actorId: mib.id, action: 'TRANSACTION_CREATE', targetType: 'TRANSACTION', targetId: lv1A.id, after: { assetType: 'GOLD', lots: 12.5, rebateAmount: 50 } },
      { actorId: mib2.id, action: 'TRANSACTION_CREATE', targetType: 'TRANSACTION', targetId: lv2C_mib2.id, after: { assetType: 'FOREX', lots: 8, rebateAmount: 32 } },
    ],
  });

  console.log('Seeding rebate config history...');
  const allRebateConfigs = await prisma.rebateConfig.findMany();
  const parentMap = new Map(allIbs.map((ib) => [ib.id, ib.parentId]));

  for (const cfg of allRebateConfigs) {
    const parentId = parentMap.get(cfg.ibId);
    const changedById = parentId ?? cfg.ibId;
    const beforeRebate = Math.max(0, Number(cfg.rebatePips) - 1);
    const beforeMarkup = Math.min(Number(cfg.maxPips), Number(cfg.markupPips) + 1);
    await prisma.rebateConfigHistory.create({
      data: {
        rebateConfigId: cfg.id,
        changedById,
        before: { rebatePips: beforeRebate, markupPips: beforeMarkup, markupPercent: 100 },
        after: { rebatePips: Number(cfg.rebatePips), markupPips: Number(cfg.markupPips), markupPercent: Number(cfg.markupPercent) },
      },
    });
  }

  console.log('Seeding account type & markup link templates...');
  for (const mibOwner of [mib, mib2]) {
    await prisma.accountTypeTemplate.create({
      data: {
        ownerId: mibOwner.id,
        name: 'SEA STD',
        rows: [
          { assetType: 'FOREX', maxCeiling: '8', calcUnit: 'pips' },
          { assetType: 'GOLD', maxCeiling: '18', calcUnit: 'pips' },
        ],
      },
    });
    await prisma.markupLinkTemplate.create({
      data: { ownerId: mibOwner.id, name: 'SEA STD', share: 8 },
    });
  }

  console.log('✅ Seed dữ liệu thành công!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
