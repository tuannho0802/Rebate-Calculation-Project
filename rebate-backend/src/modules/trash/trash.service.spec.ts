import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TrashService } from './trash.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../audit/audit.constants';
import { NotificationService } from '../notification/notification.service';

function makePrismaMock() {
  return {
    ibNode: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    },
    rebateConfig: { count: jest.fn().mockResolvedValue(0) },
    rebateTransaction: { count: jest.fn().mockResolvedValue(0) },
    wallet: { count: jest.fn().mockResolvedValue(0) },
    payout: { count: jest.fn().mockResolvedValue(0) },
    auditLog: { count: jest.fn().mockResolvedValue(0) },
    rebateConfigHistory: { count: jest.fn().mockResolvedValue(0) },
    notification: { count: jest.fn().mockResolvedValue(0) },
    refreshToken: { count: jest.fn().mockResolvedValue(0) },
    accountTypeTemplate: { count: jest.fn().mockResolvedValue(0) },
    markupLinkTemplate: { count: jest.fn().mockResolvedValue(0) },
  };
}

describe('TrashService', () => {
  let service: TrashService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let audit: { log: jest.Mock };
  let notification: { createSystemNotification: jest.Mock };

  beforeEach(async () => {
    prisma = makePrismaMock();
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    notification = { createSystemNotification: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrashService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: NotificationService, useValue: notification },
      ],
    }).compile();

    service = module.get<TrashService>(TrashService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('restore', () => {
    it('reject nếu không tìm thấy tài khoản', async () => {
      prisma.ibNode.findUnique.mockResolvedValue(null);

      await expect(service.restore('missing-id', 'admin-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('reject nếu tài khoản chưa bị khóa (không nằm trong trash)', async () => {
      prisma.ibNode.findUnique.mockResolvedValue({ id: 'ib-1', isActive: true });

      await expect(service.restore('ib-1', 'admin-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('khôi phục thành công: update isActive, ghi AuditLog, gửi notification cho IB', async () => {
      prisma.ibNode.findUnique.mockResolvedValue({ id: 'ib-1', isActive: false });

      const result = await service.restore('ib-1', 'admin-id', '1.2.3.4');

      expect(result).toEqual({ success: true, message: 'Khôi phục thành công' });
      expect(prisma.ibNode.update).toHaveBeenCalledWith({
        where: { id: 'ib-1' },
        data: { isActive: true },
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'admin-id',
          action: AUDIT_ACTIONS.IB_RESTORE,
          targetType: 'IB',
          targetId: 'ib-1',
          ipAddress: '1.2.3.4',
        }),
      );
      expect(notification.createSystemNotification).toHaveBeenCalledWith(
        expect.objectContaining({ recipientId: 'ib-1' }),
      );
    });
  });

  describe('hardDelete', () => {
    it('reject nếu không tìm thấy tài khoản', async () => {
      prisma.ibNode.findUnique.mockResolvedValue(null);

      await expect(service.hardDelete('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('reject nếu tài khoản còn dữ liệu liên quan (ví dụ còn rebate config)', async () => {
      prisma.ibNode.findUnique.mockResolvedValue({ id: 'ib-1' });
      prisma.rebateConfig.count.mockResolvedValue(2);

      await expect(service.hardDelete('ib-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.ibNode.delete).not.toHaveBeenCalled();
    });

    it('xóa vĩnh viễn thành công khi không còn dữ liệu liên quan nào', async () => {
      prisma.ibNode.findUnique.mockResolvedValue({ id: 'ib-1' });
      // Tất cả count() đều mock sẵn = 0 (makePrismaMock), nên không cần set thêm

      const result = await service.hardDelete('ib-1');

      expect(result).toEqual({ success: true, message: 'Đã xóa vĩnh viễn tài khoản' });
      expect(prisma.ibNode.delete).toHaveBeenCalledWith({ where: { id: 'ib-1' } });
    });
  });
});