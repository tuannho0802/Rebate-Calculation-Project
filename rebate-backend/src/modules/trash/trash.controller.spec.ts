import { Test, TestingModule } from '@nestjs/testing';
import { TrashController } from './trash.controller';
import { TrashService } from './trash.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ProtectRootAdminGuard } from '../../common/guards/protect-root-admin.guard';

describe('TrashController', () => {
  let controller: TrashController;
  let trashService: {
    findAllTrash: jest.Mock;
    restore: jest.Mock;
    hardDelete: jest.Mock;
  };

  beforeEach(async () => {
    trashService = {
      findAllTrash: jest.fn().mockResolvedValue([]),
      restore: jest.fn().mockResolvedValue({ success: true, message: 'Khôi phục thành công' }),
      hardDelete: jest.fn().mockResolvedValue({ success: true, message: 'Đã xóa vĩnh viễn tài khoản' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TrashController],
      providers: [{ provide: TrashService, useValue: trashService }],
    })
      // Guard thật (JwtAuthGuard/RolesGuard/ProtectRootAdminGuard) cần PrismaService/
      // passport strategy thật — không liên quan tới logic của TrashController, nên
      // override bằng guard giả (luôn cho qua) để test đúng phạm vi: controller.
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ProtectRootAdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TrashController>(TrashController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('findAll() gọi trashService.findAllTrash()', async () => {
    await controller.findAll();
    expect(trashService.findAllTrash).toHaveBeenCalledTimes(1);
  });

  it('restore() lấy IP từ x-forwarded-for nếu có, gọi trashService.restore() với đúng id/actorId/ip', async () => {
    const fakeReq: any = {
      headers: { 'x-forwarded-for': '9.9.9.9' },
      ip: '127.0.0.1',
    };
    const fakeUser = { sub: 'admin-id' };

    await controller.restore('ib-1', fakeUser, fakeReq);

    expect(trashService.restore).toHaveBeenCalledWith('ib-1', 'admin-id', '9.9.9.9');
  });

  it('restore() fallback về req.ip khi không có header x-forwarded-for', async () => {
    const fakeReq: any = { headers: {}, ip: '127.0.0.1' };
    const fakeUser = { sub: 'admin-id' };

    await controller.restore('ib-1', fakeUser, fakeReq);

    expect(trashService.restore).toHaveBeenCalledWith('ib-1', 'admin-id', '127.0.0.1');
  });

  it('hardDelete() gọi trashService.hardDelete() với đúng id', async () => {
    await controller.hardDelete('ib-1');
    expect(trashService.hardDelete).toHaveBeenCalledWith('ib-1');
  });
});