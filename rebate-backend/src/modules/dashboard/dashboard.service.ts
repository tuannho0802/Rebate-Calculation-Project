import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getSubtreeIds } from '../../common/utils/subtree.util';

function parsePeriod(period: string): { start: Date; end: Date; label: string } {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    throw new BadRequestException({ code: 'INVALID_PERIOD', message: 'period phải có dạng YYYY-MM' });
  }
  const [y, m] = period.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start, end, label: period };
}

function changePercent(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return Number((((current - prev) / prev) * 100).toFixed(2));
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // ── GET /dashboard/summary (existing, kept for backwards compat) ────────────
  async getSummary(currentUserId: string, callerRole?: string) {
    let childIds: string[];
    if (callerRole === 'ADMIN') {
      const all = await this.prisma.ibNode.findMany({ select: { id: true } });
      childIds = all.map((n) => n.id);
    } else {
      const children = await this.prisma.ibNode.findMany({ where: { parentId: currentUserId }, select: { id: true } });
      childIds = children.map((c) => c.id);
    }
    const subtreeIds = callerRole === 'ADMIN' ? childIds : [currentUserId, ...childIds];

    const [activeCount, inactiveCount] = await Promise.all([
      this.prisma.ibNode.count({ where: { id: { in: childIds }, isActive: true } }),
      this.prisma.ibNode.count({ where: { id: { in: childIds }, isActive: false } }),
    ]);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
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

    const now = new Date();
    const chartData: { month: string; totalRebate: number; totalLots: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const monthLabel = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const agg = await this.prisma.rebateTransaction.aggregate({
        where: { ibId: { in: subtreeIds }, tradedAt: { gte: start, lt: end } },
        _sum: { rebateAmount: true, lots: true },
      });
      chartData.push({
        month: monthLabel,
        totalRebate: Number((agg._sum.rebateAmount ?? 0).toFixed(4)),
        totalLots: Number((agg._sum.lots ?? 0).toFixed(4)),
      });
    }

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
      chartData,
      generatedAt: new Date().toISOString(),
    };
  }

  // ── GET /dashboard/overview ─────────────────────────────────────────────────
  async getOverview(callerId: string, callerRole?: string) {
    let childIds: string[];
    if (callerRole === 'ADMIN') {
      const all = await this.prisma.ibNode.findMany({ select: { id: true } });
      childIds = all.map((n) => n.id).filter((id) => id !== callerId);
    } else {
      const children = await this.prisma.ibNode.findMany({ where: { parentId: callerId }, select: { id: true } });
      childIds = children.map((c) => c.id);
    }

    // Wallet
    const wallet = await this.prisma.wallet.findUnique({
      where: { ibId: callerId },
      select: { balance: true, currency: true },
    });

    // Dates
    const now = new Date();
    const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

    // Rebate stats
    const [thisMonthAgg, lastMonthAgg] = await Promise.all([
      this.prisma.rebateTransaction.aggregate({
        where: { ibId: callerId, tradedAt: { gte: thisMonthStart, lt: now } },
        _sum: { rebateAmount: true, lots: true },
      }),
      this.prisma.rebateTransaction.aggregate({
        where: { ibId: callerId, tradedAt: { gte: lastMonthStart, lt: thisMonthStart } },
        _sum: { rebateAmount: true },
      }),
    ]);

    const thisMonthRebate = Number(thisMonthAgg._sum.rebateAmount ?? 0);
    const lastMonthRebate = Number(lastMonthAgg._sum.rebateAmount ?? 0);

    // Subtree stats — activeIbs = has tx in last 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const [totalIbs, activeIbGroups] = await Promise.all([
      this.prisma.ibNode.count({ where: { id: { in: childIds } } }),
      this.prisma.rebateTransaction.groupBy({
        by: ['ibId'],
        where: { ibId: { in: childIds }, tradedAt: { gte: thirtyDaysAgo } },
        _count: { id: true },
      }),
    ]);
    const activeIbs = activeIbGroups.length;

    // Top 5 IB theo rebate tháng này
    const topIbGroups = await this.prisma.rebateTransaction.groupBy({
      by: ['ibId'],
      where: { ibId: { in: childIds }, tradedAt: { gte: thisMonthStart } },
      _sum: { rebateAmount: true, lots: true },
      orderBy: { _sum: { rebateAmount: 'desc' } },
      take: 5,
    });

    const topIbIds = topIbGroups.map((t) => t.ibId);
    const topIbNodes = await this.prisma.ibNode.findMany({
      where: { id: { in: topIbIds } },
      select: { id: true, email: true, name: true },
    });
    const nodeMap = Object.fromEntries(topIbNodes.map((n) => [n.id, n]));
    const topIbs = topIbGroups.map((t) => ({
      email: nodeMap[t.ibId]?.email ?? '',
      rebate: Number(t._sum.rebateAmount ?? 0),
      lots: Number(t._sum.lots ?? 0),
    }));

    return {
      wallet: {
        balance: Number(wallet?.balance ?? 0),
        currency: wallet?.currency ?? 'USD',
      },
      rebate: {
        thisMonth: thisMonthRebate,
        lastMonth: lastMonthRebate,
        changePercent: changePercent(thisMonthRebate, lastMonthRebate),
      },
      subtree: {
        totalIbs,
        activeIbs,
      },
      lots: {
        thisMonth: Number(thisMonthAgg._sum.lots ?? 0),
      },
      topIbs,
    };
  }

  // ── GET /dashboard/rebate-summary?period=YYYY-MM ───────────────────────────
  async getRebateSummary(callerId: string, period: string, callerRole?: string) {
    const { start, end, label } = parsePeriod(period);
    let ibIds: string[];
    if (callerRole === 'ADMIN') {
      const all = await this.prisma.ibNode.findMany({ select: { id: true } });
      ibIds = all.map((n) => n.id);
    } else {
      const children = await this.prisma.ibNode.findMany({ where: { parentId: callerId }, select: { id: true } });
      ibIds = [callerId, ...children.map((c) => c.id)];
    }

    const txs = await this.prisma.rebateTransaction.findMany({
      where: { ibId: { in: ibIds }, tradedAt: { gte: start, lt: end } },
      include: { ib: { select: { level: true } } },
    });

    let total = 0;
    const byAssetMap: Record<string, { rebate: number; lots: number }> = {};
    const byRebateTypeMap: Record<string, { rebate: number }> = {};
    const byLevelMap: Record<number, { rebate: number }> = {};

    for (const tx of txs) {
      const r = Number(tx.rebateAmount);
      const l = Number(tx.lots);
      total += r;

      // byAsset
      if (!byAssetMap[tx.assetType]) byAssetMap[tx.assetType] = { rebate: 0, lots: 0 };
      byAssetMap[tx.assetType].rebate += r;
      byAssetMap[tx.assetType].lots += l;

      // byRebateType
      if (!byRebateTypeMap[tx.rebateType]) byRebateTypeMap[tx.rebateType] = { rebate: 0 };
      byRebateTypeMap[tx.rebateType].rebate += r;

      // byLevel
      const level = tx.ib.level;
      if (!byLevelMap[level]) byLevelMap[level] = { rebate: 0 };
      byLevelMap[level].rebate += r;
    }

    return {
      period: label,
      total: Number(total.toFixed(8)),
      byAsset: Object.entries(byAssetMap)
        .map(([assetType, v]) => ({ assetType, rebate: Number(v.rebate.toFixed(8)), lots: Number(v.lots.toFixed(8)) }))
        .sort((a, b) => b.rebate - a.rebate),
      byRebateType: Object.entries(byRebateTypeMap)
        .map(([rebateType, v]) => ({ rebateType, rebate: Number(v.rebate.toFixed(8)) }))
        .sort((a, b) => b.rebate - a.rebate),
      byLevel: Object.entries(byLevelMap)
        .map(([level, v]) => ({ level: Number(level), rebate: Number(v.rebate.toFixed(8)) }))
        .sort((a, b) => a.level - b.level),
    };
  }

  // ── GET /dashboard/ib-performance?period=YYYY-MM&page=1&limit=20 ──────────
  async getIbPerformance(
    callerId: string,
    period: string,
    page: number,
    limit: number,
    callerRole?: string,
  ) {
    const { start, end, label } = parsePeriod(period);
    const [y, m] = label.split('-').map(Number);
    const prevStart = new Date(Date.UTC(y, m - 2, 1));
    const prevEnd = start;

    let childIds: string[];
    if (callerRole === 'ADMIN') {
      const all = await this.prisma.ibNode.findMany({ select: { id: true } });
      childIds = all.map((n) => n.id).filter((id) => id !== callerId);
    } else {
      const children = await this.prisma.ibNode.findMany({ where: { parentId: callerId }, select: { id: true } });
      childIds = children.map((c) => c.id);
    }

    // Get all IBs in subtree with pagination
    const total = childIds.length;
    const pagedChildIds = childIds.slice((page - 1) * limit, page * limit);

    if (pagedChildIds.length === 0) {
      return { period: label, items: [], total, page, limit };
    }

    // Fetch IB nodes
    const ibNodes = await this.prisma.ibNode.findMany({
      where: { id: { in: pagedChildIds } },
      select: { id: true, email: true, name: true, level: true },
    });

    // Aggregate this period
    const [thisAgg, prevAgg] = await Promise.all([
      this.prisma.rebateTransaction.groupBy({
        by: ['ibId'],
        where: { ibId: { in: pagedChildIds }, tradedAt: { gte: start, lt: end } },
        _sum: { rebateAmount: true, lots: true },
        _count: { id: true },
      }),
      this.prisma.rebateTransaction.groupBy({
        by: ['ibId'],
        where: { ibId: { in: pagedChildIds }, tradedAt: { gte: prevStart, lt: prevEnd } },
        _sum: { rebateAmount: true, lots: true },
      }),
    ]);

    const thisMap = Object.fromEntries(thisAgg.map((a) => [a.ibId, a]));
    const prevMap = Object.fromEntries(prevAgg.map((a) => [a.ibId, a]));

    const data = ibNodes.map((ib) => {
      const t = thisMap[ib.id];
      const p = prevMap[ib.id];

      const lots = Number(t?._sum.lots ?? 0);
      const rebate = Number(t?._sum.rebateAmount ?? 0);
      const txCount = t?._count.id ?? 0;
      const prevLots = Number(p?._sum.lots ?? 0);
      const prevRebate = Number(p?._sum.rebateAmount ?? 0);

      return {
        id: ib.id,
        email: ib.email,
        name: ib.name,
        level: ib.level,
        lots,
        rebate,
        txCount,
        lotsChangePercent: changePercent(lots, prevLots),
        rebateChangePercent: changePercent(rebate, prevRebate),
      };
    });

    return { period: label, items: data, total, page, limit };
  }
}
