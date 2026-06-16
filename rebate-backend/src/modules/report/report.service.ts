import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AssetType } from '@prisma/client';

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  private async getSubtreeIds(rootId: string): Promise<string[]> {
    const result = await this.prisma.$queryRaw<{ id: string }[]>`
      WITH RECURSIVE subtree AS (
        SELECT id FROM ib_nodes WHERE id = ${rootId}
        UNION ALL
        SELECT n.id FROM ib_nodes n
        INNER JOIN subtree s ON n."parentId" = s.id
      )
      SELECT id FROM subtree;
    `;
    return result.map((r: any) => r.id);
  }

  async getSummary(rootIbId: string, filterIbId?: string, period?: string) {
    // Determine the set of IBs to include
    const baseIbId = filterIbId || rootIbId;
    const targetIbIds = await this.getSubtreeIds(baseIbId);

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
    filterIbId?: string,
    period?: string,
    assetType?: AssetType,
    page = 1,
    limit = 20,
  ) {
    const baseIbId = filterIbId || rootIbId;
    const targetIbIds = await this.getSubtreeIds(baseIbId);

    const where: any = {
      ibId: { in: targetIbIds },
    };

    if (assetType) {
      where.assetType = assetType;
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
    });

    const data = txs.map((tx: any) => ({
      id: tx.id,
      ibId: tx.ibId,
      assetType: tx.assetType,
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
