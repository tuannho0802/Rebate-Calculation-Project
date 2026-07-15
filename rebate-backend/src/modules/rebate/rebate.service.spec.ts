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

  // ─── (e) MIB làm root cascade: MIB maxPips=12 rebatePips=3 → L1 maxPips=9 ──
  it('(e) MIB làm root: MIB maxPips=12 rebatePips=3 → Level 1 maxPips=9', async () => {
    const MIB_ID = 'mib-1';
    const LV1_ID = 'lv1-1';
    const ASSET = AssetType.D_FOREX;
    const REBATE_TYPE = 'STP_REBATE';

    const configDB: Record<string, { maxPips: number; rebatePips: number }> = {
      [MIB_ID]: { maxPips: 12, rebatePips: 3 }, // admin sửa MIB rebatePips 2→3
      [LV1_ID]: { maxPips: 0, rebatePips: 2 },
    };

    prisma.$queryRaw.mockResolvedValue([node(LV1_ID, MIB_ID, 1)]);

    const upsertCalls: any[] = [];
    prisma.rebateConfig.upsert.mockImplementation((args) => {
      upsertCalls.push(args);
      const ibId = args.where.ibId_assetType_rebateType?.ibId;
      if (ibId && args.update?.maxPips !== undefined) {
        configDB[ibId] = { ...configDB[ibId], maxPips: args.update.maxPips };
      }
      return Promise.resolve({ ibId, ...args.update });
    });

    prisma.rebateConfig.findUnique.mockImplementation(({ where }) => {
      const ibId = where.ibId_assetType_rebateType?.ibId;
      const data = configDB[ibId];
      return Promise.resolve(data ? cfg(ibId, data.maxPips, data.rebatePips) : null);
    });

    await (service as any).cascadeMaxPipsToSubtree(MIB_ID, ASSET, REBATE_TYPE, 'admin-id');

    const lv1Upsert = upsertCalls.find(c => c.where.ibId_assetType_rebateType?.ibId === LV1_ID);
    expect(lv1Upsert).toBeDefined();
    expect(lv1Upsert.update.maxPips).toBe(9); // 12 - 3 = 9
  });

  // ─── (f) 1 MIB, 2 nhánh Lv1 độc lập: rebatePips=3 → cả 2 Lv1 maxPips=9 ──
  it('(f) 1 MIB 2 nhánh Lv1 độc lập: rebatePips(MIB)=3 → cả 2 con maxPips=9, không phụ thuộc rebatePips nhau', async () => {
    const MIB_ID = 'mib-1';
    const LV1_A = 'lv1-a';
    const LV1_B = 'lv1-b';
    const ASSET = AssetType.D_FOREX;
    const REBATE_TYPE = 'STP_REBATE';

    const configDB: Record<string, { maxPips: number; rebatePips: number }> = {
      [MIB_ID]: { maxPips: 12, rebatePips: 3 }, // MIB giữ 3
      [LV1_A]: { maxPips: 0, rebatePips: 2 },   // nhánh A: cha giữ khác nhánh B
      [LV1_B]: { maxPips: 0, rebatePips: 5 },   // nhánh B: rebatePips riêng biệt
    };

    prisma.$queryRaw.mockResolvedValue([
      node(LV1_A, MIB_ID, 1),
      node(LV1_B, MIB_ID, 1),
    ]);

    const upsertCalls: any[] = [];
    prisma.rebateConfig.upsert.mockImplementation((args) => {
      upsertCalls.push(args);
      const ibId = args.where.ibId_assetType_rebateType?.ibId;
      if (ibId && args.update?.maxPips !== undefined) {
        configDB[ibId] = { ...configDB[ibId], maxPips: args.update.maxPips };
      }
      return Promise.resolve({ ibId, ...args.update });
    });

    prisma.rebateConfig.findUnique.mockImplementation(({ where }) => {
      const ibId = where.ibId_assetType_rebateType?.ibId;
      const data = configDB[ibId];
      return Promise.resolve(data ? cfg(ibId, data.maxPips, data.rebatePips) : null);
    });

    await (service as any).cascadeMaxPipsToSubtree(MIB_ID, ASSET, REBATE_TYPE, 'admin-id');

    const lv1aUpsert = upsertCalls.find(c => c.where.ibId_assetType_rebateType?.ibId === LV1_A);
    const lv1bUpsert = upsertCalls.find(c => c.where.ibId_assetType_rebateType?.ibId === LV1_B);

    // Cả 2 nhánh nhận remaining của MIB (12 - 3 = 9), bất kể rebatePips riêng
    expect(lv1aUpsert.update.maxPips).toBe(9);
    expect(lv1bUpsert.update.maxPips).toBe(9);
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

// ─── CHẶN CỨNG cascade (dry-run 2 pha) + lỗ hổng bulk ────────────────────────

describe('RebateService — CHẶN CỨNG cascade (dry-run 2 pha) + bulk vulnerability', () => {
  const ASSET = AssetType.FOREX;
  const RT = 'STP_REBATE';
  const ADMIN = 'admin-id';
  const MIB_ID = 'mib-1';
  const LV1_ID = 'lv1-a';
  const LV2_ID = 'lv2-a';
  const LV3_ID = 'lv3-a';

  let service: RebateService;
  let prisma: any;
  let configDB: Map<string, { assetType: string; rebateType: string; rebatePips: number; markupPips: number; maxPips: number }>;
  let subtrees: Map<string, { id: string; parentId: string | null; level: number }[]>;
  let failUpsert: Map<string, number>;
  let audit: any;

  const seed = () => {
    configDB = new Map();
    const put = (ibId: string, rebatePips: number, maxPips: number, markupPips: number) =>
      configDB.set(`${ibId}:${ASSET}:${RT}`, { assetType: ASSET, rebateType: RT, rebatePips, markupPips, maxPips });
    put(MIB_ID, 2, 12, 10);
    put(LV1_ID, 3, 10, 7);
    put(LV2_ID, 2, 7, 5);
    put(LV3_ID, 5, 5, 0);

    subtrees = new Map();
    subtrees.set(MIB_ID, [node(LV1_ID, MIB_ID, 1), node(LV2_ID, LV1_ID, 2), node(LV3_ID, LV2_ID, 3)]);
    subtrees.set(LV1_ID, [node(LV2_ID, LV1_ID, 2), node(LV3_ID, LV2_ID, 3)]);
    subtrees.set(LV2_ID, [node(LV3_ID, LV2_ID, 3)]);
    subtrees.set(LV3_ID, []);
    failUpsert = new Map();
  };

  beforeEach(async () => {
    seed();
    const upsertCallCount = new Map<string, number>();

    // $queryRaw xử lý 2 dạng: subtree CTE (values[0]=rootId string) và
    // query vi phạm còn sót (values[0]=array affected ids).
    const queryRaw = jest.fn((_strings: any, ...values: any[]) => {
      const first = values[0];
      if (Array.isArray(first)) {
        const affected = first as string[];
        const res: any[] = [];
        for (const [k, c] of configDB) {
          const [ibId, assetType, rebateType] = k.split(':');
          if (affected.includes(ibId) && c.rebatePips + c.markupPips > c.maxPips) {
            res.push({ ibId, assetType, rebateType, rebatePips: c.rebatePips, markupPips: c.markupPips, maxPips: c.maxPips });
          }
        }
        return Promise.resolve(res);
      }
      const rootId = first as string;
      return Promise.resolve(subtrees.get(rootId) ?? []);
    });

    const rebateConfig = {
      findUnique: jest.fn(async ({ where }: any) => {
        const { ibId, assetType, rebateType } = where.ibId_assetType_rebateType;
        const c = configDB.get(`${ibId}:${assetType}:${rebateType}`);
        return c ? { ibId, assetType, rebateType, rebatePips: c.rebatePips, markupPips: c.markupPips, maxPips: c.maxPips } : null;
      }),
      findMany: jest.fn(async ({ where }: any) => {
        const ibId = where.ibId;
        const res: any[] = [];
        for (const [k, c] of configDB) {
          const [id, assetType, rebateType] = k.split(':');
          if (id === ibId) res.push({ ibId: id, assetType, rebateType, rebatePips: c.rebatePips, markupPips: c.markupPips, maxPips: c.maxPips, updatedAt: new Date() });
        }
        return res;
      }),
      upsert: jest.fn(async (args: any) => {
        const { ibId, assetType, rebateType } = args.where.ibId_assetType_rebateType;
        const n = (upsertCallCount.get(ibId) ?? 0) + 1;
        upsertCallCount.set(ibId, n);
        const failAt = failUpsert.get(ibId);
        if (failAt && n >= failAt) throw new Error('SIMULATED_UNRELATED_WRITE_ERROR');
        const key = `${ibId}:${assetType}:${rebateType}`;
        const existing = configDB.get(key);
        // Giống Prisma: `update` chỉ ghi các field có trong object, giữ nguyên field còn lại.
        const data = args.update ?? args.create;
        const merged = {
          assetType,
          rebateType,
          rebatePips: data.rebatePips !== undefined ? Number(data.rebatePips) : (existing?.rebatePips ?? 0),
          markupPips: data.markupPips !== undefined ? Number(data.markupPips) : (existing?.markupPips ?? 0),
          maxPips: data.maxPips !== undefined ? Number(data.maxPips) : (existing?.maxPips ?? 0),
        };
        configDB.set(key, merged);
        return { id: 'id-' + ibId, ibId, assetType, rebateType, ...merged };
      }),
    };

    const ibNode = {
      findUnique: jest.fn(),
      findMany: jest.fn(async ({ where }: any) => {
        if (where?.id?.in) return where.id.in.map((id: string) => ({ id, name: id, email: id }));
        return [];
      }),
    };

    prisma = {
      ibNode,
      rebateConfig,
      rebateConfigHistory: { create: jest.fn().mockResolvedValue({}) },
      $queryRaw: queryRaw,
      $transaction: jest.fn(async (fn: any) => {
        const tx = {
          rebateConfig: { findUnique: rebateConfig.findUnique, upsert: rebateConfig.upsert },
          rebateConfigHistory: { create: jest.fn().mockResolvedValue({}) },
          $queryRaw: queryRaw,
          ibNode: { findMany: ibNode.findMany, findUnique: ibNode.findUnique },
        };
        return fn(tx);
      }),
    };

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

  // (A) PHA 1 dry-run: L1 giữ 8 → L2 max=2, L3 max=0; CẢ HAI vi phạm
  it('(A) dryRunCascadeSubtree: L1 rebatePips=8 → L2 maxPips=2, L3 maxPips=0; L2 & L3 đều vi phạm', async () => {
    const dry = await (service as any).dryRunCascadeSubtree(LV1_ID, ASSET, RT, 10, 8, new Map(), prisma);
    const violating = dry.filter(n => n.rebatePips + n.markupPips > n.newMaxPips);
    expect(violating.some(v => v.ibId === LV2_ID && v.newMaxPips === 2)).toBe(true);
    expect(violating.some(v => v.ibId === LV3_ID && v.newMaxPips === 0)).toBe(true);
  });

  // (B) look-ahead proposedById: L2,L3 hạ xuống 0 → không vi phạm
  it('(B) dryRunCascadeSubtree với proposedById (L2,L3 hạ 0): KHÔNG vi phạm', async () => {
    const proposed = new Map<string, Record<string, { rebatePips: number; markupPips: number }>>();
    proposed.set(LV2_ID, { [`${ASSET}:${RT}`]: { rebatePips: 0, markupPips: 0 } });
    proposed.set(LV3_ID, { [`${ASSET}:${RT}`]: { rebatePips: 0, markupPips: 0 } });
    const dry = await (service as any).dryRunCascadeSubtree(LV1_ID, ASSET, RT, 10, 8, proposed, prisma);
    expect(dry.filter(n => n.rebatePips + n.markupPips > n.newMaxPips).length).toBe(0);
  });

  // (C) step 8: L1 3→8 (không sửa L3) → CHẶN CỨNG, DB L3 giữ nguyên
  it('(C) updateConfig: L1 3→8 (không đổi L3) → CHẶN, L3 maxPips giữ 5', async () => {
    await expect(
      (service as any).updateConfig(ADMIN, 0, LV1_ID, { assets: [{ assetType: ASSET, rebateType: RT, rebatePips: 8, markupPips: 7 }] }, 'ADMIN')
    ).rejects.toMatchObject({ response: { code: 'CASCADE_WOULD_VIOLATE_DESCENDANT' } });
    expect(configDB.get(`${LV3_ID}:${ASSET}:${RT}`)!.maxPips).toBe(5);
  });

  // (D) step 10: L1 3→1 (tăng remaining) → luôn qua, cascade L2=9 L3=7
  it('(D) updateConfig: L1 3→1 (tăng remaining) → THÀNH CÔNG, cascade L2=9 L3=7', async () => {
    await expect(
      (service as any).updateConfig(ADMIN, 0, LV1_ID, { assets: [{ assetType: ASSET, rebateType: RT, rebatePips: 1, markupPips: 7 }] }, 'ADMIN')
    ).resolves.toBeDefined();
    expect(configDB.get(`${LV2_ID}:${ASSET}:${RT}`)!.maxPips).toBe(9);
    expect(configDB.get(`${LV3_ID}:${ASSET}:${RT}`)!.maxPips).toBe(7);
  });

  // (E) step 9: L1→8, L2→0, L3→0 cùng bulk → THÀNH CÔNG (look-ahead)
  it('(E) bulkUpdateConfig: L1→8 + L2→0 + L3→0 cùng lúc → THÀNH CÔNG, không vi phạm', async () => {
    const items = [
      { ibId: LV1_ID, assets: [{ assetType: ASSET, rebateType: RT, rebatePips: 8, markupPips: 7 }] },
      { ibId: LV2_ID, assets: [{ assetType: ASSET, rebateType: RT, rebatePips: 0, markupPips: 0 }] },
      { ibId: LV3_ID, assets: [{ assetType: ASSET, rebateType: RT, rebatePips: 0, markupPips: 0 }] },
    ];
    const res = await service.bulkUpdateConfig(ADMIN, 0, { items } as any, 'ADMIN');
    expect(res.results.every(r => r.success)).toBe(true);
    expect(res.warnings.length).toBe(0);
    expect(configDB.get(`${LV2_ID}:${ASSET}:${RT}`)!.maxPips).toBe(2);
    expect(configDB.get(`${LV3_ID}:${ASSET}:${RT}`)!.maxPips).toBe(2);
  });

  // (F) lỗ hổng bulk: L1 pass look-ahead (L3 đề xuất 0), nhưng L3 fail sau (lý do khác)
  //     → FALLBACK phát hiện vi phạm còn sót, cảnh báo + audit BULK_PARTIAL_LEFT_VIOLATION
  it('(F) bulk vulnerability: L1 pass (look-ahead L2,L3 hạ) + L3 fail sau (unrelated) → FALLBACK cảnh báo L3', async () => {
    // L3 upsert lần 3 (chính nó, sau khi L1/L2 cascade đã ghi L3) fail — mô phỏng lỗi ghi DB độc lập
    failUpsert.set(LV3_ID, 3);
    const items = [
      { ibId: LV1_ID, assets: [{ assetType: ASSET, rebateType: RT, rebatePips: 8, markupPips: 7 }] },
      { ibId: LV2_ID, assets: [{ assetType: ASSET, rebateType: RT, rebatePips: 0, markupPips: 0 }] },
      { ibId: LV3_ID, assets: [{ assetType: ASSET, rebateType: RT, rebatePips: 0, markupPips: 0 }] },
    ];
    const res = await service.bulkUpdateConfig(ADMIN, 0, { items } as any, 'ADMIN');
    expect(res.results.find(r => r.ibId === LV1_ID)!.success).toBe(true);
    expect(res.results.find(r => r.ibId === LV3_ID)!.success).toBe(false);
    // L3.maxPips đã bị cascade hạ (L1/L2), nhưng L3.rebatePips vẫn 5 → vi phạm còn sót
    expect(res.warnings.some(w => w.ibId === LV3_ID)).toBe(true);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'BULK_PARTIAL_LEFT_VIOLATION' }));
  });
});
