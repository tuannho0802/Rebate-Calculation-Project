import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
  async getLogs(currentUserId: string, query: QueryAuditDto) {
    // Lấy subtree IDs của currentUser để filter logs chỉ trong phạm vi mình quản lý
    const subtreeIds = await this.getSubtreeIds(currentUserId);

    const where: any = {
      actorId: { in: subtreeIds },
    };

    if (query.actorId) where.actorId = query.actorId;
    if (query.targetId) where.targetId = query.targetId;
    if (query.action) where.action = query.action;

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

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          actor: {
            select: { id: true, email: true, level: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: items,
      meta: { page, limit, total },
    };
  }

  /**
   * Helper — lấy tất cả IDs trong subtree của rootId (bao gồm rootId).
   * Dùng CTE recursive để tránh N+1 query.
   */
  private async getSubtreeIds(rootId: string): Promise<string[]> {
    const result = await this.prisma.$queryRaw<{ id: string }[]>`
      WITH RECURSIVE subtree AS (
        SELECT id FROM ib_nodes WHERE id = ${rootId}
        UNION ALL
        SELECT n.id FROM ib_nodes n
        INNER JOIN subtree s ON n."parentId" = s.id
      )
      SELECT id FROM subtree
    `;
    return result.map((r) => r.id);
  }
}
