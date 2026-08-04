import { Test, TestingModule } from '@nestjs/testing';
import { RebateService } from './rebate.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../audit/audit.constants';
import { NotificationService } from '../notification/notification.service';
import { AssetType } from '@prisma/client';

/**
 * Cùng pattern mock với rebate.service.spec.ts hiện có trong repo (store dạng Map
 * key = "ibId:assetType:rebateType"), mở rộng thêm 1 node-map để ibNode.findUnique()
 * trả đủ field mà updateConfig() cần trong nhánh notify (name/email) lẫn nhánh
 * validate cascade (parentId/level) — vì mock không tôn trọng `select` của Prisma thật.
 */
function makeNodes() {
    return {
        'lv1-1': { id: 'lv1-1', name: 'Level1 IB', email: 'lv1@test.com', role: 'IB', level: 1, parentId: 'mib-1' },
        'lv2-1': { id: 'lv2-1', name: 'Level2 IB', email: 'lv2@test.com', role: 'IB', level: 2, parentId: 'lv1-1' },
    } as Record<string, any>;
}

function makePrismaMock(nodes: Record<string, any>) {
    const store = new Map<string, any>();

    const findConfig = (where: any) => {
        const k = where.ibId_accountType_assetType_rebateType || where.ibId_assetType_rebateType;
        const key = `${k.ibId}:${k.assetType}:${k.rebateType}`;
        return store.get(key) || null;
    };
    const upsertConfig = (where: any, update: any, create: any) => {
        const k = where.ibId_accountType_assetType_rebateType || where.ibId_assetType_rebateType;
        const key = `${k.ibId}:${k.assetType}:${k.rebateType}`;
        const existing = store.get(key);
        const data = existing ? { ...existing, ...update } : create;
        store.set(key, data);
        return Promise.resolve(data);
    };

    return {
        _store: store,
        ibNode: {
            findUnique: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(nodes[where.id] || null)),
            findMany: jest.fn().mockResolvedValue([]), // smartCascadeCheckAndReset: không có con -> không cascade tiếp
        },
        rebateConfig: {
            findMany: jest.fn().mockImplementation(({ where }: any) => {
                const res: any[] = [];
                for (const [k, v] of store.entries()) if (k.startsWith(`${where.ibId}:`)) res.push(v);
                return Promise.resolve(res);
            }),
        },
        $transaction: jest.fn().mockImplementation(async (fn: any) => {
            const tx = {
                rebateConfig: {
                    findUnique: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(findConfig(where))),
                    upsert: jest.fn().mockImplementation(({ where, update, create }: any) =>
                        Promise.resolve(upsertConfig(where, update, create)),
                    ),
                },
                rebateConfigHistory: { create: jest.fn().mockResolvedValue({}) },
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
        createSystemNotification: jest.fn().mockResolvedValue({}),
        notifyAdminsOnIbAction: jest.fn().mockResolvedValue(undefined),
    };
}

describe('RebateService — updateConfig() changedAssets notification (fix)', () => {
    let service: RebateService;
    let prisma: ReturnType<typeof makePrismaMock>;
    let notification: ReturnType<typeof makeNotificationMock>;

    beforeEach(async () => {
        prisma = makePrismaMock(makeNodes());
        notification = makeNotificationMock();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RebateService,
                { provide: PrismaService, useValue: prisma },
                { provide: AuditService, useValue: makeAuditMock() },
                { provide: NotificationService, useValue: notification },
            ],
        }).compile();

        service = module.get<RebateService>(RebateService);

        // Cha (lv1-1) đã có sẵn config để updateConfig() đi vào nhánh "có parentConfig"
        prisma._store.set(`lv1-1:${AssetType.FOREX}:STP_REBATE`, {
            ibId: 'lv1-1',
            assetType: AssetType.FOREX,
            rebateType: 'STP_REBATE',
            rebatePips: 20,
            markupPips: 0,
            markupPercent: 100,
            maxPips: 20,
            ib: { level: 1 },
        });
    });

    it('IB (không phải Admin) sửa config con -> notifyAdminsOnIbAction có details.changedAssets là mảng {assetType, rebateType}', async () => {
        await service.updateConfig(
            'lv1-1',
            1,
            'lv2-1',
            { assets: [{ assetType: AssetType.FOREX, rebateType: 'STP_REBATE', rebatePips: 5, markupPips: 0, markupPercent: 100 }] },
            'IB',
        );

        expect(notification.notifyAdminsOnIbAction).toHaveBeenCalledTimes(1);
        const call = notification.notifyAdminsOnIbAction.mock.calls[0][0];

        expect(call.actionType).toBe(AUDIT_ACTIONS.REBATE_CONFIG_UPDATE);
        expect(Array.isArray(call.details.changedAssets)).toBe(true);
        expect(call.details.changedAssets).toEqual([{ assetType: AssetType.FOREX, rebateType: 'STP_REBATE' }]);
        // field cũ (dạng số) không còn tồn tại nữa
        expect(call.details.assetsCount).toBeUndefined();
    });

    it('IB sửa config con -> createSystemNotification gửi cho con cũng dùng metadata.changedAssets (không còn assetsCount)', async () => {
        await service.updateConfig(
            'lv1-1',
            1,
            'lv2-1',
            { assets: [{ assetType: AssetType.FOREX, rebateType: 'STP_REBATE', rebatePips: 5, markupPips: 0, markupPercent: 100 }] },
            'IB',
        );

        expect(notification.createSystemNotification).toHaveBeenCalledWith(
            expect.objectContaining({
                recipientId: 'lv2-1',
                metadata: expect.objectContaining({
                    // changedAssets nằm trong metadata.details (không phải top-level metadata) —
                    // cố ý bọc vậy để đồng nhất shape với notifyAdminsOnIbAction, phục vụ
                    // getNavigateTargetIbId() ở FE đọc chung 1 vị trí details.targetIbId
                    // bất kể notification gửi cho Admin hay MIB/IB.
                    details: expect.objectContaining({
                        changedAssets: [{ assetType: AssetType.FOREX, rebateType: 'STP_REBATE' }],
                    }),
                }),
            }),
        );
        const call = notification.createSystemNotification.mock.calls[0][0];
        expect(call.metadata.assetsCount).toBeUndefined();
    });

    it('nhiều asset trong 1 lần update -> changedAssets chứa đủ từng {assetType, rebateType} theo đúng thứ tự gửi lên', async () => {
        prisma._store.set(`lv1-1:${AssetType.GOLD}:STP_REBATE`, {
            ibId: 'lv1-1', assetType: AssetType.GOLD, rebateType: 'STP_REBATE',
            rebatePips: 10, markupPips: 0, markupPercent: 100, maxPips: 10, ib: { level: 1 },
        });

        await service.updateConfig(
            'lv1-1',
            1,
            'lv2-1',
            {
                assets: [
                    { assetType: AssetType.FOREX, rebateType: 'STP_REBATE', rebatePips: 5, markupPips: 0, markupPercent: 100 },
                    { assetType: AssetType.GOLD, rebateType: 'STP_REBATE', rebatePips: 3, markupPips: 0, markupPercent: 100 },
                ],
            },
            'IB',
        );

        const call = notification.notifyAdminsOnIbAction.mock.calls[0][0];
        expect(call.details.changedAssets).toEqual([
            { assetType: AssetType.FOREX, rebateType: 'STP_REBATE' },
            { assetType: AssetType.GOLD, rebateType: 'STP_REBATE' },
        ]);
    });

    it('Admin sửa config -> KHÔNG gọi notifyAdminsOnIbAction (nhánh Admin dùng notifyConfigChangedByAdmin, không đổi hành vi cũ)', async () => {
        await service.updateConfig(
            'lv1-1',
            1,
            'lv2-1',
            { assets: [{ assetType: AssetType.FOREX, rebateType: 'STP_REBATE', rebatePips: 5, markupPips: 0, markupPercent: 100 }] },
            'ADMIN',
        );

        expect(notification.notifyAdminsOnIbAction).not.toHaveBeenCalled();
        expect(notification.notifyConfigChangedByAdmin).toHaveBeenCalled();
    });
});