import { Test, TestingModule } from '@nestjs/testing';
import { IbService } from './ib.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../audit/audit.constants';
import { NotificationService } from '../notification/notification.service';

/**
 * Mock Prisma dựa trên 1 map node cố định (thay vì mock rời rạc từng call)
 * vì moveIb() gọi ibNode.findUnique() nhiều lần với select khác nhau
 * (targetIb, newParent, ancestor loop cycle-detection, actor, getAllSubtreeNodes) —
 * mock không tôn trọng `select` của Prisma thật nên trả full object là an toàn.
 */
function makeNodes() {
    return {
        // Actor KHÔNG phải Admin — nhánh cần test (fix chính)
        'actor-ib-1': { id: 'actor-ib-1', name: 'IB Actor', email: 'actor@test.com', role: 'IB', level: 1, parentId: 'mib-1' },
        // Actor LÀ Admin — nhánh regression (không được gửi notifyAdminsOnIbAction)
        'actor-admin-1': { id: 'actor-admin-1', name: 'Admin One', email: 'admin@test.com', role: 'ADMIN', level: 0, parentId: null },
        'mib-1': { id: 'mib-1', name: 'MIB Root', email: 'mib@test.com', role: 'IB', level: 0, parentId: null, accountTypes: ['STD', 'STD10', 'STD15'] },
        'moved-1': { id: 'moved-1', name: 'Moved IB', email: 'moved@test.com', role: 'IB', level: 2, parentId: 'old-parent-1', accountTypes: ['STD'] },
        'moved-with-std15': { id: 'moved-with-std15', name: 'Hoàng Tuấn', email: 'tuan@test.com', role: 'IB', level: 2, parentId: 'old-parent-1', accountTypes: ['STD10', 'STD15'] },
        'old-parent-1': { id: 'old-parent-1', name: 'Old Parent', email: 'oldparent@test.com', role: 'IB', level: 1, parentId: 'mib-1', accountTypes: ['STD', 'STD10', 'STD15'] },
        'new-parent-1': { id: 'new-parent-1', name: 'New Parent', email: 'newparent@test.com', role: 'IB', level: 1, parentId: 'mib-1', accountType: 'STD', accountTypes: ['STD'] },
        'hien-linh': { id: 'hien-linh', name: 'Hiền Linh', email: 'linh@test.com', role: 'IB', level: 1, parentId: 'mib-1', accountTypes: ['STD', 'STD10'] },
    } as Record<string, any>;
}

function makePrismaMock(nodes: Record<string, any>) {
    return {
        ibNode: {
            findUnique: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(nodes[where.id] || null)),
            // getAllSubtreeNodes() gọi findMany({where:{parentId}}) để lấy con — cả 2 node
            // dùng trong test đều là lá (không có con) nên trả [] là đúng thực tế.
            findMany: jest.fn().mockResolvedValue([]),
            update: jest.fn().mockResolvedValue({}),
        },
        rebateConfig: {
            // moveIb() bước 2 (Rebate Validation) — không có config nào => bước này bị skip,
            // tập trung đúng vào phần notify đang test.
            findMany: jest.fn().mockResolvedValue([]),
        },
        $transaction: jest.fn().mockImplementation(async (fn: any) => {
            const tx = { ibNode: { update: jest.fn().mockResolvedValue({}) } };
            return fn(tx);
        }),
    };
}

function makeAuditMock() {
    return { log: jest.fn().mockResolvedValue({}) };
}

function makeNotificationMock() {
    return {
        createSystemNotification: jest.fn().mockResolvedValue({}),
        notifyAdminsOnIbAction: jest.fn().mockResolvedValue(undefined),
    };
}

describe('IbService — moveIb() admin notification (fix)', () => {
    let service: IbService;
    let prisma: ReturnType<typeof makePrismaMock>;
    let notification: ReturnType<typeof makeNotificationMock>;
    let audit: ReturnType<typeof makeAuditMock>;

    const setup = async () => {
        const nodes = makeNodes();
        prisma = makePrismaMock(nodes);
        audit = makeAuditMock();
        notification = makeNotificationMock();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                IbService,
                { provide: PrismaService, useValue: prisma },
                { provide: AuditService, useValue: audit },
                { provide: NotificationService, useValue: notification },
            ],
        }).compile();

        service = module.get<IbService>(IbService);
    };

    beforeEach(setup);

    it('actor KHÔNG phải Admin -> phải gọi notifyAdminsOnIbAction() với đúng actionType + details', async () => {
        await service.moveIb('moved-1', 'new-parent-1', 'actor-ib-1');

        expect(notification.notifyAdminsOnIbAction).toHaveBeenCalledTimes(1);
        expect(notification.notifyAdminsOnIbAction).toHaveBeenCalledWith(
            expect.objectContaining({
                actorId: 'actor-ib-1',
                actionType: AUDIT_ACTIONS.IB_MOVE_SUBTREE,
                details: expect.objectContaining({
                    targetIbId: 'moved-1',
                    newParentId: 'new-parent-1',
                    oldParentId: 'old-parent-1',
                }),
            }),
        );
    });

    it('actor KHÔNG phải Admin -> auditService.log dùng AUDIT_ACTIONS.IB_MOVE_SUBTREE (không hardcode string)', async () => {
        await service.moveIb('moved-1', 'new-parent-1', 'actor-ib-1');

        expect(audit.log).toHaveBeenCalledWith(
            expect.objectContaining({
                action: AUDIT_ACTIONS.IB_MOVE_SUBTREE,
                targetType: 'IB',
                targetId: 'moved-1',
            }),
        );
        // Giá trị hằng số phải khớp đúng string quy ước, không lệch do gõ tay hardcode ở chỗ khác
        expect(AUDIT_ACTIONS.IB_MOVE_SUBTREE).toBe('IB_MOVE_SUBTREE');
    });

    it('actor LÀ Admin -> KHÔNG gọi notifyAdminsOnIbAction() (Admin không cần tự báo cho Admin)', async () => {
        await service.moveIb('moved-1', 'new-parent-1', 'actor-admin-1');

        expect(notification.notifyAdminsOnIbAction).not.toHaveBeenCalled();
    });

    it('vẫn giữ nguyên hành vi cũ: gửi system notification cho chính IB bị di chuyển', async () => {
        await service.moveIb('moved-1', 'new-parent-1', 'actor-ib-1');

        expect(notification.createSystemNotification).toHaveBeenCalledWith(
            expect.objectContaining({ recipientId: 'moved-1' }),
        );
    });

    it('ném lỗi BadRequestException nếu IB cha không có loại tài khoản mà IB con sở hữu', async () => {
        await expect(service.moveIb('moved-with-std15', 'hien-linh', 'actor-admin-1')).rejects.toThrow(
            'Chuyển nhánh thất bại: IB cha (Hiền Linh) chưa có loại tài khoản (STD15). Vui lòng yêu cầu ADMIN cấp loại tài khoản mà IB cha đang thiếu để có thể chuyển nhánh.',
        );
    });
});