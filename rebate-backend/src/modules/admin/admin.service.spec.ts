import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../audit/audit.constants';

// bcrypt.hash thật vẫn chạy được trong unit test (không cần network/DB),
// nhưng mock để test nhanh & không phụ thuộc vào giá trị hash thực tế.
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password_mock'),
}));

describe('AdminService', () => {
  let service: AdminService;
  let prisma: { ibNode: Record<string, jest.Mock> };
  let auditService: { log: jest.Mock };

  const ACTOR_ID = 'actor-uuid-actor';

  beforeEach(async () => {
    prisma = {
      ibNode: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── createAdmin ────────────────────────────────────────────────────────
  describe('createAdmin', () => {
    it('should throw ConflictException if email already exists', async () => {
      prisma.ibNode.findUnique.mockResolvedValue({ id: 'existing-id' });

      await expect(
        service.createAdmin({ email: 'dup@test.com', name: 'Dup', password: '123456' }, ACTOR_ID),
      ).rejects.toThrow(ConflictException);

      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('should create admin and write an ADMIN_CREATE audit log', async () => {
      prisma.ibNode.findUnique.mockResolvedValue(null);
      prisma.ibNode.create.mockResolvedValue({
        id: 'new-admin-id',
        email: 'new@azrebate.com',
        name: 'New Admin',
        password: 'hashed_password_mock',
        role: 'ADMIN',
      });

      const dto = { email: 'new@azrebate.com', name: 'New Admin', password: '123456' };
      const result = await service.createAdmin(dto, ACTOR_ID);

      // Không được trả password ra ngoài
      expect(result).not.toHaveProperty('password');
      expect(result.id).toBe('new-admin-id');

      expect(auditService.log).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: ACTOR_ID,
          action: AUDIT_ACTIONS.ADMIN_CREATE,
          targetType: 'ADMIN',
          targetId: 'new-admin-id',
          after: { email: 'new@azrebate.com', name: 'New Admin' },
        }),
      );

      // Không được log password dưới bất kỳ hình thức nào
      const loggedPayload = auditService.log.mock.calls[0][0];
      expect(JSON.stringify(loggedPayload)).not.toContain('hashed_password_mock');
    });
  });

  // ─── updateAdmin ────────────────────────────────────────────────────────
  describe('updateAdmin', () => {
    it('should throw NotFoundException if target is not an admin', async () => {
      prisma.ibNode.findUnique.mockResolvedValue(null);

      await expect(
        service.updateAdmin('missing-id', { name: 'X' } as any, ACTOR_ID),
      ).rejects.toThrow(NotFoundException);

      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('should update admin and write an ADMIN_UPDATE audit log with before/after', async () => {
      prisma.ibNode.findUnique.mockResolvedValue({
        id: 'admin-id',
        email: 'old@azrebate.com',
        name: 'Old Name',
        role: 'ADMIN',
      });
      prisma.ibNode.update.mockResolvedValue({
        id: 'admin-id',
        email: 'old@azrebate.com',
        name: 'Updated Name',
        isRootAdmin: false,
        isActive: true,
        updatedAt: new Date(),
      });

      await service.updateAdmin('admin-id', { name: 'Updated Name' } as any, ACTOR_ID);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: ACTOR_ID,
          action: AUDIT_ACTIONS.ADMIN_UPDATE,
          targetType: 'ADMIN',
          targetId: 'admin-id',
          before: { email: 'old@azrebate.com', name: 'Old Name' },
          after: { email: 'old@azrebate.com', name: 'Updated Name' },
        }),
      );
    });
  });

  // ─── softDeleteAdmin ────────────────────────────────────────────────────
  describe('softDeleteAdmin', () => {
    it('should throw NotFoundException if target is not an admin', async () => {
      prisma.ibNode.findUnique.mockResolvedValue(null);

      await expect(service.softDeleteAdmin('missing-id', ACTOR_ID)).rejects.toThrow(
        NotFoundException,
      );
      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('should deactivate admin and write an ADMIN_DEACTIVATE audit log', async () => {
      prisma.ibNode.findUnique.mockResolvedValue({ id: 'admin-id', role: 'ADMIN' });
      prisma.ibNode.update.mockResolvedValue({ id: 'admin-id', isActive: false });

      const result = await service.softDeleteAdmin('admin-id', ACTOR_ID);

      expect(result).toEqual({ success: true, message: 'Đã khóa Admin' });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: ACTOR_ID,
          action: AUDIT_ACTIONS.ADMIN_DEACTIVATE,
          targetType: 'ADMIN',
          targetId: 'admin-id',
          after: { isActive: false },
        }),
      );
    });
  });

  // ─── createMib ────────────────────────────────────────────────────────────
  describe('createMib', () => {
    it('should throw ConflictException if email already exists', async () => {
      prisma.ibNode.findUnique.mockResolvedValue({ id: 'existing-mib' });

      await expect(
        service.createMib({ email: 'dup@test.com', name: 'Dup', password: '123456' }, ACTOR_ID),
      ).rejects.toThrow(ConflictException);
      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('should create MIB with level:0, parentId:null and write MIB_CREATE audit log', async () => {
      prisma.ibNode.findUnique.mockResolvedValue(null);
      prisma.ibNode.create.mockResolvedValue({
        id: 'new-mib-id',
        email: 'mib@azrebate.com',
        name: 'New MIB',
        role: 'IB',
        level: 0,
        parentId: null,
        referralCode: 'IB-ABC123',
        accountType: 'STD',
      });

      const dto = { email: 'mib@azrebate.com', name: 'New MIB', password: '123456' };
      const result = await service.createMib(dto, ACTOR_ID);

      expect(result.role).toBe('IB');
      expect(result.level).toBe(0);
      expect(result.parentId).toBeNull();

      expect(auditService.log).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: ACTOR_ID,
          action: AUDIT_ACTIONS.MIB_CREATE,
          targetType: 'IB',
          targetId: 'new-mib-id',
        }),
      );
    });

    it('should use default accountType "STD" if not provided', async () => {
      prisma.ibNode.findUnique.mockResolvedValue(null);
      prisma.ibNode.create.mockImplementation((args: any) => ({
        id: 'new-mib-id',
        email: 'mib@azrebate.com',
        name: 'New MIB',
        role: 'IB',
        level: 0,
        parentId: null,
        accountType: args.data.accountType || 'STD',
        referralCode: 'IB-ABC123',
      }));

      const dto = { email: 'mib@azrebate.com', name: 'New MIB', password: '123456' };
      await service.createMib(dto, ACTOR_ID);

      expect(prisma.ibNode.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ accountType: 'STD' }),
      });
    });
  });

  // ─── createSubIbByAdmin ───────────────────────────────────────────────────
  describe('createSubIbByAdmin', () => {
    it('should throw NotFoundException if targetParentId does not exist', async () => {
      prisma.ibNode.findUnique.mockResolvedValue(null);

      await expect(
        service.createSubIbByAdmin(
          { email: 'sub@test.com', name: 'Sub', password: '123456', targetParentId: 'fake-id' } as any,
          ACTOR_ID,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if parent is already at level 5', async () => {
      prisma.ibNode.findUnique.mockResolvedValue({ id: 'parent-id', level: 5 });

      await expect(
        service.createSubIbByAdmin(
          { email: 'sub@test.com', name: 'Sub', password: '123456', targetParentId: 'parent-id' } as any,
          ACTOR_ID,
        ),
      ).rejects.toThrow(ConflictException);
      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('should create sub-IB under specified parent with level = parent.level + 1', async () => {
      prisma.ibNode.findUnique
        .mockResolvedValueOnce({ id: 'parent-id', level: 2, accountType: 'PRO' }) // findParent
        .mockResolvedValueOnce(null); // email check
      prisma.ibNode.create.mockResolvedValue({
        id: 'sub-id',
        email: 'sub@azrebate.com',
        name: 'Sub IB',
        role: 'IB',
        level: 3,
        parentId: 'parent-id',
        referralCode: 'IB-XYZ789',
        accountType: 'PRO',
      });

      const dto = {
        email: 'sub@azrebate.com',
        name: 'Sub IB',
        password: '123456',
        targetParentId: 'parent-id',
      };
      const result = await service.createSubIbByAdmin(dto, ACTOR_ID);

      expect(result.level).toBe(3); // 2 + 1
      expect(result.parentId).toBe('parent-id');

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: ACTOR_ID,
          action: AUDIT_ACTIONS.ADMIN_CREATE_SUB_IB,
          targetType: 'IB',
          targetId: 'sub-id',
        }),
      );
    });

    it('should inherit accountType from parent if not provided in DTO', async () => {
      prisma.ibNode.findUnique
        .mockResolvedValueOnce({ id: 'parent-id', level: 1, accountType: 'PRO' })
        .mockResolvedValueOnce(null);
      prisma.ibNode.create.mockImplementation((args: any) => ({
        ...args.data,
        id: 'sub-id',
        referralCode: 'IB-XYZ789',
      }));

      const dto = {
        email: 'sub@azrebate.com',
        name: 'Sub IB',
        password: '123456',
        targetParentId: 'parent-id',
      };
      await service.createSubIbByAdmin(dto, ACTOR_ID);

      expect(prisma.ibNode.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ accountType: 'PRO' }),
      });
    });
  });
});
