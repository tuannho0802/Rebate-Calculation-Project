import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { CreateMibDto } from './dto/create-mib.dto';
import { CreateSubIbByAdminDto } from './dto/create-sub-ib-by-admin.dto';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../audit/audit.constants';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) { }

  async createAdmin(dto: CreateAdminDto, actorId: string) {
    const existing = await this.prisma.ibNode.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'Email này đã được sử dụng',
      });
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const admin = await this.prisma.ibNode.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: hashedPassword,
        role: 'ADMIN',
        level: 0,
        parentId: null,
      },
    });

    // Audit log cho việc tạo Admin
    await this.auditService.log({
      actorId,
      action: AUDIT_ACTIONS.ADMIN_CREATE,
      targetType: 'ADMIN',
      targetId: admin.id,
      after: { email: admin.email, name: admin.name },
    });

    const { password, ...result } = admin;
    return result;
  }

  async findAllAdmins() {
    return this.prisma.ibNode.findMany({
      where: { role: 'ADMIN', isActive: true },
      select: {
        id: true,
        email: true,
        name: true,
        isRootAdmin: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateAdmin(id: string, dto: UpdateAdminDto, actorId: string) {
    const target = await this.prisma.ibNode.findUnique({ where: { id } });
    if (!target || target.role !== 'ADMIN') {
      throw new NotFoundException({
        code: 'ADMIN_NOT_FOUND',
        message: 'Không tìm thấy Admin',
      });
    }

    if (dto.email && dto.email !== target.email) {
      const existing = await this.prisma.ibNode.findUnique({
        where: { email: dto.email },
      });
      if (existing) {
        throw new ConflictException({
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'Email này đã được sử dụng',
        });
      }
    }

    // Snapshot before (chỉ log email/name, KHÔNG log password)
    const before = { email: target.email, name: target.name };

    const dataToUpdate: any = {};
    if (dto.email) dataToUpdate.email = dto.email;
    if (dto.name) dataToUpdate.name = dto.name;
    if (dto.password) {
      dataToUpdate.password = await bcrypt.hash(dto.password, 10);
    }

    const updated = await this.prisma.ibNode.update({
      where: { id },
      data: dataToUpdate,
      select: {
        id: true,
        email: true,
        name: true,
        isRootAdmin: true,
        isActive: true,
        updatedAt: true,
      },
    });

    // Audit log cho việc cập nhật Admin
    await this.auditService.log({
      actorId,
      action: AUDIT_ACTIONS.ADMIN_UPDATE,
      targetType: 'ADMIN',
      targetId: id,
      before,
      after: { email: updated.email, name: updated.name },
    });

    return updated;
  }

  async softDeleteAdmin(id: string, actorId: string) {
    const target = await this.prisma.ibNode.findUnique({ where: { id } });
    if (!target || target.role !== 'ADMIN') {
      throw new NotFoundException({
        code: 'ADMIN_NOT_FOUND',
        message: 'Không tìm thấy Admin',
      });
    }

    await this.prisma.ibNode.update({
      where: { id },
      data: { isActive: false },
    });

    // Audit log cho việc khóa Admin
    await this.auditService.log({
      actorId,
      action: AUDIT_ACTIONS.ADMIN_DEACTIVATE,
      targetType: 'ADMIN',
      targetId: id,
      after: { isActive: false },
    });

    return { success: true, message: 'Đã khóa Admin' };
  }

  async createMib(dto: CreateMibDto, actorId: string) {
    const existing = await this.prisma.ibNode.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException({
        code: 'IB_EMAIL_TAKEN',
        message: 'Email này đã được sử dụng',
      });
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const accountTypes = (dto.accountTypes && dto.accountTypes.length > 0)
      ? Array.from(new Set(dto.accountTypes))
      : [dto.accountType || 'STD'];
    const accountType = accountTypes[0] || 'STD';

    const mib = await this.prisma.ibNode.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: hashedPassword,
        role: 'IB',
        level: 0,
        parentId: null,
        referralCode: `IB-${Date.now().toString(36).toUpperCase()}`,
        accountType,
        accountTypes,
        phone: dto.phone,
        country: dto.country,
      },
    });

    // Audit log cho việc tạo MIB
    await this.auditService.log({
      actorId,
      action: AUDIT_ACTIONS.MIB_CREATE,
      targetType: 'IB',
      targetId: mib.id,
      after: { email: mib.email, name: mib.name, level: mib.level, accountTypes },
    });

    const { password, ...result } = mib;
    return result;
  }

  async createSubIbByAdmin(dto: CreateSubIbByAdminDto, actorId: string) {
    // Validate targetParentId tồn tại
    const targetParent = await this.prisma.ibNode.findUnique({
      where: { id: dto.targetParentId },
    });
    if (!targetParent) {
      throw new NotFoundException({
        code: 'PARENT_NOT_FOUND',
        message: 'Không tìm thấy node cha',
      });
    }

    // FIX (đảm bảo Admin không tham gia cây IB): chặn Admin chọn 1 tài
    // khoản Admin khác (hoặc chính mình) làm node cha — Admin không bao
    // giờ được là 1 node trong cây IB (level=0 của Admin chỉ là giá trị
    // mặc định lúc tạo, không mang nghĩa "MIB").
    if (targetParent.role === 'ADMIN') {
      throw new ConflictException({
        code: 'PARENT_CANNOT_BE_ADMIN',
        message: 'Không thể chọn tài khoản Admin làm node cha — Admin không tham gia vào cây IB',
      });
    }

    // Validate level cha < 5
    if (targetParent.level >= 5) {
      throw new ConflictException({
        code: 'IB_MAX_LEVEL_REACHED',
        message: 'Không thể tạo thêm cấp dưới',
      });
    }

    // Kiểm tra email trùng
    const existing = await this.prisma.ibNode.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException({
        code: 'IB_EMAIL_TAKEN',
        message: 'Email này đã được sử dụng',
      });
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Kế thừa/validate accountTypes từ parent
    const parentAccountTypes = (targetParent.accountTypes && targetParent.accountTypes.length > 0)
      ? targetParent.accountTypes
      : [targetParent.accountType || 'STD'];

    let accountTypes: string[];
    if (dto.accountTypes && dto.accountTypes.length > 0) {
      const requestedTypes = Array.from(new Set(dto.accountTypes));
      const invalidTypes = requestedTypes.filter((t) => !parentAccountTypes.includes(t));
      if (invalidTypes.length > 0) {
        throw new BadRequestException({
          code: 'IB_INVALID_ACCOUNT_TYPE',
          message: `Loại tài khoản link (${invalidTypes.join(', ')}) vượt quá phạm vi được cấp của cấp trên`,
        });
      }
      accountTypes = requestedTypes;
    } else if (dto.accountType) {
      if (!parentAccountTypes.includes(dto.accountType)) {
        throw new BadRequestException({
          code: 'IB_INVALID_ACCOUNT_TYPE',
          message: `Loại tài khoản link (${dto.accountType}) vượt quá phạm vi được cấp của cấp trên`,
        });
      }
      accountTypes = [dto.accountType];
    } else {
      accountTypes = parentAccountTypes;
    }

    const accountType = accountTypes[0] || 'STD';

    const subIb = await this.prisma.ibNode.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: hashedPassword,
        role: 'IB',
        level: targetParent.level + 1,
        parentId: dto.targetParentId,
        referralCode: `IB-${Date.now().toString(36).toUpperCase()}`,
        accountType,
        accountTypes,
        phone: dto.phone,
        country: dto.country,
        bankAccount: dto.bankAccount,
        paymentInfo: dto.paymentInfo,
        notes: dto.notes,
      },
    });

    // Audit log cho việc Admin tạo Sub-IB
    await this.auditService.log({
      actorId,
      action: AUDIT_ACTIONS.ADMIN_CREATE_SUB_IB,
      targetType: 'IB',
      targetId: subIb.id,
      after: {
        email: subIb.email,
        name: subIb.name,
        level: subIb.level,
        parentId: subIb.parentId,
      },
    });

    const { password, ...result } = subIb;
    return result;
  }
}