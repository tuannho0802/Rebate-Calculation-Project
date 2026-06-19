import {
  Injectable, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../audit/audit.constants';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { CreateBatchTransactionDto } from './dto/create-batch-transaction.dto';

@Injectable()
export class TransactionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * POST /transactions — tạo 1 giao dịch
   * Chỉ cho phép nếu ibId nằm trong subtree của currentUser
   */
  async create(currentUserId: string, dto: CreateTransactionDto, ipAddress?: string) {
    // Kiểm tra ibId phải là subtree của currentUser
    await this.assertInSubtree(currentUserId, dto.ibId);

    const tx = await this.prisma.rebateTransaction.create({
      data: {
        ibId: dto.ibId,
        assetType: dto.assetType,
        rebateType: dto.rebateType ?? 'STP_REBATE',
        lots: dto.lots,
        rebateAmount: dto.rebateAmount,
        tradedAt: new Date(dto.tradedAt),
        note: dto.note,
        createdById: currentUserId,
      },
    });

    await this.auditService.log({
      actorId: currentUserId,
      action: AUDIT_ACTIONS.TRANSACTION_CREATE,
      targetType: 'TRANSACTION',
      targetId: tx.id,
      after: { ibId: tx.ibId, assetType: tx.assetType, lots: tx.lots.toString(), rebateAmount: tx.rebateAmount.toString() },
      ipAddress,
    });

    return tx;
  }

  /**
   * POST /transactions/batch — tạo nhiều giao dịch
   * Validate tất cả ibId phải nằm trong subtree của currentUser
   */
  async createBatch(currentUserId: string, dto: CreateBatchTransactionDto, ipAddress?: string) {
    // Lấy subtree một lần, validate tất cả ibId trong batch
    const subtreeIds = await this.getSubtreeIds(currentUserId);
    const invalidIbIds = dto.transactions
      .map((t) => t.ibId)
      .filter((ibId) => !subtreeIds.includes(ibId));

    if (invalidIbIds.length > 0) {
      throw new ForbiddenException({
        code: 'IB_NOT_IN_SUBTREE',
        message: `Các IB sau không thuộc quyền quản lý của bạn: ${[...new Set(invalidIbIds)].join(', ')}`,
      });
    }

    const result = await this.prisma.rebateTransaction.createMany({
      data: dto.transactions.map((t) => ({
        ibId: t.ibId,
        assetType: t.assetType,
        rebateType: t.rebateType ?? 'STP_REBATE',
        lots: t.lots,
        rebateAmount: t.rebateAmount,
        tradedAt: new Date(t.tradedAt),
        note: t.note,
        createdById: currentUserId,
      })),
    });

    await this.auditService.log({
      actorId: currentUserId,
      action: AUDIT_ACTIONS.TRANSACTION_BATCH,
      targetType: 'TRANSACTION',
      targetId: currentUserId, // không có 1 targetId cụ thể, dùng actor
      after: { count: result.count },
      ipAddress,
    });

    return { created: result.count };
  }

  /**
   * GET /transactions/:id — xem chi tiết 1 giao dịch
   */
  async findOne(currentUserId: string, id: string) {
    const tx = await this.prisma.rebateTransaction.findUnique({
      where: { id },
      include: {
        ib: { select: { id: true, email: true, name: true, level: true } },
        createdBy: { select: { id: true, email: true } },
      },
    });

    if (!tx) throw new NotFoundException({ code: 'TRANSACTION_NOT_FOUND' });

    // Kiểm tra ibId của transaction phải trong subtree của currentUser
    await this.assertInSubtree(currentUserId, tx.ibId);

    return tx;
  }

  /**
   * DELETE /transactions/:id — xóa giao dịch nhập sai
   * Chỉ createdBy hoặc MIB (level=0) mới được xóa
   */
  async remove(currentUserId: string, id: string, ipAddress?: string) {
    const tx = await this.prisma.rebateTransaction.findUnique({
      where: { id },
    });

    if (!tx) throw new NotFoundException({ code: 'TRANSACTION_NOT_FOUND' });

    // Kiểm tra ibId trong subtree
    await this.assertInSubtree(currentUserId, tx.ibId);

    // Kiểm tra quyền xóa: phải là người tạo HOẶC MIB (level=0)
    const currentUser = await this.prisma.ibNode.findUnique({
      where: { id: currentUserId },
      select: { level: true },
    });

    const isMib = currentUser?.level === 0;
    const isCreator = tx.createdById === currentUserId;

    if (!isMib && !isCreator) {
      throw new ForbiddenException({
        code: 'TRANSACTION_DELETE_FORBIDDEN',
        message: 'Chỉ người tạo giao dịch hoặc MIB mới được xóa',
      });
    }

    await this.prisma.rebateTransaction.delete({ where: { id } });

    await this.auditService.log({
      actorId: currentUserId,
      action: AUDIT_ACTIONS.TRANSACTION_DELETE,
      targetType: 'TRANSACTION',
      targetId: id,
      before: {
        ibId: tx.ibId,
        assetType: tx.assetType,
        lots: tx.lots.toString(),
        rebateAmount: tx.rebateAmount.toString(),
        createdById: tx.createdById,
      },
      ipAddress,
    });

    return { message: 'Giao dịch đã được xóa' };
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  /**
   * Throw ForbiddenException nếu targetId không nằm trong subtree của rootId
   */
  private async assertInSubtree(rootId: string, targetId: string): Promise<void> {
    const subtreeIds = await this.getSubtreeIds(rootId);
    if (!subtreeIds.includes(targetId)) {
      throw new ForbiddenException({
        code: 'IB_NOT_IN_SUBTREE',
        message: 'IB không thuộc quyền quản lý của bạn',
      });
    }
  }

  /**
   * CTE recursive — lấy tất cả IDs trong subtree của rootId (bao gồm rootId)
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
