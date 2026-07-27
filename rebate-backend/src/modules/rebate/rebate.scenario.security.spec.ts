/**
 * rebate.scenario.security.spec.ts
 *
 * Test này verify lỗ hổng CRITICAL đã audit ở PUT /rebate/config/scenario/save
 * (RebateService.saveBranchScenario):
 *   - IDOR / Broken Access Control: bất kỳ user nào đăng nhập (kể cả IB level thấp
 *     nhất) đều có thể gửi ibId của node NGOÀI subtree của mình và ghi đè
 *     markupPercent/markupPips của node đó.
 *   - Thiếu AuditLog cho thao tác tài chính này.
 *   - Thiếu notify Admin khi MIB/IB (không phải Admin) thực hiện thao tác.
 *
 * Đặt file này cùng thư mục với rebate.service.ts:
 *   rebate-backend/src/modules/rebate/rebate.scenario.security.spec.ts
 *
 * Chạy trước khi fix: các test "IDOR" và "AUDIT LOG" sẽ FAIL (chứng minh lỗ hổng tồn tại).
 * Chạy sau khi áp dụng fix theo prompt: toàn bộ test PASS.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { RebateService } from './rebate.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../audit/audit.constants';
import { NotificationService } from '../notification/notification.service';

describe('RebateService.saveBranchScenario — Security (IDOR audit)', () => {
    let service: RebateService;
    let prisma: any;
    let audit: any;
    let notification: any;

    // Cây IB giả lập dùng xuyên suốt các test:
    //
    //   MIB_A (level 0, root của nhánh A)
    //     ├── IB_A1  (con trực tiếp của MIB_A)
    //     └── IB_A2  (con trực tiếp của MIB_A)
    //
    //   MIB_B (level 0, root của nhánh B — HOÀN TOÀN KHÔNG LIÊN QUAN tới nhánh A)
    //     └── IB_B1  (con trực tiếp của MIB_B)
    //
    // MIB_A không có quyền gì trên MIB_B / IB_B1 và ngược lại.

    const NODES = {
        MIB_A: 'mib-a-id',
        IB_A1: 'ib-a1-id',
        IB_A2: 'ib-a2-id',
        MIB_B: 'mib-b-id',
        IB_B1: 'ib-b1-id',
    };

    const PARENT_MAP: Record<string, string | null> = {
        [NODES.MIB_A]: null,
        [NODES.IB_A1]: NODES.MIB_A,
        [NODES.IB_A2]: NODES.MIB_A,
        [NODES.MIB_B]: null,
        [NODES.IB_B1]: NODES.MIB_B,
    };

    beforeEach(async () => {
        prisma = {
            ibNode: {
                // getSubtreeIds(prisma, rootId, role) gọi hàm này:
                //  - role === 'ADMIN'      -> findMany({ select: { id: true } })            (không where)
                //  - role !== 'ADMIN'      -> findMany({ where: { parentId: rootId }, ...}) (lấy con trực tiếp)
                findMany: jest.fn().mockImplementation((args: any = {}) => {
                    const where = args.where;
                    if (where?.parentId !== undefined) {
                        const children = Object.entries(PARENT_MAP)
                            .filter(([, parentId]) => parentId === where.parentId)
                            .map(([id]) => ({ id }));
                        return Promise.resolve(children);
                    }
                    // ADMIN: trả về toàn bộ hệ thống
                    return Promise.resolve(Object.keys(PARENT_MAP).map((id) => ({ id })));
                }),
                findUnique: jest.fn().mockImplementation(({ where }: any) =>
                    Promise.resolve({ id: where.id, name: 'Actor', email: 'actor@test.com' }),
                ),
            },
            rebateConfig: {
                findMany: jest.fn().mockResolvedValue([]),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            $transaction: jest.fn().mockImplementation((fn: any) =>
                fn({
                    rebateConfig: {
                        updateMany: (...args: any[]) => prisma.rebateConfig.updateMany(...args),
                    },
                }),
            ),
        };

        audit = { log: jest.fn().mockResolvedValue(undefined) };

        notification = {
            notifyAdminsOnIbAction: jest.fn().mockResolvedValue(undefined),
            notifyConfigChangedByAdmin: jest.fn(),
            createSystemNotification: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RebateService,
                { provide: PrismaService, useValue: prisma },
                { provide: AuditService, useValue: audit },
                { provide: NotificationService, useValue: notification },
            ],
        }).compile();

        service = module.get(RebateService);
    });

    // ─────────────────────────────────────────────────────────────
    // 1. IDOR — lỗ hổng chính đã audit
    // ─────────────────────────────────────────────────────────────
    describe('IDOR / Broken Access Control', () => {
        it('CHẶN: IB thường (MIB_A) không được set markup cho node ở nhánh KHÁC (MIB_B)', async () => {
            const dto = {
                nodes: [{ ibId: NODES.MIB_B, markupPercent: 90, markupPips: 5 }],
            } as any;

            await expect(
                service.saveBranchScenario(dto, NODES.MIB_A, 'IB'),
            ).rejects.toThrow(ForbiddenException);

            // Không được ghi DB khi ownership check fail
            expect(prisma.rebateConfig.updateMany).not.toHaveBeenCalled();
        });

        it('CHẶN: payload trộn 1 node hợp lệ + 1 node ngoài nhánh -> reject TOÀN BỘ, không ghi 1 phần (atomic)', async () => {
            const dto = {
                nodes: [
                    { ibId: NODES.IB_A1, markupPercent: 10, markupPips: 1 }, // hợp lệ — con trực tiếp của MIB_A
                    { ibId: NODES.IB_B1, markupPercent: 99, markupPips: 9 }, // KHÔNG hợp lệ — thuộc nhánh MIB_B
                ],
            } as any;

            await expect(
                service.saveBranchScenario(dto, NODES.MIB_A, 'IB'),
            ).rejects.toThrow(ForbiddenException);

            // Đây là điểm quan trọng nhất: code cũ dùng vòng for + updateMany tuần tự,
            // nên nếu node hợp lệ đứng trước node không hợp lệ, nó sẽ bị ghi 1 phần
            // trước khi phát hiện lỗi. Ownership check phải chạy TRƯỚC transaction.
            expect(prisma.rebateConfig.updateMany).not.toHaveBeenCalled();
        });

        it('CHO PHÉP: IB tự sửa markup cho chính mình', async () => {
            const dto = {
                nodes: [{ ibId: NODES.MIB_A, markupPercent: 20, markupPips: 2 }],
            } as any;

            const result = await service.saveBranchScenario(dto, NODES.MIB_A, 'IB');

            expect(result.success).toBe(true);
            expect(prisma.rebateConfig.updateMany).toHaveBeenCalledTimes(1);
        });

        it('CHO PHÉP: IB sửa markup cho các con trực tiếp của mình', async () => {
            const dto = {
                nodes: [
                    { ibId: NODES.IB_A1, markupPercent: 15, markupPips: 1 },
                    { ibId: NODES.IB_A2, markupPercent: 25, markupPips: 2 },
                ],
            } as any;

            const result = await service.saveBranchScenario(dto, NODES.MIB_A, 'IB');

            expect(result.success).toBe(true);
            expect(prisma.rebateConfig.updateMany).toHaveBeenCalledTimes(2);
        });

        it('CHO PHÉP: ADMIN có thể sửa bất kỳ node nào, kể cả ngoài nhánh', async () => {
            const dto = {
                nodes: [{ ibId: NODES.IB_B1, markupPercent: 50, markupPips: 3 }],
            } as any;

            const result = await service.saveBranchScenario(dto, 'admin-id', 'ADMIN');

            expect(result.success).toBe(true);
            expect(prisma.rebateConfig.updateMany).toHaveBeenCalledTimes(1);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // 2. Audit trail — gap đã audit
    // ─────────────────────────────────────────────────────────────
    describe('Audit logging', () => {
        it('GHI AUDIT LOG khi lưu scenario thành công (trước đây KHÔNG ghi gì cả)', async () => {
            const dto = {
                nodes: [{ ibId: NODES.MIB_A, markupPercent: 30, markupPips: 3 }],
            } as any;

            await service.saveBranchScenario(dto, NODES.MIB_A, 'IB');

            expect(audit.log).toHaveBeenCalledTimes(1);
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    actorId: NODES.MIB_A,
                    action: AUDIT_ACTIONS.REBATE_SCENARIO_SAVE,
                }),
            );
        });

        it('KHÔNG ghi audit log khi request bị chặn do IDOR (không có side-effect nào xảy ra)', async () => {
            const dto = {
                nodes: [{ ibId: NODES.MIB_B, markupPercent: 90, markupPips: 5 }],
            } as any;

            await expect(
                service.saveBranchScenario(dto, NODES.MIB_A, 'IB'),
            ).rejects.toThrow(ForbiddenException);

            expect(audit.log).not.toHaveBeenCalled();
        });
    });

    // ─────────────────────────────────────────────────────────────
    // 3. Notification tới Admin — gap đã audit (đồng bộ hành vi với updateConfig)
    // ─────────────────────────────────────────────────────────────
    describe('Admin notification', () => {
        it('BÁO Admin khi IB (không phải Admin) lưu scenario', async () => {
            const dto = {
                nodes: [{ ibId: NODES.MIB_A, markupPercent: 40, markupPips: 4 }],
            } as any;

            await service.saveBranchScenario(dto, NODES.MIB_A, 'IB');

            expect(notification.notifyAdminsOnIbAction).toHaveBeenCalledTimes(1);
        });

        it('KHÔNG báo Admin khi chính Admin là người thực hiện (tránh spam thông báo)', async () => {
            const dto = {
                nodes: [{ ibId: NODES.IB_B1, markupPercent: 40, markupPips: 4 }],
            } as any;

            await service.saveBranchScenario(dto, 'admin-id', 'ADMIN');

            expect(notification.notifyAdminsOnIbAction).not.toHaveBeenCalled();
        });
    });

    // ─────────────────────────────────────────────────────────────
    // 4. Validate hành vi cũ vẫn giữ nguyên (không regression)
    // ─────────────────────────────────────────────────────────────
    describe('Existing validation (regression guard)', () => {
        it('reject khi nodes rỗng (giữ nguyên hành vi cũ)', async () => {
            const dto = { nodes: [] } as any;

            await expect(
                service.saveBranchScenario(dto, NODES.MIB_A, 'IB'),
            ).rejects.toThrow(BadRequestException);
        });

        it('reject khi thiếu field nodes (giữ nguyên hành vi cũ)', async () => {
            const dto = {} as any;

            await expect(
                service.saveBranchScenario(dto, NODES.MIB_A, 'IB'),
            ).rejects.toThrow(BadRequestException);
        });
    });
});