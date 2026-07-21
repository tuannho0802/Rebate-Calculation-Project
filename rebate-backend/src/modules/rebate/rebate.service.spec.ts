import { Test, TestingModule } from '@nestjs/testing';
import { RebateService } from './rebate.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';
import { AssetType } from '@prisma/client';
import { UnprocessableEntityException } from '@nestjs/common';

function makePrismaMock() {
  const store = new Map<string, any>();

  return {
    _store: store,
    ibNode: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    rebateConfig: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const key = `${where.ibId_assetType_rebateType.ibId}:${where.ibId_assetType_rebateType.assetType}:${where.ibId_assetType_rebateType.rebateType}`;
        return Promise.resolve(store.get(key) || null);
      }),
      findMany: jest.fn().mockImplementation(({ where }) => {
        const res: any[] = [];
        for (const [k, v] of store.entries()) {
          if (k.startsWith(where.ibId)) res.push(v);
        }
        return Promise.resolve(res);
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      upsert: jest.fn().mockImplementation(({ where, update, create }) => {
        const key = `${where.ibId_assetType_rebateType.ibId}:${where.ibId_assetType_rebateType.assetType}:${where.ibId_assetType_rebateType.rebateType}`;
        const existing = store.get(key);
        const data = existing ? { ...existing, ...update } : create;
        store.set(key, data);
        return Promise.resolve(data);
      }),
    },
    rebateConfigHistory: {
      create: jest.fn().mockResolvedValue({}),
    },
    markupLinkTemplate: {
      findFirst: jest.fn().mockResolvedValue({ share: 10 }),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn().mockImplementation((fn: any) => {
      const tx = {
        rebateConfig: {
          findUnique: jest.fn().mockImplementation(({ where }) => {
            const key = `${where.ibId_assetType_rebateType.ibId}:${where.ibId_assetType_rebateType.assetType}:${where.ibId_assetType_rebateType.rebateType}`;
            return Promise.resolve(store.get(key) || null);
          }),
          upsert: jest.fn().mockImplementation(({ where, update, create }) => {
            const key = `${where.ibId_assetType_rebateType.ibId}:${where.ibId_assetType_rebateType.assetType}:${where.ibId_assetType_rebateType.rebateType}`;
            const existing = store.get(key);
            const data = existing ? { ...existing, ...update } : create;
            store.set(key, data);
            return Promise.resolve(data);
          }),
        },
        rebateConfigHistory: { create: jest.fn().mockResolvedValue({}) },
        markupLinkTemplate: { findFirst: jest.fn().mockResolvedValue({ share: 10 }) },
      };
      return fn(tx);
    }),
  };
}

function makeAuditMock() {
  return { log: jest.fn().mockResolvedValue({}) };
}

function makeNotificationMock() {
  return {
    notifyConfigChangedByAdmin: jest.fn(),
    createSystemNotification: jest.fn(),
  };
}

describe('RebateService — Cascading Rebate Max', () => {
  let service: RebateService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RebateService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: makeAuditMock() },
        { provide: NotificationService, useValue: makeNotificationMock() },
      ],
    }).compile();

    service = module.get<RebateService>(RebateService);
  });

  it('MIB (Level 0) configures Sub-IB Level 1: Level 1 gets maxPips = rebatePips', async () => {
    const MIB_ID = 'mib-1';
    const LV1_ID = 'lv1-1';

    // MIB config: Sàn Max = 20 pips
    prisma._store.set(`${MIB_ID}:${AssetType.GOLD}:STP_REBATE`, {
      ibId: MIB_ID,
      assetType: AssetType.GOLD,
      rebateType: 'STP_REBATE',
      rebatePips: 0,
      markupPips: 0,
      maxPips: 20,
      ib: { level: 0 },
    });

    prisma.ibNode.findUnique.mockImplementation(({ where }) => {
      if (where.id === LV1_ID) return Promise.resolve({ parentId: MIB_ID, level: 1 });
      if (where.id === MIB_ID) return Promise.resolve({ parentId: null, level: 0 });
      return Promise.resolve(null);
    });

    // MIB configures Level 1 with 15 pips
    await service.updateConfig(
      MIB_ID,
      0,
      LV1_ID,
      { assets: [{ assetType: AssetType.GOLD, rebateType: 'STP_REBATE', rebatePips: 15, markupPips: 0, markupPercent: 100 }] },
      'MIB',
    );

    const lv1Config = prisma._store.get(`${LV1_ID}:${AssetType.GOLD}:STP_REBATE`);
    expect(lv1Config).toBeDefined();
    expect(lv1Config.rebatePips).toBe(15);
    expect(lv1Config.maxPips).toBe(15); // Level 1's maxPips equals what it received (15)
  });

  it('Level 1 cannot give Level 2 more than Level 1 received', async () => {
    const LV1_ID = 'lv1-1';
    const LV2_ID = 'lv2-1';

    // Level 1 received 15 pips from MIB
    prisma._store.set(`${LV1_ID}:${AssetType.GOLD}:STP_REBATE`, {
      ibId: LV1_ID,
      assetType: AssetType.GOLD,
      rebateType: 'STP_REBATE',
      rebatePips: 15,
      markupPips: 0,
      maxPips: 15,
      ib: { level: 1 },
    });

    prisma.ibNode.findUnique.mockImplementation(({ where }) => {
      if (where.id === LV2_ID) return Promise.resolve({ parentId: LV1_ID, level: 2 });
      if (where.id === LV1_ID) return Promise.resolve({ parentId: 'mib-1', level: 1 });
      return Promise.resolve(null);
    });

    // Level 1 tries to give Level 2 18 pips (> 15) -> Should throw UnprocessableEntityException
    await expect(
      service.updateConfig(
        LV1_ID,
        1,
        LV2_ID,
        { assets: [{ assetType: AssetType.GOLD, rebateType: 'STP_REBATE', rebatePips: 18, markupPips: 0, markupPercent: 100 }] },
        'IB',
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('Level 1 configures Level 2 with valid rebate: Level 2 gets maxPips = rebatePips', async () => {
    const LV1_ID = 'lv1-1';
    const LV2_ID = 'lv2-1';

    prisma._store.set(`${LV1_ID}:${AssetType.GOLD}:STP_REBATE`, {
      ibId: LV1_ID,
      assetType: AssetType.GOLD,
      rebateType: 'STP_REBATE',
      rebatePips: 15,
      markupPips: 0,
      maxPips: 15,
      ib: { level: 1 },
    });

    prisma.ibNode.findUnique.mockImplementation(({ where }) => {
      if (where.id === LV2_ID) return Promise.resolve({ parentId: LV1_ID, level: 2 });
      if (where.id === LV1_ID) return Promise.resolve({ parentId: 'mib-1', level: 1 });
      return Promise.resolve(null);
    });

    // Level 1 gives Level 2 10 pips (<= 15) -> Success!
    await service.updateConfig(
      LV1_ID,
      1,
      LV2_ID,
      { assets: [{ assetType: AssetType.GOLD, rebateType: 'STP_REBATE', rebatePips: 10, markupPips: 0, markupPercent: 100 }] },
      'IB',
    );

    const lv2Config = prisma._store.get(`${LV2_ID}:${AssetType.GOLD}:STP_REBATE`);
    expect(lv2Config).toBeDefined();
    expect(lv2Config.rebatePips).toBe(10);
    expect(lv2Config.maxPips).toBe(10); // Level 2's maxPips equals what it received (10)
  });
});
