import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { getDescendantIds } from '../../common/utils/subtree.util';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryAuditDto } from './dto/query-audit.dto';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ghi audit log — gọi từ các service khác sau mỗi thao tác quan trọng.
   * Không throw exception nếu lỗi — audit log không được block main flow.
   */
  async log(params: {
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    ipAddress?: string;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: params.actorId,
          action: params.action,
          targetType: params.targetType,
          targetId: params.targetId,
          before: params.before !== undefined
            ? (params.before as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          after: params.after !== undefined
            ? (params.after as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          ipAddress: params.ipAddress,
        },
      });
    } catch (err) {
      // Log error nhưng không throw — audit không được làm crash main flow
      console.error('[AuditService] Failed to write audit log:', err);
    }
  }


  /**
   * GET /audit/logs — lấy danh sách audit log trong subtree của currentUser
   */
  async getLogs(currentUserId: string, query: QueryAuditDto, callerRole?: string) {
    const where: any = {};
    
    if (callerRole !== 'ADMIN') {
      const myDescendantIds = await getDescendantIds(this.prisma, currentUserId);
      where.actorId = { in: myDescendantIds };
    }

    if (query.actorId) where.actorId = query.actorId;
    if (query.targetId) where.targetId = query.targetId;
    if (query.action) where.action = query.action;
    if (query.targetType) where.targetType = query.targetType;

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) {
        // to ngày cuối — bao gồm cả cuối ngày đó
        const toDate = new Date(query.to);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    // Lấy danh sách audit log đã bị user này ẩn
    const dismissedLogIds = await this.prisma.auditLogDismissal.findMany({
      where: { userId: currentUserId },
      select: { auditLogId: true },
    });
    const dismissedIds = dismissedLogIds.map((d) => d.auditLogId);

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: {
          ...where,
          id: dismissedIds.length ? { notIn: dismissedIds } : undefined,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          actor: {
            select: { id: true, email: true, level: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where: dismissedIds.length ? { ...where, id: { notIn: dismissedIds } } : where }),
    ]);

    return {
      data: items,
      meta: { page, limit, total },
    };
  }

  /**
   * Ẩn một audit log khỏi danh sách của riêng user này (KHÔNG xoá thật dữ liệu).
   */
  async dismissLog(currentUserId: string, auditLogId: string) {
    const log = await this.prisma.auditLog.findUnique({ where: { id: auditLogId } });
    if (!log) throw new NotFoundException({ code: 'AUDIT_LOG_NOT_FOUND' });

    // Không cần check subtree ở đây — nếu user đã thấy được log này qua
    // getLogs() (nghĩa là nó nằm trong phạm vi quyền xem của họ), họ được
    // phép ẩn nó khỏi danh sách CỦA CHÍNH HỌ. Việc ẩn không ảnh hưởng gì
    // tới người khác (Admin, hoặc MIB khác nếu có overlap quyền xem).
    await this.prisma.auditLogDismissal.upsert({
      where: { auditLogId_userId: { auditLogId, userId: currentUserId } },
      create: { auditLogId, userId: currentUserId },
      update: {},
    });

    return { message: 'Đã ẩn khỏi danh sách của bạn' };
  }
}
