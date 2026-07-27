import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ProtectRootAdminGuard } from '../../common/guards/protect-root-admin.guard';

describe('AdminController', () => {
  let controller: AdminController;
  let adminService: Record<string, jest.Mock>;

  const mockUser = { sub: 'actor-uuid-actor', role: 'ADMIN' };
  const allowAllGuard = { canActivate: () => true };

  beforeEach(async () => {
    adminService = {
      createAdmin: jest.fn().mockResolvedValue({ id: 'new-admin-id' }),
      findAllAdmins: jest.fn().mockResolvedValue([]),
      updateAdmin: jest.fn().mockResolvedValue({ id: 'admin-id' }),
      softDeleteAdmin: jest.fn().mockResolvedValue({ success: true, message: 'Đã khóa Admin' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [{ provide: AdminService, useValue: adminService }],
    })
      // Unit test controller chỉ test wiring/forwarding tham số, không test guard ở đây
      // (guard có test riêng của nó). Override để tránh phải resolve dependency thật
      // (vd. PrismaService bên trong ProtectRootAdminGuard).
      .overrideGuard(JwtAuthGuard)
      .useValue(allowAllGuard)
      .overrideGuard(RolesGuard)
      .useValue(allowAllGuard)
      .overrideGuard(ProtectRootAdminGuard)
      .useValue(allowAllGuard)
      .compile();

    controller = module.get<AdminController>(AdminController);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create() should forward dto and actorId (user.sub) to AdminService.createAdmin', async () => {
    const dto = { email: 'a@azrebate.com', name: 'A', password: '123456' };

    await controller.create(mockUser, dto as any);

    expect(adminService.createAdmin).toHaveBeenCalledWith(dto, mockUser.sub);
  });

  it('findAll() should call AdminService.findAllAdmins', async () => {
    await controller.findAll();
    expect(adminService.findAllAdmins).toHaveBeenCalledTimes(1);
  });

  it('update() should forward id, dto and actorId (user.sub) to AdminService.updateAdmin', async () => {
    const dto = { name: 'Updated' };

    await controller.update(mockUser, 'admin-id', dto as any);

    expect(adminService.updateAdmin).toHaveBeenCalledWith('admin-id', dto, mockUser.sub);
  });

  it('remove() should forward id and actorId (user.sub) to AdminService.softDeleteAdmin', async () => {
    await controller.remove(mockUser, 'admin-id');

    expect(adminService.softDeleteAdmin).toHaveBeenCalledWith('admin-id', mockUser.sub);
  });
});