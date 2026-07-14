import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getSubtreeIds } from '../../common/utils/subtree.util';
import { Decimal } from '@prisma/client/runtime/library';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async getOrCreate(ibId: string, tx: any = this.prisma) {
    let wallet = await tx.wallet.findUnique({
      where: { ibId },
    });

    if (!wallet) {
      wallet = await tx.wallet.create({
        data: { ibId },
      });
    }

    return wallet;
  }

  async credit(ibId: string, amount: Decimal, tx: any = this.prisma) {
    const wallet = await this.getOrCreate(ibId, tx);

    await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: { increment: amount },
        totalEarned: { increment: amount },
      },
    });

    // Fire REBATE_CREDITED notification (non-blocking)
    this.notificationService.createSystemNotification({
      recipientId: ibId,
      type: NotificationType.TRANSACTION_ADDED,
      title: 'Rebate duoc ghi co',
      body: `${amount.toString()} USD da duoc ghi co vao vi cua ban.`,
      metadata: { amount: amount.toString() },
    });
  }

  async getBalance(callerId: string, ibId: string, callerLevel: number, callerRole?: string) {
    // ADMIN: xem tự do vi của bất kỳ IB nào
    if (callerRole === 'ADMIN') {
      return this.getOrCreate(ibId);
    }

    if (callerId !== ibId && callerLevel > 0) {
      // Lv1+: chỉ xem con trực tiếp
      const target = await this.prisma.ibNode.findUnique({ where: { id: ibId }, select: { parentId: true } });
      if (!target || target.parentId !== callerId) {
        throw new ForbiddenException({
          code: 'IB_NOT_IN_SUBTREE',
          message: 'IB này không thuộc subtree của bạn',
        });
      }
    }

    const wallet = await this.getOrCreate(ibId);
    return wallet;
  }
}
