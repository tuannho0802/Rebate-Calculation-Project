import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateIbDto } from './dto/create-ib.dto';
import { UpdateIbDto } from './dto/update-ib.dto';
import * as bcrypt from 'bcrypt';
import { AssetType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../audit/audit.constants';
import { getSubtreeIds } from '../../common/utils/subtree.util';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class IbService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
  ) {}

  async getMe(ibId: string) {
    const user = await this.prisma.ibNode.findUnique({
      where: { id: ibId },
      select: {
        id: true,
        name: true,
        email: true,
        level: true,
        parentId: true,
        accountType: true,
        accountTypeTemplates: true,
        markupLinkTemplates: true,
        createdAt: true,
        parent: {
          select: {
            email: true,
            name: true,
          }
        }
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'IB_NOT_FOUND',
        message: 'Không tìm thấy IB',
      });
    }

    const totalChildren = await this.prisma.ibNode.count({
      where: { parentId: ibId },
    });

    return {
      ...user,
      totalChildren,
    };
  }

  async getTree(ibId: string, depth: '1' | 'all', role?: string) {
    const current = await this.prisma.ibNode.findUnique({
      where: { id: ibId },
    });

    if (!current) {
      throw new NotFoundException({
        code: 'IB_NOT_FOUND',
        message: 'Không tìm thấy IB',
      });
    }

    // ADMIN: full tree (cho phép depth=all, load toàn bộ cây từ root)
    // IB: luôn ép depth=1 — chỉ trả về chính mình + con trực tiếp
    const effectiveDepth = role === 'ADMIN' ? depth : '1';

    if (effectiveDepth === 'all') {
      // Full tree — dùng BFS in-memory
      const allNodes = await this.prisma.ibNode.findMany();
      const map = new Map<string, any>();
      allNodes.forEach((node: any) => {
        map.set(node.id, {
          id: node.id,
          name: node.name,
          email: node.email,
          level: node.level,
          accountType: node.accountType,
          isActive: node.isActive,
          children: [],
        });
      });
      allNodes.forEach((node: any) => {
        if (node.parentId) {
          const parent = map.get(node.parentId);
          if (parent) parent.children.push(map.get(node.id));
        }
      });
      if (role === 'ADMIN') {
        return allNodes
          .filter((node: any) => node.parentId === null && node.role === 'IB')
          .map((node: any) => map.get(node.id));
      }
      return map.get(ibId);
    }

    // IB (depth=1): chỉ trả chính mình + con trực tiếp, không đệ quy
    const children = await this.prisma.ibNode.findMany({
      where: { parentId: ibId },
      select: { id: true, name: true, email: true, level: true, accountType: true, isActive: true },
    });

    return {
      id: current.id,
      name: current.name,
      email: current.email,
      level: current.level,
      accountType: current.accountType,
      isActive: current.isActive,
      children: children.map((c) => ({ ...c, children: [] })),
    };
  }

  async getById(id: string) {
    const user = await this.prisma.ibNode.findUnique({
      where: { id },
      include: {
        rebateConfig: true,
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'IB_NOT_FOUND',
        message: 'Không tìm thấy IB',
      });
    }

    const formattedConfig = {
      ibId: user.id,
      assets: user.rebateConfig.map((config: any) => ({
        assetType: config.assetType,
        rebatePips: Number(config.rebatePips),
        markupPips: Number(config.markupPips),
        markupPercent: Number(config.markupPercent),
        maxPips: Number(config.maxPips),
      })),
      updatedAt: user.updatedAt,
    };

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      level: user.level,
      parentId: user.parentId,
      accountType: user.accountType,
      rebateConfig: formattedConfig,
      createdAt: user.createdAt,
    };
  }

  async create(currentUserId: string, currentUserLevel: number, createIbDto: CreateIbDto) {
    if (currentUserLevel >= 5) {
      throw new UnprocessableEntityException({
        code: 'IB_MAX_LEVEL_REACHED',
        message: 'Không thể tạo thêm cấp dưới',
      });
    }

    const existingUser = await this.prisma.ibNode.findUnique({
      where: { email: createIbDto.email },
    });

    if (existingUser) {
      throw new UnprocessableEntityException({
        code: 'IB_EMAIL_TAKEN',
        message: 'Email này đã được sử dụng',
      });
    }

    const hashedPassword = await bcrypt.hash(createIbDto.password, 10);
    const newLevel = currentUserLevel + 1;

    let parentAccountType = createIbDto.accountType || 'SEA STD';
    if (currentUserLevel > 0) {
      const parentNode = await this.prisma.ibNode.findUnique({ where: { id: currentUserId }});
      if (parentNode?.accountType) {
        parentAccountType = parentNode.accountType;
      }
    }

    const newIb = await this.prisma.$transaction(async (tx: any) => {
      const referralCode = `IB-${Date.now().toString(36).toUpperCase()}`;
      const ib = await tx.ibNode.create({
        data: {
          email: createIbDto.email,
          name: createIbDto.name,
          password: hashedPassword,
          level: newLevel,
          parentId: currentUserId,
          phone: createIbDto.phone,
          country: createIbDto.country,
          accountType: parentAccountType,
          bankAccount: createIbDto.bankAccount,
          paymentInfo: createIbDto.paymentInfo,
          notes: createIbDto.notes,
          referralCode,
        },
      });

      // Get parent's configurations to set maxPips limit for the child
      const parentConfigs = await tx.rebateConfig.findMany({
        where: { ibId: currentUserId },
      });

      // Initialize child's config for each asset type
      const defaultConfigs = Object.values(AssetType).map((assetType) => {
        const parentConfig = parentConfigs.find((pc: any) => pc.assetType === assetType);
        // Child's max allowed pips is the parent's allocated markupPips
        const maxPips = parentConfig ? Number(parentConfig.markupPips) : 0;

        return {
          ibId: ib.id,
          assetType,
          rebatePips: 0,
          markupPips: 0,
          markupPercent: 100,
          maxPips,
        };
      });

      if (defaultConfigs.length > 0) {
        await tx.rebateConfig.createMany({
          data: defaultConfigs,
        });
      }

      return ib;
    });

    await this.auditService.log({
      actorId: currentUserId,
      action: AUDIT_ACTIONS.IB_CREATE,
      targetType: 'IB',
      targetId: newIb.id,
      after: { email: newIb.email, name: newIb.name, level: newIb.level },
    });

    // System notification: IB_JOINED — gửi cho parent
    this.notificationService.createSystemNotification({
      recipientId: currentUserId,
      type: NotificationType.IB_JOINED,
      title: 'Dai ly moi da tham gia',
      body: `${newIb.name} (${newIb.email}) da tham gia vao nhom cua ban.`,
      metadata: { newIbId: newIb.id },
    });

    return {
      id: newIb.id,
      name: newIb.name,
      email: newIb.email,
      level: newIb.level,
      parentId: newIb.parentId,
      referralCode: newIb.referralCode,
    };
  }

  async updateIb(id: string, dto: UpdateIbDto, currentUserId?: string) {
    // Lấy before để audit
    const existing = await this.prisma.ibNode.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'IB_NOT_FOUND', message: 'Không tìm thấy IB' });
    }

    if (dto.email) {
      const emailTaken = await this.prisma.ibNode.findUnique({ where: { email: dto.email } });
      if (emailTaken && emailTaken.id !== id) {
        throw new UnprocessableEntityException({
          code: 'IB_EMAIL_TAKEN',
          message: 'Email này đã được sử dụng',
        });
      }
    }

    const before = { name: existing.name, email: existing.email };

    const updated = await this.prisma.ibNode.update({
      where: { id },
      data: dto,
    });

    const after = { name: updated.name, email: updated.email };

    if (currentUserId) {
      await this.auditService.log({
        actorId: currentUserId,
        action: AUDIT_ACTIONS.IB_UPDATE,
        targetType: 'IB',
        targetId: id,
        before,
        after,
      });
    }

    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      level: updated.level,
      parentId: updated.parentId,
      accountType: updated.accountType,
    };
  }

  async deactivateIb(id: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new UnprocessableEntityException({
        code: 'IB_ACTION_NOT_ALLOWED',
        message: 'Không thể deactivate chính mình',
      });
    }

    const node = await this.prisma.ibNode.findUnique({ where: { id } });
    if (!node) {
      throw new NotFoundException({
        code: 'IB_NOT_FOUND',
        message: 'Không tìm thấy IB',
      });
    }

    if (node.level === 0) {
      throw new UnprocessableEntityException({
        code: 'IB_ACTION_NOT_ALLOWED',
        message: 'Không thể deactivate MIB',
      });
    }

    await this.prisma.ibNode.update({
      where: { id },
      data: { isActive: false },
    });

    await this.auditService.log({
      actorId: currentUserId,
      action: AUDIT_ACTIONS.IB_DEACTIVATE,
      targetType: 'IB',
      targetId: id,
      after: { isActive: false },
    });

    // System notification: IB_DEACTIVATED — gửi cho IB bị deactivate
    this.notificationService.createSystemNotification({
      recipientId: id,
      type: NotificationType.IB_DEACTIVATED,
      title: 'Tai khoan da bi vo hieu hoa',
      body: 'Tai khoan cua ban da bi vo hieu hoa. Vui long lien he cap tren de biet them thong tin.',
    });

    return { message: 'IB đã bị deactivate' };
  }

  async getChildren(id: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.ibNode.findMany({
        where: { parentId: id },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.ibNode.count({ where: { parentId: id } }),
    ]);

    return {
      data: data.map((child: any) => ({
        id: child.id,
        name: child.name,
        email: child.email,
        level: child.level,
        isActive: child.isActive,
        createdAt: child.createdAt,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * PATCH /ib/:id/restore — khôi phục IB đã bị vô hiệu hóa
   */
  async restoreIb(ibId: string, currentUserId: string, ipAddress?: string) {
    const ib = await this.prisma.ibNode.findUnique({ where: { id: ibId } });

    if (!ib) throw new NotFoundException({ code: 'IB_NOT_FOUND' });

    if (ib.isActive) {
      throw new UnprocessableEntityException({
        code: 'IB_ALREADY_ACTIVE',
        message: 'Tài khoản này đang hoạt động, không cần khôi phục',
      });
    }

    const updated = await this.prisma.ibNode.update({
      where: { id: ibId },
      data: { isActive: true },
      select: {
        id: true,
        email: true,
        name: true,
        level: true,
        isActive: true,
        parentId: true,
      },
    });

    await this.auditService.log({
      actorId: currentUserId,
      action: AUDIT_ACTIONS.IB_RESTORE,
      targetType: 'IB',
      targetId: ibId,
      after: { isActive: true },
      ipAddress,
    });

    // System notification: IB_RESTORED — gửi cho IB được khôi phục
    this.notificationService.createSystemNotification({
      recipientId: ibId,
      type: NotificationType.IB_RESTORED,
      title: 'Tai khoan da duoc khoi phuc',
      body: 'Tai khoan cua ban da duoc khoi phuc va co the dang nhap binh thuong.',
    });

    return updated;
  }

  async updateProfile(callerId: string, callerLevel: number, targetIbId: string, dto: UpdateIbDto, callerRole?: string) {
    // ADMIN bypass — cho phép sửa bất kỳ IB nào
    // Lv0/MIB: cũng bypass (level === 0)
    // Lv1+: chỉ được sửa con trực tiếp (parentId === callerId) hoặc chính mình
    if (callerRole !== 'ADMIN' && callerLevel > 0 && callerId !== targetIbId) {
      const target = await this.prisma.ibNode.findUnique({ where: { id: targetIbId }, select: { parentId: true } });
      if (!target || target.parentId !== callerId) {
        throw new ForbiddenException({ code: 'IB_NOT_IN_SUBTREE', message: 'IB này không thuộc subtree của bạn' });
      }
    }

    const ib = await this.prisma.ibNode.findUnique({ where: { id: targetIbId } });
    if (!ib) throw new NotFoundException({ code: 'IB_NOT_FOUND' });

    // Validate JSON strings
    if (dto.bankAccount) {
      try { JSON.parse(dto.bankAccount); } catch { throw new ForbiddenException({ code: 'INVALID_JSON', message: 'bankAccount phải là JSON hợp lệ' }); }
    }
    if (dto.paymentInfo) {
      try { JSON.parse(dto.paymentInfo); } catch { throw new ForbiddenException({ code: 'INVALID_JSON', message: 'paymentInfo phải là JSON hợp lệ' }); }
    }

    const updated = await this.prisma.ibNode.update({
      where: { id: targetIbId },
      data: {
        phone: dto.phone,
        country: dto.country,
        bankAccount: dto.bankAccount,
        paymentInfo: dto.paymentInfo,
        notes: dto.notes,
        profileUpdatedAt: new Date(),
      },
      select: {
        id: true, email: true, name: true, level: true, phone: true, country: true, bankAccount: true, paymentInfo: true, notes: true, referralCode: true, profileUpdatedAt: true, wallet: { select: { balance: true, totalEarned: true } }
      }
    });

    await this.auditService.log({
      actorId: callerId,
      action: AUDIT_ACTIONS.IB_PROFILE_UPDATE,
      targetType: 'IB',
      targetId: targetIbId,
      before: { phone: ib.phone, country: ib.country },
      after: { phone: dto.phone, country: dto.country },
    });

    // Parse JSON
    return {
      ...updated,
      bankAccount: updated.bankAccount ? JSON.parse(updated.bankAccount) : null,
      paymentInfo: updated.paymentInfo ? JSON.parse(updated.paymentInfo) : null,
    };
  }

  async getProfile(callerId: string, callerLevel: number, targetIbId: string, callerRole?: string) {
    if (callerRole !== 'ADMIN' && callerLevel > 0 && callerId !== targetIbId) {
      const target = await this.prisma.ibNode.findUnique({ where: { id: targetIbId }, select: { parentId: true } });
      if (!target || target.parentId !== callerId) {
        throw new ForbiddenException({ code: 'IB_NOT_IN_SUBTREE', message: 'IB này không thuộc subtree của bạn' });
      }
    }

    const ib = await this.prisma.ibNode.findUnique({
      where: { id: targetIbId },
      select: {
        id: true, email: true, name: true, level: true, phone: true, country: true, bankAccount: true, paymentInfo: true, notes: true, referralCode: true, profileUpdatedAt: true, wallet: { select: { balance: true, totalEarned: true } }
      }
    });

    if (!ib) throw new NotFoundException({ code: 'IB_NOT_FOUND' });

    return {
      ...ib,
      bankAccount: ib.bankAccount ? JSON.parse(ib.bankAccount) : null,
      paymentInfo: ib.paymentInfo ? JSON.parse(ib.paymentInfo) : null,
      wallet: ib.wallet || { balance: 0, totalEarned: 0 },
    };
  }

  /**
   * GET /ib/search — tìm IB theo email hoặc tên trong subtree của mình
   */
  async searchIb(
    currentUserId: string,
    q: string | undefined,
    includeInactive: boolean,
    page: number,
    limit: number,
    callerRole?: string,
  ) {
    let searchableIds: string[];

    if (callerRole === 'ADMIN') {
      // ADMIN: tìm toàn hệ thống (trừ chính Admin)
      const all = await this.prisma.ibNode.findMany({ select: { id: true } });
      searchableIds = all.map((n) => n.id).filter((id) => id !== currentUserId);
    } else {
      // IB: chỉ tìm trong con trực tiếp (parentId = currentUserId)
      const children = await this.prisma.ibNode.findMany({
        where: { parentId: currentUserId },
        select: { id: true },
      });
      searchableIds = children.map((c) => c.id);
    }

    const where: any = {
      id: { in: searchableIds },
    };

    if (q && typeof q === 'string' && q.trim().length >= 2) {
      const keyword = q.trim();
      where.OR = [
        { email: { contains: keyword, mode: 'insensitive' } },
        { name: { contains: keyword, mode: 'insensitive' } },
      ];
    } else if (q && typeof q === 'string' && q.trim().length > 0) {
      throw new BadRequestException({
        code: 'SEARCH_QUERY_TOO_SHORT',
        message: 'Từ khóa tìm kiếm phải có ít nhất 2 ký tự',
      });
    }

    if (!includeInactive) {
      where.isActive = true;
    }

    const [items, total] = await Promise.all([
      this.prisma.ibNode.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          level: true,
          isActive: true,
          parentId: true,
          createdAt: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { level: 'asc' },
      }),
      this.prisma.ibNode.count({ where }),
    ]);

    return {
      data: items,
      meta: { page, limit, total, query: q?.trim() || '' },
    };
  }

  /**
   * GET /ib/:id/performance — hiệu suất 1 IB theo tháng
   */
  async getIbPerformance(currentUserId: string, ibId: string, month?: string, callerRole?: string) {
    // 1. Verify ibId: ADMIN bypass; IB chỉ được xem chính mình hoặc con trực tiếp
    if (callerRole !== 'ADMIN' && currentUserId !== ibId) {
      const target = await this.prisma.ibNode.findUnique({ where: { id: ibId }, select: { parentId: true } });
      if (!target || target.parentId !== currentUserId) {
        throw new ForbiddenException({ code: 'IB_NOT_IN_SUBTREE' });
      }
    }

    // 2. Validate và parse month format YYYY-MM
    let periodStart: Date;
    let periodEnd: Date;
    let periodMonth: string;

    if (month) {
      const monthRegex = /^\d{4}-\d{2}$/;
      if (!monthRegex.test(month)) {
        throw new BadRequestException({
          code: 'INVALID_MONTH_FORMAT',
          message: 'Định dạng tháng phải là YYYY-MM (ví dụ: 2026-06)',
        });
      }
      const [year, mon] = month.split('-').map(Number);
      if (mon < 1 || mon > 12) {
        throw new BadRequestException({
          code: 'INVALID_MONTH_FORMAT',
          message: 'Tháng phải nằm trong khoảng 01-12',
        });
      }
      periodStart = new Date(year, mon - 1, 1);
      periodEnd = new Date(year, mon, 0, 23, 59, 59, 999);
      periodMonth = month;
    } else {
      const now = new Date();
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      periodMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    // 3. Chỉ tính riêng ibId (không cộng dồn downline theo nghiệp vụ mới)
    const ibSubtree = [ibId];

    // 4. Aggregate
    const [byAsset, overall, ibInfo] = await Promise.all([
      this.prisma.rebateTransaction.groupBy({
        by: ['assetType'],
        where: { ibId: { in: ibSubtree }, tradedAt: { gte: periodStart, lte: periodEnd } },
        _sum: { lots: true, rebateAmount: true },
        _count: { id: true },
      }),
      this.prisma.rebateTransaction.aggregate({
        where: { ibId: { in: ibSubtree }, tradedAt: { gte: periodStart, lte: periodEnd } },
        _sum: { lots: true, rebateAmount: true },
        _count: { id: true },
      }),
      this.prisma.ibNode.findUnique({
        where: { id: ibId },
        select: { id: true, email: true, name: true, level: true },
      }),
    ]);

    return {
      ib: ibInfo,
      period: { month: periodMonth, start: periodStart, end: periodEnd },
      overall: {
        transactionCount: overall._count.id,
        totalLots: Number(overall._sum.lots ?? 0),
        totalRebateUsd: Number(overall._sum.rebateAmount ?? 0),
      },
      byAssetType: byAsset.map((a) => ({
        assetType: a.assetType,
        count: a._count.id,
        lots: Number(a._sum.lots ?? 0),
        rebateUsd: Number(a._sum.rebateAmount ?? 0),
      })),
    };
  }

  /**
   * GET /ib/leaderboard — top IB trong subtree theo lots tháng này
   */
  async getLeaderboard(currentUserId: string, limit = 10) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // Leaderboard luôn chỉ so sánh con trực tiếp của caller (kể cả Admin)
    const children = await this.prisma.ibNode.findMany({
      where: { parentId: currentUserId },
      select: { id: true },
    });
    const childIds = children.map((c) => c.id);

    const grouped = await this.prisma.rebateTransaction.groupBy({
      by: ['ibId'],
      where: { ibId: { in: childIds }, tradedAt: { gte: monthStart } },
      _sum: { lots: true, rebateAmount: true },
      _count: { id: true },
      orderBy: { _sum: { lots: 'desc' } },
      take: limit,
    });

    const ibIds = grouped.map((g) => g.ibId);
    const nodes = await this.prisma.ibNode.findMany({
      where: { id: { in: ibIds } },
      select: { id: true, email: true, name: true, level: true },
    });
    const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));

    return grouped.map((g, idx) => ({
      rank: idx + 1,
      ib: nodeMap[g.ibId],
      monthLots: Number(g._sum.lots ?? 0),
      monthRebateUsd: Number(g._sum.rebateAmount ?? 0),
      transactionCount: g._count.id,
    }));
  }

  /**
   * PATCH /ib/:id/reset-password — Lv0 only.
   * Reset mật khẩu của một sub-IB bất kỳ trong subtree.
   * SubtreeGuard đảm bảo target nằm trong subtree (bảo vệ cross-tree với hệ thống nhiều MIB).
   */
  async resetPassword(currentUserId: string, targetIbId: string, newPassword: string) {
    const target = await this.prisma.ibNode.findUnique({
      where: { id: targetIbId },
    });

    if (!target) {
      throw new NotFoundException({
        code: 'IB_NOT_FOUND',
        message: 'Không tìm thấy IB',
      });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await this.prisma.ibNode.update({
      where: { id: targetIbId },
      data: { password: hashed },
    });

    await this.auditService.log({
      actorId: currentUserId,
      action: AUDIT_ACTIONS.IB_PASSWORD_RESET,
      targetType: 'IB',
      targetId: targetIbId,
      after: { passwordChanged: true },
    });

    return { message: 'Da dat lai mat khau thanh cong' };
  }

}
