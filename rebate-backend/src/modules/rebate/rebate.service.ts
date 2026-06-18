import { Injectable, NotFoundException, UnprocessableEntityException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateRebateConfigDto } from './dto/update-config.dto';
import { AssetType } from '@prisma/client';

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
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(ibId: string) {
    const configs = await this.prisma.rebateConfig.findMany({
      where: { ibId },
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

    return this.prisma.$transaction(async (tx: any) => {
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

        // Update target configuration
        await tx.rebateConfig.upsert({
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

        // Cascading update child's children: child's markupPips becomes their new maxPips limit
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

      return this.getConfig(targetIbId);
    });
  }

  async calculateCascadeDistribution(ibId: string, assetType: AssetType, lots: number) {
    const config = await this.prisma.rebateConfig.findUnique({
      where: { ibId_assetType_rebateType: { ibId, assetType, rebateType: 'STP_REBATE' } },
    });

    if (!config) {
      throw new NotFoundException({
        code: 'REBATE_CONFIG_NOT_FOUND',
        message: 'Chưa có cấu hình rebate',
      });
    }

    const rebatePips = Number(config.rebatePips);
    const selfAmount = rebatePips * lots;
    const markupPips = Number(config.markupPips);
    const totalRebate = (rebatePips + markupPips) * lots;

    // Use CTE to get all ancestors including the current IB
    const ancestors: any[] = await this.prisma.$queryRaw`
      WITH RECURSIVE ancestor_tree AS (
        SELECT id, parent_id, level
        FROM ib_nodes
        WHERE id = (SELECT parent_id FROM ib_nodes WHERE id = ${ibId})
        
        UNION ALL
        
        SELECT n.id, n.parent_id, n.level
        FROM ib_nodes n
        INNER JOIN ancestor_tree a ON a.parent_id = n.id
      )
      SELECT a.id as "ibId", a.level, c.rebate_pips as "rebatePips"
      FROM ancestor_tree a
      JOIN rebate_configs c ON c.ib_id = a.id AND c.asset_type = ${assetType}::"AssetType" AND c.rebate_type = 'STP_REBATE'
      ORDER BY a.level DESC
    `;

    const distributed = ancestors.map(a => ({
      ibId: a.ibId,
      level: a.level,
      amount: Number(a.rebatePips) * lots,
    }));

    return {
      ibId,
      assetType,
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
}
