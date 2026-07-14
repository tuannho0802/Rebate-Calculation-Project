import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getSubtreeIds } from '../../common/utils/subtree.util';
import { AssetType, RebateType } from '@prisma/client';

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * A4: Validate filterIbId nằm trong subtree của caller.
   * Lv0 (level = 0) bỏ qua check — được xem bất kỳ IB nào trong cây.
   */
  private async validateFilterIbId(rootIbId: string, callerLevel: number, filterIbId?: string, callerRole?: string) {
    if (!filterIbId || filterIbId === rootIbId) return;
    if (callerRole === 'ADMIN') return; // ADMIN bypass
    if (callerLevel === 0) return; // Lv0 bypass

    // Lv1+: filterIbId phải là con trực tiếp của caller
    const target = await this.prisma.ibNode.findUnique({ where: { id: filterIbId }, select: { parentId: true } });
    if (!target || target.parentId !== rootIbId) {
      throw new ForbiddenException({ 
        code: 'IB_NOT_IN_SUBTREE',
        message: 'IB này không phải con trực tiếp của bạn'
      });
    }
  }

  async getSummary(rootIbId: string, callerLevel: number, filterIbId?: string, period?: string, callerRole?: string) {
    await this.validateFilterIbId(rootIbId, callerLevel, filterIbId, callerRole);

    // ADMIN → không filter, lấy toàn bộ hệ thống
    // IB → chỉ lấy chính mình + 1 cấp trực tiếp
    const baseIbId = filterIbId || rootIbId;
    let targetIbIds: string[];
    if (callerRole === 'ADMIN') {
      const all = await this.prisma.ibNode.findMany({ select: { id: true } });
      targetIbIds = all.map((n) => n.id);
    } else {
      const children = await this.prisma.ibNode.findMany({ where: { parentId: baseIbId }, select: { id: true } });
      targetIbIds = [baseIbId, ...children.map((c) => c.id)];
    }

    // Parse period
    let periodStr = period;
    if (!periodStr) {
      const now = new Date();
      periodStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    const [yearStr, monthStr] = periodStr.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    // Get transactions
    const txs = await this.prisma.rebateTransaction.findMany({
      where: {
        ibId: { in: targetIbIds },
        tradedAt: {
          gte: startDate,
          lt: endDate,
        },
      },
      include: {
        ib: {
          select: { email: true, level: true },
        },
      },
    });

    // Compute totals and groups
    let totalRebate = 0;
    const assetMap = new Map<AssetType, { totalRebate: number; lots: number }>();
    const ibMap = new Map<string, { email: string; level: number; totalRebate: number }>();

    for (const tx of txs) {
      const amount = Number(tx.rebateAmount);
      const lotsVal = Number(tx.lots);
      totalRebate += amount;

      // Group by asset
      const assetGroup = assetMap.get(tx.assetType) || { totalRebate: 0, lots: 0 };
      assetGroup.totalRebate += amount;
      assetGroup.lots += lotsVal;
      assetMap.set(tx.assetType, assetGroup);

      // Group by IB
      const ibGroup = ibMap.get(tx.ibId) || { email: tx.ib.email, level: tx.ib.level, totalRebate: 0 };
      ibGroup.totalRebate += amount;
      ibMap.set(tx.ibId, ibGroup);
    }

    const byAsset = Array.from(assetMap.entries()).map(([assetType, group]) => ({
      assetType,
      totalRebate: Number(group.totalRebate.toFixed(4)),
      lots: Number(group.lots.toFixed(4)),
    }));

    const byIB = Array.from(ibMap.entries()).map(([ibId, group]) => ({
      ibId,
      email: group.email,
      level: group.level,
      totalRebate: Number(group.totalRebate.toFixed(4)),
    }));

    return {
      period: periodStr,
      totalRebate: Number(totalRebate.toFixed(4)),
      currency: 'USD',
      byAsset,
      byIB,
    };
  }

  async getTransactions(
    rootIbId: string,
    callerLevel: number,
    filterIbId?: string,
    period?: string,
    assetType?: AssetType,
    rebateType?: RebateType,
    page = 1,
    limit = 20,
    callerRole?: string,
  ) {
    await this.validateFilterIbId(rootIbId, callerLevel, filterIbId, callerRole);

    const baseIbId = filterIbId || rootIbId;
    let targetIbIds: string[];
    if (callerRole === 'ADMIN') {
      const all = await this.prisma.ibNode.findMany({ select: { id: true } });
      targetIbIds = all.map((n) => n.id);
    } else {
      const children = await this.prisma.ibNode.findMany({ where: { parentId: baseIbId }, select: { id: true } });
      targetIbIds = [baseIbId, ...children.map((c) => c.id)];
    }

    const where: any = {
      ibId: { in: targetIbIds },
    };

    if (assetType) {
      where.assetType = assetType;
    }

    // C2: filter by rebateType
    if (rebateType) {
      where.rebateType = rebateType;
    }

    if (period) {
      const [yearStr, monthStr] = period.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      where.tradedAt = {
        gte: new Date(year, month - 1, 1),
        lt: new Date(year, month, 1),
      };
    }

    const total = await this.prisma.rebateTransaction.count({ where });
    const skip = (page - 1) * limit;

    const txs = await this.prisma.rebateTransaction.findMany({
      where,
      skip,
      take: limit,
      orderBy: { tradedAt: 'desc' },
      include: {
        ib: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    const data = txs.map((tx: any) => ({
      id: tx.id,
      ibId: tx.ibId,
      ibName: tx.ib?.name || tx.ib?.email || tx.ibId,
      assetType: tx.assetType,
      rebateType: tx.rebateType,
      lots: Number(tx.lots),
      rebateAmount: Number(tx.rebateAmount),
      currency: tx.currency,
      tradedAt: tx.tradedAt,
    }));

    return {
      data,
      meta: {
        page,
        limit,
        total,
      },
    };
  }
}
