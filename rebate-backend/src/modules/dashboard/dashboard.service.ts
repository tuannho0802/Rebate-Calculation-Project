import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getSubtreeIds } from '../../common/utils/subtree.util';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(currentUserId: string) {
    // 1. Lấy subtree IDs
    const subtreeIds = await getSubtreeIds(this.prisma, currentUserId);
    const childIds = subtreeIds.filter((id) => id !== currentUserId);

    // 2. Đếm IB active/inactive
    const [activeCount, inactiveCount] = await Promise.all([
      this.prisma.ibNode.count({ where: { id: { in: childIds }, isActive: true } }),
      this.prisma.ibNode.count({ where: { id: { in: childIds }, isActive: false } }),
    ]);

    // 3. Transaction stats — today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // 4. Transaction stats — this month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [todayAgg, monthAgg] = await Promise.all([
      this.prisma.rebateTransaction.aggregate({
        where: { ibId: { in: subtreeIds }, tradedAt: { gte: todayStart } },
        _count: { id: true },
        _sum: { lots: true, rebateAmount: true },
      }),
      this.prisma.rebateTransaction.aggregate({
        where: { ibId: { in: subtreeIds }, tradedAt: { gte: monthStart } },
        _count: { id: true },
        _sum: { lots: true, rebateAmount: true },
      }),
    ]);

    // 5. Top 5 IB theo lots tháng này
    const topIbs = await this.prisma.rebateTransaction.groupBy({
      by: ['ibId'],
      where: { ibId: { in: childIds }, tradedAt: { gte: monthStart } },
      _sum: { lots: true, rebateAmount: true },
      orderBy: { _sum: { lots: 'desc' } },
      take: 5,
    });

    const topIbIds = topIbs.map((t) => t.ibId);
    const topIbNodes = await this.prisma.ibNode.findMany({
      where: { id: { in: topIbIds } },
      select: { id: true, email: true, name: true },
    });
    const nodeMap = Object.fromEntries(topIbNodes.map((n) => [n.id, n]));

    const topIbsResult = topIbs.map((t) => ({
      id: t.ibId,
      email: nodeMap[t.ibId]?.email ?? '',
      name: nodeMap[t.ibId]?.name ?? '',
      monthLots: Number(t._sum.lots ?? 0),
      monthRebateUsd: Number(t._sum.rebateAmount ?? 0),
    }));

    return {
      ibStats: {
        totalActive: activeCount,
        totalInactive: inactiveCount,
        totalInSubtree: childIds.length,
      },
      transactionStats: {
        todayCount: todayAgg._count.id,
        todayLots: Number(todayAgg._sum.lots ?? 0),
        todayRebateUsd: Number(todayAgg._sum.rebateAmount ?? 0),
        monthCount: monthAgg._count.id,
        monthLots: Number(monthAgg._sum.lots ?? 0),
        monthRebateUsd: Number(monthAgg._sum.rebateAmount ?? 0),
      },
      topIbsThisMonth: topIbsResult,
      generatedAt: new Date().toISOString(),
    };
  }
}
