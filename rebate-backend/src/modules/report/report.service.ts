import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getDescendantIds, isDescendantOf } from '../../common/utils/subtree.util';
import { AssetType, RebateType } from '@prisma/client';

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Validate filterIbId nằm trong subtree của caller.
   *
   * FIX (audit toàn diện): trước đây "callerLevel === 0 → bypass hoàn toàn"
   * — nghĩa là MIB truyền BẤT KỲ filterIbId nào (kể cả thuộc cây của MIB
   * khác hoàn toàn) đều lọt qua, không hề kiểm tra. Route hiện có
   * SubtreeGuard chặn trước ở tầng HTTP nên trong thực tế chưa bị khai thác
   * qua API công khai, nhưng đây vẫn là lỗ hổng thật ở tầng service (defense
   * in depth) — nếu sau này guard bị gỡ/đổi mà quên cập nhật service, lỗ
   * hổng sẽ lộ ra ngay. Giờ MIB cũng phải qua kiểm tra đệ quy đúng nghĩa
   * "View-All TRONG CHÍNH NHÁNH CỦA MÌNH", không phải bypass toàn bộ.
   */
  private async validateFilterIbId(rootIbId: string, callerLevel: number, filterIbId?: string, callerRole?: string) {
    if (!filterIbId || filterIbId === rootIbId) return;
    if (callerRole === 'ADMIN') return; // ADMIN bypass

    if (callerLevel === 0) {
      // MIB: View-All nhưng CHỈ trong chính nhánh của mình (đệ quy).
      const isOwnDescendant = await isDescendantOf(this.prisma, filterIbId, rootIbId);
      if (!isOwnDescendant) {
        throw new ForbiddenException({
          code: 'IB_NOT_IN_SUBTREE',
          message: 'IB này không thuộc nhánh của bạn',
        });
      }
      return;
    }

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
    // Non-ADMIN → lấy CHÍNH baseIbId + TOÀN BỘ hậu duệ đệ quy (không chỉ Lv1
    // trực tiếp — FIX: trước đây chỉ lấy `parentId: baseIbId` (1 cấp), khiến
    // MIB có tree sâu hơn 1 cấp bị thiếu dữ liệu report của Lv2/Lv3/N).
    const baseIbId = filterIbId || rootIbId;
    let targetIbIds: string[];
    if (callerRole === 'ADMIN') {
      const all = await this.prisma.ibNode.findMany({ select: { id: true } });
      targetIbIds = all.map((n) => n.id);
    } else {
      targetIbIds = await getDescendantIds(this.prisma, baseIbId);
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
      // FIX: đệ quy toàn bộ hậu duệ (không chỉ Lv1 trực tiếp) — xem comment
      // tương tự ở getSummary() phía trên.
      targetIbIds = await getDescendantIds(this.prisma, baseIbId);
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