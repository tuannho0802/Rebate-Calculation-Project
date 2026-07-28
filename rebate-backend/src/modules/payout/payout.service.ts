import { Injectable, BadRequestException, NotFoundException, UnprocessableEntityException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';
import { AUDIT_ACTIONS } from '../audit/audit.constants';
import { Decimal } from '@prisma/client/runtime/library';
import { PayoutStatus, NotificationType } from '@prisma/client';
import { getSubtreeIds, getDescendantIds, isDescendantOf } from '../../common/utils/subtree.util';
import { QueryPayoutDto } from './dto/query-payout.dto';

@Injectable()
export class PayoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
  ) { }

  async requestPayout(ibId: string, amount: Decimal, paymentMethod: string, note?: string) {
    if (amount.lessThan(10)) {
      throw new BadRequestException({ code: 'PAYOUT_BELOW_MINIMUM', message: 'Số tiền rút tối thiểu là 10' });
    }

    const wallet = await this.walletService.getOrCreate(ibId);
    if (amount.greaterThan(wallet.balance)) {
      throw new UnprocessableEntityException({ code: 'PAYOUT_INSUFFICIENT_BALANCE', message: 'Số dư không đủ' });
    }

    const existingPending = await this.prisma.payout.findFirst({
      where: { ibId, status: PayoutStatus.PENDING },
    });
    if (existingPending) {
      throw new UnprocessableEntityException({ code: 'PAYOUT_ALREADY_PENDING', message: 'Đang có yêu cầu rút tiền chờ duyệt' });
    }

    const payout = await this.prisma.payout.create({
      data: {
        ibId,
        walletId: wallet.id,
        amount,
        paymentMethod,
        note,
      },
    });

    await this.auditService.log({
      actorId: ibId,
      action: AUDIT_ACTIONS.PAYOUT_REQUESTED,
      targetType: 'PAYOUT',
      targetId: payout.id,
      after: { amount: amount.toString(), paymentMethod },
    });

    // Notify: chỉ gửi cho MIB trực tiếp quản lý IB này (trace lên root)
    // Thay vì notify tất cả MIB trong hệ thống (bug R4 cũ)
    const ibNode = await this.prisma.ibNode.findUnique({
      where: { id: ibId },
      select: { parentId: true, level: true },
    });
    // Tìm MIB chủa quản (level=0) của IB này bằng cách walk lên cây
    if (ibNode) {
      let currentId = ibNode.parentId;
      let rootMibId: string | null = null;
      while (currentId) {
        const ancestor = await this.prisma.ibNode.findUnique({
          where: { id: currentId },
          select: { id: true, parentId: true, level: true },
        });
        if (!ancestor) break;
        if (ancestor.level === 0) {
          rootMibId = ancestor.id;
          break;
        }
        currentId = ancestor.parentId;
      }
      if (rootMibId) {
        this.notificationService.createSystemNotification({
          recipientId: rootMibId,
          type: NotificationType.SYSTEM,
          title: 'Yeu cau rut tien moi',
          body: `Co yeu cau rut tien ${amount.toString()} tu IB ${ibId}`,
        });
      }
    }

    return payout;
  }

  async approvePayout(payoutId: string, processedBy: string, callerRole?: string) {
    const payout = await this.prisma.payout.findUnique({ where: { id: payoutId } });
    if (!payout) throw new NotFoundException({ code: 'PAYOUT_NOT_FOUND' });
    if (payout.status !== PayoutStatus.PENDING) {
      throw new UnprocessableEntityException({ code: 'PAYOUT_NOT_PENDING' });
    }

    // BUG CŨ: hàm này trước đây KHÔNG kiểm tra payout.ibId có thuộc quyền
    // quản lý của processedBy hay không -> bất kỳ MIB nào cũng duyệt được
    // (giải ngân tiền) cho payout của IB thuộc cây MIB khác. Route chỉ có
    // Lv0Guard (chặn Lv1+) nên tới đây caller chắc chắn là ADMIN hoặc MIB.
    if (callerRole !== 'ADMIN' && payout.ibId !== processedBy) {
      const isOwnDescendant = await isDescendantOf(this.prisma, payout.ibId, processedBy);
      if (!isOwnDescendant) {
        throw new ForbiddenException({
          code: 'IB_NOT_IN_SUBTREE',
          message: 'Payout này không thuộc nhánh của bạn',
        });
      }
    }

    const wallet = await this.walletService.getOrCreate(payout.ibId);
    if (payout.amount.greaterThan(wallet.balance)) {
      throw new UnprocessableEntityException({ code: 'PAYOUT_INSUFFICIENT_BALANCE' });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: payout.amount },
          totalPaid: { increment: payout.amount },
        },
      });

      return tx.payout.update({
        where: { id: payoutId },
        data: {
          status: PayoutStatus.APPROVED,
          processedAt: new Date(),
          processedBy,
        },
      });
    });

    await this.auditService.log({
      actorId: processedBy,
      action: AUDIT_ACTIONS.PAYOUT_APPROVED,
      targetType: 'PAYOUT',
      targetId: payoutId,
      after: { status: 'APPROVED' },
    });

    this.notificationService.createSystemNotification({
      recipientId: payout.ibId,
      type: NotificationType.SYSTEM,
      title: 'Yeu cau rut tien da duoc duyet',
      body: `Yeu cau rut tien ${payout.amount.toString()} da duoc duyet.`,
    });

    return updated;
  }

  async rejectPayout(payoutId: string, processedBy: string, rejectedReason: string, callerRole?: string) {
    const payout = await this.prisma.payout.findUnique({ where: { id: payoutId } });
    if (!payout) throw new NotFoundException({ code: 'PAYOUT_NOT_FOUND' });
    if (payout.status !== PayoutStatus.PENDING) {
      throw new UnprocessableEntityException({ code: 'PAYOUT_NOT_PENDING' });
    }

    // Cùng fix ownership check như approvePayout() — xem comment ở đó.
    if (callerRole !== 'ADMIN' && payout.ibId !== processedBy) {
      const isOwnDescendant = await isDescendantOf(this.prisma, payout.ibId, processedBy);
      if (!isOwnDescendant) {
        throw new ForbiddenException({
          code: 'IB_NOT_IN_SUBTREE',
          message: 'Payout này không thuộc nhánh của bạn',
        });
      }
    }

    const updated = await this.prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: PayoutStatus.REJECTED,
        rejectedReason,
        processedAt: new Date(),
        processedBy,
      },
    });

    await this.auditService.log({
      actorId: processedBy,
      action: AUDIT_ACTIONS.PAYOUT_REJECTED,
      targetType: 'PAYOUT',
      targetId: payoutId,
      after: { status: 'REJECTED', rejectedReason },
    });

    this.notificationService.createSystemNotification({
      recipientId: payout.ibId,
      type: NotificationType.SYSTEM,
      title: 'Yeu cau rut tien bi tu choi',
      body: `Yeu cau rut tien ${payout.amount.toString()} bi tu choi: ${rejectedReason}`,
    });

    return updated;
  }

  async getPayoutById(payoutId: string, callerId: string, callerLevel: number, callerRole?: string) {
    const payout = await this.prisma.payout.findUnique({ where: { id: payoutId } });
    if (!payout) throw new NotFoundException({ code: 'PAYOUT_NOT_FOUND' });

    if (callerRole !== 'ADMIN' && payout.ibId !== callerId) {
      if (callerLevel === 0) {
        // MIB: View-All trong chính nhánh của mình.
        const isOwnDescendant = await isDescendantOf(this.prisma, payout.ibId, callerId);
        if (!isOwnDescendant) {
          throw new ForbiddenException({ code: 'IB_NOT_IN_SUBTREE', message: 'Payout này không thuộc nhánh của bạn' });
        }
      } else {
        // Lv1+: Parent-Strict — chỉ xem payout của con trực tiếp hoặc chính mình.
        const target = await this.prisma.ibNode.findUnique({ where: { id: payout.ibId }, select: { parentId: true } });
        if (!target || target.parentId !== callerId) {
          throw new ForbiddenException({ code: 'IB_NOT_IN_SUBTREE', message: 'Payout này không thuộc subtree của bạn' });
        }
      }
    }

    return payout;
  }

  async listPayouts(callerId: string, callerLevel: number, query: QueryPayoutDto, callerRole?: string) {
    const { status, ibId, page = 1, limit = 20 } = query;
    const where: any = {};

    if (status) where.status = status;

    if (callerRole === 'ADMIN') {
      // ADMIN: xem toàn bộ hệ thống, có thể filter thêm theo ibId
      if (ibId) where.ibId = ibId;
    } else if (callerLevel > 0) {
      // Lv1+: chỉ xem payout của chính mình
      if (ibId && ibId !== callerId) {
        throw new ForbiddenException({ code: 'FORBIDDEN' });
      }
      where.ibId = callerId;
    } else {
      // Lv0 (MIB): View-All nhưng CHỈ trong CHÍNH nhánh của mình.
      // BUG CŨ: `if (ibId) where.ibId = ibId` không hề kiểm tra ibId đó có
      // thuộc cây của MIB hay không; và khi KHÔNG truyền ibId, where={}
      // rỗng hoàn toàn -> trả về payout của TOÀN BỘ hệ thống (mọi MIB
      // khác). Đã fix: luôn giới hạn trong đúng subtree của MIB.
      const myDescendantIds = await getDescendantIds(this.prisma, callerId);
      if (ibId) {
        if (!myDescendantIds.includes(ibId)) {
          throw new ForbiddenException({ code: 'FORBIDDEN' });
        }
        where.ibId = ibId;
      } else {
        where.ibId = { in: myDescendantIds };
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.payout.findMany({
        where,
        orderBy: { requestedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payout.count({ where }),
    ]);

    return { data: items, meta: { page, limit, total } };
  }

  async getPendingPayouts(page: number, limit: number, callerId: string, callerRole?: string) {
    const where: any = { status: PayoutStatus.PENDING };

    // BUG CŨ: route chỉ có Lv0Guard (check role/level), service này KHÔNG
    // lọc theo cây của caller -> bất kỳ MIB nào cũng thấy pending payout
    // của TẤT CẢ MIB khác trong hệ thống. Đã fix: MIB chỉ thấy trong nhánh
    // của chính mình; ADMIN vẫn xem toàn hệ thống (CRUD-All).
    if (callerRole !== 'ADMIN') {
      const myDescendantIds = await getDescendantIds(this.prisma, callerId);
      where.ibId = { in: myDescendantIds };
    }

    const [items, total] = await Promise.all([
      this.prisma.payout.findMany({
        where,
        orderBy: { requestedAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { ib: { select: { email: true, name: true } } },
      }),
      this.prisma.payout.count({ where }),
    ]);

    return { data: items, meta: { page, limit, total } };
  }
}