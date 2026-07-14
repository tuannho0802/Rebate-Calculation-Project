/**
 * Unit tests for RebateService — cascadeMaxPipsToSubtree() & setMibMaxOverride()
 *
 * Công thức kiểm tra (bản mới):
 *   maxPips(con) = Math.max(0, maxPips(cha) - rebatePips(cha))
 *
 * Strategy: mock PrismaService hoàn toàn, không cần DB thật.
 * AuditService và NotificationService cũng được mock.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { RebateService } from './rebate.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';
import { AssetType } from '@prisma/client';

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal rebateConfig row */
function cfg(ibId: string, maxPips: number, rebatePips: number, markupPips = 0) {
  return { ibId, maxPips, rebatePips, markupPips, markupPercent: 100, assetType: AssetType.D_FOREX, rebateType: 'STP_REBATE' };
}

/** Build a subtree node (result of the CTE raw query) */
function node(id: string, parentId: string, level: number) {
  return { id, parentId, level };
}

// ─── mock factories ───────────────────────────────────────────────────────────

function makePrismaMock() {
  return {
    ibNode: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    rebateConfig: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve(create)),
    },
    rebateConfigHistory: {
      create: jest.fn().mockResolvedValue({}),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn().mockImplementation((fn: any) => fn({
      rebateConfig: {
        findUnique: jest.fn(),
        upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve(create)),
      },
      rebateConfigHistory: { create: jest.fn().mockResolvedValue({}) },
    })),
  };
}

function makeAuditMock() {
  return { log: jest.fn().mockResolvedValue({}) };
}

function makeNotificationMock() {
  return { notifyConfigChangedByAdmin: jest.fn() };
}

// ─── test suite ───────────────────────────────────────────────────────────────

