import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getSubtreeIds } from '../../common/utils/subtree.util';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

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
  }

  async getBalance(callerId: string, ibId: string, callerLevel: number) {
    if (callerId !== ibId && callerLevel > 0) {
      const subtreeIds = await getSubtreeIds(this.prisma, callerId);
      if (!subtreeIds.includes(ibId)) {
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
