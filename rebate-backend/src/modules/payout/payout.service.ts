import { Injectable, BadRequestException, NotFoundException, UnprocessableEntityException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';
import { AUDIT_ACTIONS } from '../audit/audit.constants';
import { Decimal } from '@prisma/client/runtime/library';
import { PayoutStatus, NotificationType } from '@prisma/client';
import { getSubtreeIds } from '../../common/utils/subtree.util';
import { QueryPayoutDto } from './dto/query-payout.dto';

@Injectable()
export class PayoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
  ) {}

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

    // Notify MIB (level 0)
    const mibs = await this.prisma.ibNode.findMany({ where: { level: 0 } });
    for (const mib of mibs) {
      this.notificationService.createSystemNotification({
        recipientId: mib.id,
        type: NotificationType.SYSTEM,
        title: 'Yeu cau rut tien moi',
        body: `Co yeu cau rut tien ${amount.toString()} tu IB ${ibId}`,
      });
    }

    return payout;
  }

  async approvePayout(payoutId: string, processedBy: string) {
    const payout = await this.prisma.payout.findUnique({ where: { id: payoutId } });
    if (!payout) throw new NotFoundException({ code: 'PAYOUT_NOT_FOUND' });
    if (payout.status !== PayoutStatus.PENDING) {
      throw new UnprocessableEntityException({ code: 'PAYOUT_NOT_PENDING' });
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

  async rejectPayout(payoutId: string, processedBy: string, rejectedReason: string) {
    const payout = await this.prisma.payout.findUnique({ where: { id: payoutId } });
    if (!payout) throw new NotFoundException({ code: 'PAYOUT_NOT_FOUND' });
    if (payout.status !== PayoutStatus.PENDING) {
      throw new UnprocessableEntityException({ code: 'PAYOUT_NOT_PENDING' });
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

  async listPayouts(callerId: string, callerLevel: number, query: QueryPayoutDto) {
    const { status, ibId, page = 1, limit = 20 } = query;
    const where: any = {};

    if (status) where.status = status;

    if (callerLevel > 0) {
      if (ibId && ibId !== callerId) {
        // Can't see others in this design, or maybe subtree?
        // Prompt says: "Lv1+: chỉ xem payout của chính mình"
        throw new ForbiddenException({ code: 'FORBIDDEN' });
      }
      where.ibId = callerId;
    } else {
      if (ibId) where.ibId = ibId;
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

  async getPendingPayouts(page: number, limit: number) {
    const where = { status: PayoutStatus.PENDING };
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