describe('RebateService — cascadeMaxPipsToSubtree (công thức mới)', () => {
  let service: RebateService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let audit: ReturnType<typeof makeAuditMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    audit = makeAuditMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RebateService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: NotificationService, useValue: makeNotificationMock() },
      ],
    }).compile();

    service = module.get<RebateService>(RebateService);
  });

  // helper: trigger cascade via public setMibMaxOverride so we don't call private method directly
  // We intercept upsert calls to verify what maxPips was written per node.

  // ─── (a) MIB maxPips=12 rebatePips=0 → child maxPips=12 ────────────────────
  it('(a) MIB maxPips=12, rebatePips=0 → con trực tiếp maxPips=12', async () => {
    const MIB_ID = 'mib-1';
    const CHILD_ID = 'child-1';
    const ASSET = AssetType.D_FOREX;
    const REBATE_TYPE = 'STP_REBATE';

    // setMibMaxOverride: validate MIB level=0
    prisma.ibNode.findUnique.mockResolvedValue({ level: 0 });

    // History create: find before config
    prisma.rebateConfig.findUnique.mockImplementation(({ where }) => {
      const ibId = where.ibId_assetType_rebateType?.ibId;
      if (ibId === MIB_ID) return Promise.resolve(cfg(MIB_ID, 12, 0)); // MIB: maxPips=12, rebatePips=0
      if (ibId === CHILD_ID) return Promise.resolve(cfg(CHILD_ID, 0, 0)); // child old config
      return Promise.resolve(null);
    });

    // CTE subtree: 1 direct child
    prisma.$queryRaw.mockResolvedValue([node(CHILD_ID, MIB_ID, 1)]);

    const upsertCalls: any[] = [];
    prisma.rebateConfig.upsert.mockImplementation((args) => {
      upsertCalls.push(args);
      return Promise.resolve(args.create ?? args.update);
    });

    await (service as any).cascadeMaxPipsToSubtree(MIB_ID, ASSET, REBATE_TYPE, 'admin-id');

    // Child should receive maxPips = 12 - 0 = 12
    const childUpsert = upsertCalls.find(c => c.where.ibId_assetType_rebateType?.ibId === CHILD_ID);
    expect(childUpsert).toBeDefined();
    expect(childUpsert.update.maxPips).toBe(12);
  });

  // ─── (b) Cha maxPips=12 rebatePips=3 → con maxPips=9 ──────────────────────
  it('(b) Cha maxPips=12, rebatePips=3 → con maxPips=9', async () => {
    const PARENT_ID = 'parent-1';
    const CHILD_ID = 'child-1';
    const ASSET = AssetType.D_FOREX;
    const REBATE_TYPE = 'STP_REBATE';

    prisma.rebateConfig.findUnique.mockImplementation(({ where }) => {
      const ibId = where.ibId_assetType_rebateType?.ibId;
      if (ibId === PARENT_ID) return Promise.resolve(cfg(PARENT_ID, 12, 3)); // maxPips=12, rebatePips=3
      if (ibId === CHILD_ID) return Promise.resolve(cfg(CHILD_ID, 0, 0));
      return Promise.resolve(null);
    });

    prisma.$queryRaw.mockResolvedValue([node(CHILD_ID, PARENT_ID, 1)]);

    const upsertCalls: any[] = [];
    prisma.rebateConfig.upsert.mockImplementation((args) => {
      upsertCalls.push(args);
      return Promise.resolve(args.create ?? args.update);
    });

    await (service as any).cascadeMaxPipsToSubtree(PARENT_ID, ASSET, REBATE_TYPE, 'admin-id');

    const childUpsert = upsertCalls.find(c => c.where.ibId_assetType_rebateType?.ibId === CHILD_ID);
    expect(childUpsert).toBeDefined();
    expect(childUpsert.update.maxPips).toBe(9); // 12 - 3 = 9
  });

  // ─── (c) Cháu 2 tầng: Lv1 maxPips=9 rebatePips=2 → Lv2 maxPips=7 ─────────
  it('(c) Lv1 maxPips=9, rebatePips=2 → Lv2 maxPips=7', async () => {
    const ROOT_ID = 'root-1';
    const LV1_ID = 'lv1-1';
    const LV2_ID = 'lv2-1';
    const ASSET = AssetType.D_FOREX;
    const REBATE_TYPE = 'STP_REBATE';

    // After root cascade, Lv1 is upserted with maxPips=9.
    // We simulate: $queryRaw returns both Lv1 and Lv2 (level ASC order).
    // findUnique must return updated values as cascade proceeds top-down.
    const configDB: Record<string, { maxPips: number; rebatePips: number }> = {
      [ROOT_ID]: { maxPips: 12, rebatePips: 3 },  // root: 12-3=9 for Lv1
      [LV1_ID]: { maxPips: 0, rebatePips: 2 },    // Lv1 initial (will be updated to maxPips=9)
      [LV2_ID]: { maxPips: 0, rebatePips: 0 },
    };

    prisma.$queryRaw.mockResolvedValue([
      node(LV1_ID, ROOT_ID, 1),
      node(LV2_ID, LV1_ID, 2),
    ]);

    const upsertCalls: any[] = [];
    prisma.rebateConfig.upsert.mockImplementation((args) => {
      upsertCalls.push(args);
      // Simulate DB write so subsequent findUnique reads the updated maxPips
      const ibId = args.where.ibId_assetType_rebateType?.ibId;
      if (ibId && args.update?.maxPips !== undefined) {
        configDB[ibId] = { ...configDB[ibId], maxPips: args.update.maxPips };
      }
      return Promise.resolve({ ibId, ...args.update });
    });

    // findUnique reads from configDB (which upsert above keeps up-to-date)
    prisma.rebateConfig.findUnique.mockImplementation(({ where }) => {
      const ibId = where.ibId_assetType_rebateType?.ibId;
      const data = configDB[ibId];
      if (!data) return Promise.resolve(null);
      return Promise.resolve(cfg(ibId, data.maxPips, data.rebatePips));
    });

    await (service as any).cascadeMaxPipsToSubtree(ROOT_ID, ASSET, REBATE_TYPE, 'admin-id');

    const lv1Upsert = upsertCalls.find(c => c.where.ibId_assetType_rebateType?.ibId === LV1_ID);
    const lv2Upsert = upsertCalls.find(c => c.where.ibId_assetType_rebateType?.ibId === LV2_ID);

    expect(lv1Upsert?.update.maxPips).toBe(9);  // 12 - 3 = 9
    expect(lv2Upsert?.update.maxPips).toBe(7);  // 9 - 2 = 7
  });

  // ─── (d) rebatePips(cha) > maxPips(cha) → con nhận maxPips=0, không throw ──
  it('(d) rebatePips(cha) > maxPips(cha) → con nhận maxPips=0, không throw lỗi', async () => {
    const PARENT_ID = 'parent-bad';
    const CHILD_ID = 'child-1';
    const ASSET = AssetType.D_FOREX;
    const REBATE_TYPE = 'STP_REBATE';

    // Bad legacy data: rebatePips=5 > maxPips=3
    prisma.rebateConfig.findUnique.mockImplementation(({ where }) => {
      const ibId = where.ibId_assetType_rebateType?.ibId;
      if (ibId === PARENT_ID) return Promise.resolve(cfg(PARENT_ID, 3, 5)); // maxPips=3, rebatePips=5 (invalid)
      return Promise.resolve(cfg(CHILD_ID, 5, 0));
    });

    prisma.$queryRaw.mockResolvedValue([node(CHILD_ID, PARENT_ID, 1)]);

    const upsertCalls: any[] = [];
    prisma.rebateConfig.upsert.mockImplementation((args) => {
      upsertCalls.push(args);
      return Promise.resolve(args.create ?? args.update);
    });

    // Must NOT throw
    await expect(
      (service as any).cascadeMaxPipsToSubtree(PARENT_ID, ASSET, REBATE_TYPE, 'admin-id')
    ).resolves.not.toThrow();

    const childUpsert = upsertCalls.find(c => c.where.ibId_assetType_rebateType?.ibId === CHILD_ID);
    expect(childUpsert).toBeDefined();
    expect(childUpsert.update.maxPips).toBe(0); // Math.max(0, 3-5) = 0
  });

  // ─── (d-audit) Khi con có rebatePips+markupPips > newMaxPips → log audit ───
  it('(d-audit) Khi con vượt ceiling mới → ghi audit REBATE_CONFIG_OVER_CEILING_DETECTED', async () => {
    const PARENT_ID = 'parent-1';
    const CHILD_ID = 'child-over';
    const ASSET = AssetType.D_FOREX;
    const REBATE_TYPE = 'STP_REBATE';

    prisma.rebateConfig.findUnique.mockImplementation(({ where }) => {
      const ibId = where.ibId_assetType_rebateType?.ibId;
      if (ibId === PARENT_ID) return Promise.resolve(cfg(PARENT_ID, 5, 4)); // remaining=1
      // Child had rebatePips=3 → will exceed newMaxPips=1
      return Promise.resolve(cfg(CHILD_ID, 10, 3, 0));
    });

    prisma.$queryRaw.mockResolvedValue([node(CHILD_ID, PARENT_ID, 1)]);
    prisma.rebateConfig.upsert.mockImplementation((args) => Promise.resolve(args.create ?? args.update));

    await (service as any).cascadeMaxPipsToSubtree(PARENT_ID, ASSET, REBATE_TYPE, 'admin-id');

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'REBATE_CONFIG_OVER_CEILING_DETECTED',
        targetId: CHILD_ID,
      })
    );
  });
});

