import { Test, TestingModule } from '@nestjs/testing';
import { RebateService, MAX_PIPS } from './rebate.service';
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
            const w = where.ibId_accountType_assetType_rebateType || where.ibId_assetType_rebateType;
            const key = `${w.ibId}:${w.assetType}:${w.rebateType}`;
            return Promise.resolve(store.get(key) || null);
          }),
          upsert: jest.fn().mockImplementation(({ where, update, create }) => {
            const w = where.ibId_accountType_assetType_rebateType || where.ibId_assetType_rebateType;
            const key = `${w.ibId}:${w.assetType}:${w.rebateType}`;
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
    notifyAdminsOnIbAction: jest.fn().mockResolvedValue(undefined),
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

  // ============ REGRESSION TESTS cho fix ngày 27/07/2026 ============

  it('updateConfig(): BE PHẢI bỏ qua hoàn toàn maxPips do FE gửi lên (chống VĐ2/VĐ3 tái phát)', async () => {
    const MIB_ID = 'mib-regress-1';
    const LV1_ID = 'lv1-regress-1';

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

    // Giả lập FE cũ gửi maxPips đã bị addedMarkupPips làm phồng lên (vd 999) —
    // đây chính là hành vi gây bug VĐ2/VĐ3. BE phải KHÔNG được tin giá trị này.
    await service.updateConfig(
      MIB_ID,
      0,
      LV1_ID,
      {
        assets: [
          { assetType: AssetType.GOLD, rebateType: 'STP_REBATE', rebatePips: 15, markupPips: 0, markupPercent: 100, maxPips: 999 } as any,
        ],
      },
      'MIB',
    );

    const lv1Config = prisma._store.get(`${LV1_ID}:${AssetType.GOLD}:STP_REBATE`);
    expect(lv1Config.maxPips).toBe(15); // KHÔNG phải 999 — BE tự tính, không tin FE
    expect(lv1Config.maxPips).not.toBe(999);
  });

  it('getConfig(): MIB có maxPips=0 trong DB phải fallback về MAX_PIPS[assetType] (trần công ty)', async () => {
    const MIB_ID = 'mib-regress-2';

    prisma._store.set(`${MIB_ID}:${AssetType.FOREX}:STP_REBATE`, {
      ibId: MIB_ID,
      assetType: AssetType.FOREX,
      rebateType: 'STP_REBATE',
      rebatePips: 0,
      markupPips: 0,
      markupPercent: 100,
      maxPips: 0, // chưa từng được set / bị reset
      updatedAt: new Date(),
    });

    prisma.ibNode.findUnique.mockImplementation(({ where }) => {
      if (where.id === MIB_ID) return Promise.resolve({ level: 0 });
      return Promise.resolve(null);
    });

    const config = await service.getConfig(MIB_ID);
    const forexAsset = config.assets.find((a) => a.assetType === AssetType.FOREX);

    expect(forexAsset).toBeDefined();
    expect(forexAsset!.maxPips).toBe(MAX_PIPS[AssetType.FOREX]); // fallback áp dụng cho MIB
  });

  it('getConfig(): non-MIB có maxPips=0 GIỮ NGUYÊN 0, KHÔNG được fallback (cha chưa cấp gì là hợp lệ)', async () => {
    const LV1_ID = 'lv1-regress-2';

    prisma._store.set(`${LV1_ID}:${AssetType.FOREX}:STP_REBATE`, {
      ibId: LV1_ID,
      assetType: AssetType.FOREX,
      rebateType: 'STP_REBATE',
      rebatePips: 0,
      markupPips: 0,
      markupPercent: 100,
      maxPips: 0,
      updatedAt: new Date(),
    });

    prisma.ibNode.findUnique.mockImplementation(({ where }) => {
      if (where.id === LV1_ID) return Promise.resolve({ level: 1 });
      return Promise.resolve(null);
    });

    const config = await service.getConfig(LV1_ID);
    const forexAsset = config.assets.find((a) => a.assetType === AssetType.FOREX);

    expect(forexAsset).toBeDefined();
    expect(forexAsset!.maxPips).toBe(0); // KHÔNG fallback cho non-MIB
  });

  it('updateConfig(): Test B — MIB có maxPips=0 raw trong DB (chưa từng set) KHÔNG được chặn nhầm khi Lưu (đồng bộ với fallback UI đang hiện)', async () => {
    const MIB_ID = 'mib-regress-3';
    const LV1_ID = 'lv1-regress-3';

    // MIB chưa từng được set maxPips cho SILVER_5000 -> raw DB = 0.
    // getConfig() sẽ fallback hiển thị MAX_PIPS[SILVER_5000] = 80 trên UI
    // (xem test getConfig() fallback ở trên). updateConfig() PHẢI dùng
    // đúng con số 80 đó để validate, không phải 0 raw.
    prisma._store.set(`${MIB_ID}:${AssetType.SILVER_5000}:STP_REBATE`, {
      ibId: MIB_ID,
      assetType: AssetType.SILVER_5000,
      rebateType: 'STP_REBATE',
      rebatePips: 0,
      markupPips: 0,
      maxPips: 0, // chưa từng set — DB raw
      ib: { level: 0 },
    });

    prisma.ibNode.findUnique.mockImplementation(({ where }) => {
      if (where.id === LV1_ID) return Promise.resolve({ parentId: MIB_ID, level: 1 });
      if (where.id === MIB_ID) return Promise.resolve({ parentId: null, level: 0 });
      return Promise.resolve(null);
    });

    // MIB chia 70 pips cho Sub-IB Lv1 — hợp lệ vì trần thực tế là 80 (MAX_PIPS),
    // giống hệt số đang hiển thị trên UI. Trước fix: throw REBATE_EXCEEDS_PARENT
    // vì code đọc raw maxPips=0 từ DB.
    await expect(
      service.updateConfig(
        MIB_ID,
        0,
        LV1_ID,
        { assets: [{ assetType: AssetType.SILVER_5000, rebateType: 'STP_REBATE', rebatePips: 70, markupPips: 0, markupPercent: 100 }] },
        'MIB',
      ),
    ).resolves.not.toThrow();

    const lv1Config = prisma._store.get(`${LV1_ID}:${AssetType.SILVER_5000}:STP_REBATE`);
    expect(lv1Config.rebatePips).toBe(70);
  });

  it('updateConfig(): Test B — vượt quá trần fallback (81 > 80) vẫn phải bị chặn đúng', async () => {
    const MIB_ID = 'mib-regress-4';
    const LV1_ID = 'lv1-regress-4';

    prisma._store.set(`${MIB_ID}:${AssetType.SILVER_5000}:STP_REBATE`, {
      ibId: MIB_ID,
      assetType: AssetType.SILVER_5000,
      rebateType: 'STP_REBATE',
      rebatePips: 0,
      markupPips: 0,
      maxPips: 0,
      ib: { level: 0 },
    });

    prisma.ibNode.findUnique.mockImplementation(({ where }) => {
      if (where.id === LV1_ID) return Promise.resolve({ parentId: MIB_ID, level: 1 });
      if (where.id === MIB_ID) return Promise.resolve({ parentId: null, level: 0 });
      return Promise.resolve(null);
    });

    await expect(
      service.updateConfig(
        MIB_ID,
        0,
        LV1_ID,
        { assets: [{ assetType: AssetType.SILVER_5000, rebateType: 'STP_REBATE', rebatePips: 81, markupPips: 0, markupPercent: 100 }] },
        'MIB',
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('updateConfig(): markupPips lưu vào DB phải đúng giá trị FE gửi, KHÔNG bị ghi đè bởi markupPercent (chống bug 27/07/2026: mọi asset bị lưu markupPips=100)', async () => {
    const MIB_ID = 'mib-regress-5';
    const LV1_ID = 'lv1-regress-5';

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

    // Đúng như FE thật gửi: markupPercent LUÔN LUÔN là 100 (hardcode ở handleSave),
    // còn markupPips là giá trị addedMarkupPips thật (vd 6 pips theo Loại tài khoản).
    await service.updateConfig(
      MIB_ID,
      0,
      LV1_ID,
      { assets: [{ assetType: AssetType.GOLD, rebateType: 'STP_REBATE', rebatePips: 15, markupPips: 6, markupPercent: 100 }] },
      'MIB',
    );

    const lv1Config = prisma._store.get(`${LV1_ID}:${AssetType.GOLD}:STP_REBATE`);
    expect(lv1Config.markupPips).toBe(6); // KHÔNG phải 100
    expect(lv1Config.markupPips).not.toBe(100);
  });

  it('getConfig(): MIB CHƯA TỪNG có dòng nào trong DB (bootstrap gap) vẫn phải trả về ĐỦ mọi AssetType với maxPips = trần công ty (chống bug "MIB không hiện trên Dashboard dù là root", 27/07/2026)', async () => {
    const MIB_ID = 'mib-regress-6';
    // Cố tình KHÔNG set bất kỳ dòng nào trong store cho MIB_ID — mô phỏng đúng
    // trường hợp thật: Admin chưa từng setMibMaxOverride cho MIB này.

    prisma.ibNode.findUnique.mockImplementation(({ where }) => {
      if (where.id === MIB_ID) return Promise.resolve({ level: 0 });
      return Promise.resolve(null);
    });

    const config = await service.getConfig(MIB_ID);

    expect(config.assets.length).toBe(Object.values(AssetType).length);
    const goldAsset = config.assets.find((a) => a.assetType === AssetType.GOLD);
    expect(goldAsset!.maxPips).toBe(MAX_PIPS[AssetType.GOLD]);
    const silverAsset = config.assets.find((a) => a.assetType === AssetType.SILVER_5000);
    expect(silverAsset!.maxPips).toBe(MAX_PIPS[AssetType.SILVER_5000]);
  });

  it('updateConfig(): MIB CHƯA TỪNG có dòng nào trong DB vẫn phải validate đúng theo trần công ty (KHÔNG được rơi nhầm vào nhánh "không có cha" và dùng nhầm existing.maxPips cũ của con làm cơ sở)', async () => {
    const MIB_ID = 'mib-regress-7';
    const LV1_ID = 'lv1-regress-7';

    // MIB_ID: KHÔNG có dòng nào trong store (bootstrap gap thật sự).
    // LV1_ID: có sẵn 1 dòng CŨ với maxPips=5 (stale, thấp hơn nhiều trần công ty
    // GOLD=20) — mô phỏng dữ liệu tồn tại từ trước. Nếu code rơi nhầm vào nhánh
    // "không có cha" (bug cũ), nó sẽ lấy nhầm 5 này làm giới hạn và CHẶN SAI một
    // yêu cầu 15 pips lẽ ra hợp lệ (vì trần công ty GOLD = 20).
    prisma._store.set(`${LV1_ID}:${AssetType.GOLD}:STP_REBATE`, {
      ibId: LV1_ID,
      assetType: AssetType.GOLD,
      rebateType: 'STP_REBATE',
      rebatePips: 0,
      markupPips: 0,
      maxPips: 5,
    });

    prisma.ibNode.findUnique.mockImplementation(({ where }) => {
      if (where.id === LV1_ID) return Promise.resolve({ parentId: MIB_ID, level: 1 });
      if (where.id === MIB_ID) return Promise.resolve({ parentId: null, level: 0 });
      return Promise.resolve(null);
    });

    await expect(
      service.updateConfig(
        MIB_ID,
        0,
        LV1_ID,
        { assets: [{ assetType: AssetType.GOLD, rebateType: 'STP_REBATE', rebatePips: 15, markupPips: 0, markupPercent: 100 }] },
        'MIB',
      ),
    ).resolves.not.toThrow();

    const lv1Config = prisma._store.get(`${LV1_ID}:${AssetType.GOLD}:STP_REBATE`);
    expect(lv1Config.rebatePips).toBe(15);
  });
});