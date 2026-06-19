import { PrismaClient, AssetType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing database...');
  await prisma.refreshToken.deleteMany({});
  await prisma.rebateTransaction.deleteMany({});
  await prisma.rebateConfig.deleteMany({});
  await prisma.ibNode.deleteMany({});

  console.log('Seeding test accounts...');
  const passwordHash = await bcrypt.hash('Test@1234', 10);

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

  const allIbs = [mib, lv1A, lv1B, lv2A, lv2B, lv2C, lv3A, lv3B];

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
  ];

  await prisma.rebateTransaction.createMany({ data: transactions });

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