// ─── setMibMaxOverride integration (mock DB) ──────────────────────────────────

describe('RebateService — setMibMaxOverride với cascade mới', () => {
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

  it('setMibMaxOverride: sau override MIB maxPips=10, cascade đến con với rebatePips=0 → con maxPips=10', async () => {
    const MIB_ID = 'mib-1';
    const CHILD_ID = 'child-1';
    const ASSET = AssetType.D_FOREX;
    const REBATE_TYPE = 'STP_REBATE';

    // MIB level check
    prisma.ibNode.findUnique.mockResolvedValue({ level: 0 });

    const configDB: Record<string, { maxPips: number; rebatePips: number }> = {
      [MIB_ID]: { maxPips: 12, rebatePips: 0 },
      [CHILD_ID]: { maxPips: 0, rebatePips: 0 },
    };

    prisma.rebateConfig.findUnique.mockImplementation(({ where }) => {
      const ibId = where.ibId_assetType_rebateType?.ibId;
      const data = configDB[ibId];
      return Promise.resolve(data ? cfg(ibId, data.maxPips, data.rebatePips) : null);
    });

    prisma.rebateConfig.upsert.mockImplementation((args) => {
      const ibId = args.where.ibId_assetType_rebateType?.ibId;
      // Both update and create paths may carry maxPips
      const newMaxPips = args.update?.maxPips ?? args.create?.maxPips;
      if (ibId !== undefined && newMaxPips !== undefined) {
        configDB[ibId] = { ...configDB[ibId], maxPips: newMaxPips };
      }
      return Promise.resolve({ ...cfg(ibId, configDB[ibId]?.maxPips ?? 0, configDB[ibId]?.rebatePips ?? 0) });
    });

    // CTE: 1 direct child — Prisma $queryRaw uses tagged template literals,
    // Jest receives a TemplateStringsArray as first arg, not a plain string.
    // We match any call and return the subtree nodes.
    prisma.$queryRaw.mockResolvedValue([node(CHILD_ID, MIB_ID, 1)]);

    // getConfig final call
    prisma.rebateConfig.findMany.mockImplementation(({ where }) => {
      const ibId = where.ibId;
      const data = configDB[ibId];
      return Promise.resolve(data ? [{ ...cfg(ibId, data.maxPips, data.rebatePips), updatedAt: new Date() }] : []);
    });

    prisma.rebateConfigHistory.create.mockResolvedValue({});

    await service.setMibMaxOverride(MIB_ID, [{ assetType: ASSET, rebateType: REBATE_TYPE, maxPips: 10 }], 'admin-id');

    // After override: MIB maxPips=10, rebatePips=0 → child should get maxPips = 10-0 = 10
    expect(configDB[CHILD_ID].maxPips).toBe(10);
  });

  it('setMibMaxOverride: từ chối nếu maxPips > companyCeiling (D_FOREX ceiling=12)', async () => {
    prisma.ibNode.findUnique.mockResolvedValue({ level: 0 });
    await expect(
      service.setMibMaxOverride('mib-1', [{ assetType: AssetType.D_FOREX, rebateType: 'STP_REBATE', maxPips: 15 }], 'admin-id')
    ).rejects.toMatchObject({ response: { code: 'MAX_OVERRIDE_INVALID' } });
  });

  it('setMibMaxOverride: từ chối nếu target không phải MIB (level=1)', async () => {
    prisma.ibNode.findUnique.mockResolvedValue({ level: 1 });
    await expect(
      service.setMibMaxOverride('not-a-mib', [{ assetType: AssetType.D_FOREX, rebateType: 'STP_REBATE', maxPips: 5 }], 'admin-id')
    ).rejects.toMatchObject({ response: { code: 'NOT_A_MIB' } });
  });
});
