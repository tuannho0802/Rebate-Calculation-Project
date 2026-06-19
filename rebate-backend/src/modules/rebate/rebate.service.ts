import { Injectable, NotFoundException, UnprocessableEntityException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateRebateConfigDto } from './dto/update-config.dto';
import { AssetType, RebateType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../audit/audit.constants';
import { getSubtreeIds } from '../../common/utils/subtree.util';

export const MAX_PIPS: Record<AssetType, number> = {
  [AssetType.D_FOREX]: 12,
  [AssetType.FOREX]: 12,
  [AssetType.GOLD]: 20,
  [AssetType.SILVER_5000]: 80,
  [AssetType.SILVER_1000]: 20,
  [AssetType.OIL]: 20,
  [AssetType.NATURE_GAS]: 35,
  [AssetType.COMMODITIES]: 3,
  [AssetType.HKG50]: 20,
  [AssetType.A50]: 40,
  [AssetType.JPN225]: 50,
  [AssetType.US_INDEX]: 2.3,
  [AssetType.SHARES]: 1.5,
  [AssetType.ETHEREUM]: 3,
  [AssetType.PRECIOUS_METAL]: 20,
  [AssetType.BITCOIN]: 3,
  [AssetType.CRYPTO]: 1.5,
  [AssetType.GAUCNH]: 7,
};

@Injectable()
export class RebateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getConfig(ibId: string) {
    const configs = await this.prisma.rebateConfig.findMany({
      where: { ibId },
      orderBy: { updatedAt: 'desc' },
    });

    return {
      ibId,
      assets: configs.map((c: any) => ({
        assetType: c.assetType,
        rebateType: c.rebateType,
        rebatePips: Number(c.rebatePips),
        markupPips: Number(c.markupPips),
        markupPercent: Number(c.markupPercent),
        maxPips: Number(c.maxPips),
        updatedAt: c.updatedAt,
      })),
      updatedAt: configs.length > 0 ? configs[0].updatedAt : new Date(),
    };
  }

  async updateConfig(currentUserId: string, targetIbId: string, updateDto: UpdateRebateConfigDto) {
    if (currentUserId === targetIbId) {
      throw new ForbiddenException({
        code: 'AUTH_FORBIDDEN',
        message: 'Bạn không có quyền thực hiện thao tác này',
      });
    }

    await this.prisma.$transaction(async (tx: any) => {
      for (const assetConfig of updateDto.assets) {
        const { assetType, rebateType = 'STP_REBATE', rebatePips, markupPips, markupPercent } = assetConfig;

        const parentConfig = await tx.rebateConfig.findUnique({
          where: { ibId_assetType_rebateType: { ibId: currentUserId, assetType, rebateType: rebateType as any } },
        });

        const limit = parentConfig ? Number(parentConfig.markupPips) : (MAX_PIPS[assetType] || 0);

        if (rebatePips + markupPips > limit) {
          throw new UnprocessableEntityException({
            code: 'REBATE_EXCEEDS_MAX',
            message: `Tổng rebate vượt quá giới hạn cho phép (${limit} pips)`,
          });
        }

        // 1. Lấy config hiện tại -> before
        const existing = await tx.rebateConfig.findUnique({
          where: { ibId_assetType_rebateType: { ibId: targetIbId, assetType, rebateType: rebateType as any } },
        });

        const before = existing ? {
          rebatePips: Number(existing.rebatePips),
          markupPips: Number(existing.markupPips),
          markupPercent: Number(existing.markupPercent),
        } : null;

        // 2. Update -> after
        const updated = await tx.rebateConfig.upsert({
          where: { ibId_assetType_rebateType: { ibId: targetIbId, assetType, rebateType: rebateType as any } },
          update: {
            rebatePips,
            markupPips,
            markupPercent,
          },
          create: {
            ibId: targetIbId,
            assetType,
            rebateType: rebateType as any,
            rebatePips,
            markupPips,
            markupPercent,
            maxPips: limit,
          },
        });

        const after = {
          rebatePips: Number(updated.rebatePips),
          markupPips: Number(updated.markupPips),
          markupPercent: Number(updated.markupPercent),
        };

        // 3. Check change
        const hasChange = JSON.stringify(before) !== JSON.stringify(after);
        if (hasChange) {
          await tx.rebateConfigHistory.create({
            data: {
              rebateConfigId: updated.id,
              changedById: currentUserId,
              before: before as any,
              after: after as any,
            },
          });

          await this.auditService.log({
            actorId: currentUserId,
            action: AUDIT_ACTIONS.REBATE_CONFIG_UPDATE,
            targetType: 'REBATE_CONFIG',
            targetId: targetIbId,
            before: before as any,
            after: after as any,
          });
        }

        // Cascading update child's children: child's markupPips becomes their new maxPips limit
        if (hasChange && existing && Number(existing.markupPips) !== markupPips) {
          await tx.rebateConfig.updateMany({
            where: {
              ib: { parentId: targetIbId },
              assetType,
              rebateType: rebateType as any,
            },
            data: {
              maxPips: markupPips,
            },
          });
        }
      }
    });

    return this.getConfig(targetIbId);
  }

  async calculateCascadeDistribution(
    ibId: string,
    assetType: AssetType,
    lots: number,
    rebateType: RebateType = RebateType.STP_REBATE
  ) {
    const config = await this.prisma.rebateConfig.findUnique({
      where: { ibId_assetType_rebateType: { ibId, assetType, rebateType } },
    });

    if (!config) {
      throw new NotFoundException({
        code: 'REBATE_CONFIG_NOT_FOUND',
        message: 'Chưa có cấu hình rebate',
      });
    }

    const toFloat = (val: number) => Number(val.toFixed(8));

    const rebatePips = Number(config.rebatePips);
    const markupPips = Number(config.markupPips);
    const selfAmount = toFloat(rebatePips * lots);
    const totalRebate = toFloat((rebatePips + markupPips) * lots);

    // Use CTE to walk up the ancestor chain and get their rebate pips for this asset
    const ancestors: any[] = await this.prisma.$queryRaw`
      WITH RECURSIVE ancestor_tree AS (
        -- Start from the direct parent of the given IB
        SELECT id, "parentId", level
        FROM ib_nodes
        WHERE id = (SELECT "parentId" FROM ib_nodes WHERE id = ${ibId})

        UNION ALL

        -- Keep walking up (parent of parent...)
        SELECT n.id, n."parentId", n.level
        FROM ib_nodes n
        INNER JOIN ancestor_tree a ON n.id = a."parentId"
      )
      SELECT a.id as "ibId", a.level, c."rebatePips"
      FROM ancestor_tree a
      JOIN rebate_configs c
        ON c."ibId" = a.id
        AND c."assetType" = ${assetType}::"AssetType"
        AND c."rebateType" = ${rebateType}::"RebateType"
      ORDER BY a.level ASC
    `;

    const distributed = ancestors.map(a => ({
      ibId: a.ibId,
      level: a.level,
      amount: toFloat(Number(a.rebatePips) * lots),
    }));

    return {
      ibId,
      assetType,
      rebateType,
      lots,
      rebatePips,
      totalRebate,
      currency: 'USD',
      breakdown: {
        self: selfAmount,
        distributed,
      },
    };
  }

  /**
   * GET /rebate/config/:ibId/history — lịch sử thay đổi cấu hình rebate
   */
  async getConfigHistory(
    currentUserId: string,
    ibId: string,
    page: number,
    limit: number,
  ) {
    // Verify ibId trong subtree
    const subtreeIds = await getSubtreeIds(this.prisma, currentUserId);
    if (!subtreeIds.includes(ibId)) {
      throw new ForbiddenException({ code: 'IB_NOT_IN_SUBTREE' });
    }

    // Lấy tất cả config IDs của IB này
    const configs = await this.prisma.rebateConfig.findMany({
      where: { ibId },
      select: { id: true, assetType: true, rebateType: true },
    });

    if (configs.length === 0) {
      throw new NotFoundException({ code: 'CONFIG_NOT_FOUND' });
    }

    const configIds = configs.map((c) => c.id);

    const [items, total] = await Promise.all([
      this.prisma.rebateConfigHistory.findMany({
        where: { rebateConfigId: { in: configIds } },
        include: {
          changedBy: { select: { id: true, email: true, name: true } },
          rebateConfig: { select: { assetType: true, rebateType: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.rebateConfigHistory.count({ where: { rebateConfigId: { in: configIds } } }),
    ]);

    return { data: items, meta: { page, limit, total } };
  }
}
