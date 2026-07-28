import {
  Injectable, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../audit/audit.constants';
import { getSubtreeIds } from '../../common/utils/subtree.util';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { CreateBatchTransactionDto } from './dto/create-batch-transaction.dto';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '@prisma/client';
import { WalletService } from '../wallet/wallet.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class TransactionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
    private readonly walletService: WalletService,
  ) { }

  /**
   * POST /transactions — tạo 1 giao dịch
   * Chỉ cho phép nếu ibId nằm trong subtree của currentUser
   */
  async create(currentUserId: string, dto: CreateTransactionDto, ipAddress?: string, callerRole?: string) {
    // Kiểm tra ibId phải là subtree của currentUser
    await this.assertInSubtree(currentUserId, dto.ibId, callerRole);

    // Wrap in transaction to atomic credit wallet
    const tx = await this.prisma.$transaction(async (prismaTx) => {
      const createdTx = await prismaTx.rebateTransaction.create({
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

      await this.walletService.credit(
        createdTx.ibId,
        new Decimal(createdTx.rebateAmount),
        prismaTx
      );

      return createdTx;
    });

    await this.auditService.log({
      actorId: currentUserId,
      action: AUDIT_ACTIONS.TRANSACTION_CREATE,
      targetType: 'TRANSACTION',
      targetId: tx.id,
      after: { ibId: tx.ibId, assetType: tx.assetType, lots: tx.lots.toString(), rebateAmount: tx.rebateAmount.toString() },
      ipAddress,
    });

    // System notification: TRANSACTION_ADDED — gửi cho IB của giao dịch
    this.notificationService.createSystemNotification({
      recipientId: tx.ibId,
      type: NotificationType.TRANSACTION_ADDED,
      title: 'Giao dịch mới được ghi nhận',
      body: `Giao dịch ${tx.lots} lots (${tx.assetType}) đã được ghi nhận cho tài khoản của bạn.`,
      metadata: { transactionId: tx.id, assetType: tx.assetType, lots: tx.lots.toString() },
    });

    return tx;
  }

  /**
   * POST /transactions/batch — tạo nhiều giao dịch
   * Validate tất cả ibId phải nằm trong subtree của currentUser
   */
  async createBatch(currentUserId: string, dto: CreateBatchTransactionDto, ipAddress?: string, callerRole?: string) {
    if (callerRole !== 'ADMIN') {
      const subtreeIds = await getSubtreeIds(this.prisma, currentUserId);
      const invalidIbIds = dto.transactions
        .map((t) => t.ibId)
        .filter((ibId) => !subtreeIds.includes(ibId));

      if (invalidIbIds.length > 0) {
        throw new ForbiddenException({
          code: 'IB_NOT_IN_SUBTREE',
          message: `Các IB sau không thuộc quyền quản lý của bạn: ${[...new Set(invalidIbIds)].join(', ')}`,
        });
      }
    }

    const result = await this.prisma.$transaction(async (prismaTx) => {
      const created = await prismaTx.rebateTransaction.createMany({
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

      // Credit wallet cho từng IB trong batch
      // Group by ibId để update ít query hơn
      const walletCredits = new Map<string, Decimal>();
      for (const t of dto.transactions) {
        const current = walletCredits.get(t.ibId) || new Decimal(0);
        walletCredits.set(t.ibId, current.plus(new Decimal(t.rebateAmount)));
      }

      for (const [ibId, amount] of walletCredits.entries()) {
        await this.walletService.credit(ibId, amount, prismaTx);
      }

      return created;
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
  async findOne(currentUserId: string, id: string, callerRole?: string) {
    const tx = await this.prisma.rebateTransaction.findUnique({
      where: { id },
      include: {
        ib: { select: { id: true, email: true, name: true, level: true } },
        createdBy: { select: { id: true, email: true } },
      },
    });

    if (!tx) throw new NotFoundException({ code: 'TRANSACTION_NOT_FOUND' });

    // Kiểm tra ibId của transaction phải trong subtree của currentUser
    await this.assertInSubtree(currentUserId, tx.ibId, callerRole);

    return tx;
  }

  /**
   * DELETE /transactions/:id — xóa giao dịch nhập sai
   * Chỉ createdBy hoặc cha trực tiếp của IB đó (Parent-Strict) mới được xóa.
   *
   * FIX: trước đây "MIB (level=0)" được xóa BẤT KỲ transaction nào trong cả
   * subtree (mọi cấp), không chỉ con trực tiếp — vượt ngoài "MIB chỉ
   * View-All, không Edit-All". Đổi thành: người tạo, HOẶC cha trực tiếp của
   * IB gắn với transaction đó (LvN xóa transaction của LvN+1 trực tiếp),
   * áp dụng như nhau cho mọi level kể cả MIB — không còn ngoại lệ riêng.
   */
  async remove(currentUserId: string, id: string, ipAddress?: string, callerRole?: string) {
    const tx = await this.prisma.rebateTransaction.findUnique({
      where: { id },
    });

    if (!tx) throw new NotFoundException({ code: 'TRANSACTION_NOT_FOUND' });

    // Kiểm tra ibId trong subtree
    await this.assertInSubtree(currentUserId, tx.ibId, callerRole);

    const isCreator = tx.createdById === currentUserId;

    let isDirectParent = false;
    if (!isCreator && callerRole !== 'ADMIN') {
      const target = await this.prisma.ibNode.findUnique({ where: { id: tx.ibId }, select: { parentId: true } });
      isDirectParent = target?.parentId === currentUserId;
    }

    if (callerRole !== 'ADMIN' && !isCreator && !isDirectParent) {
      throw new ForbiddenException({
        code: 'TRANSACTION_DELETE_FORBIDDEN',
        message: 'Chỉ người tạo giao dịch hoặc cấp trên trực tiếp mới được xóa',
      });
    }

    await this.prisma.$transaction(async (prismaTx) => {
      await prismaTx.rebateTransaction.delete({ where: { id } });
      // Deduct from wallet
      await this.walletService.credit(
        tx.ibId,
        new Decimal(tx.rebateAmount).negated(),
        prismaTx
      );
    });

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
  private async assertInSubtree(rootId: string, targetId: string, callerRole?: string): Promise<void> {
    if (callerRole === 'ADMIN') return;
    const subtreeIds = await getSubtreeIds(this.prisma, rootId);
    if (!subtreeIds.includes(targetId)) {
      throw new ForbiddenException({
        code: 'IB_NOT_IN_SUBTREE',
        message: 'IB không thuộc quyền quản lý của bạn',
      });
    }
  }

}