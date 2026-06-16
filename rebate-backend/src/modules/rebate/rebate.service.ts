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
        const { assetType, rebatePips, markupPips, markupPercent } = assetConfig;

        const existingChildConfig = await tx.rebateConfig.findUnique({
          where: { ibId_assetType: { ibId: targetIbId, assetType } },
        });

        const limit = existingChildConfig ? Number(existingChildConfig.maxPips) : (MAX_PIPS[assetType] || 0);

        if (rebatePips + markupPips > limit) {
          throw new UnprocessableEntityException({
            code: 'REBATE_EXCEEDS_MAX',
            message: `Tổng rebate vượt quá giới hạn cho phép (${limit} pips)`,
          });
        }

        // Update target configuration
        await tx.rebateConfig.upsert({
          where: { ibId_assetType: { ibId: targetIbId, assetType } },
          update: {
            rebatePips,
            markupPips,
            markupPercent,
          },
          create: {
            ibId: targetIbId,
            assetType,
            rebatePips,
            markupPips,
            markupPercent,
            maxPips: limit,
          },
        });

        // Cascading update child's children: child's rebatePips becomes their new maxPips limit
        await tx.rebateConfig.updateMany({
          where: {
            ib: { parentId: targetIbId },
            assetType,
          },
          data: {
            maxPips: rebatePips,
          },
        });
      }

      return this.getConfig(targetIbId);
    });
  }

  async calculate(ibId: string, assetType: AssetType, lots: number) {
    const config = await this.prisma.rebateConfig.findUnique({
      where: { ibId_assetType: { ibId, assetType } },
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

    // Traverse down to find distributed amounts
    const distributed: Array<{ ibId: string; level: number; amount: number }> = [];
    let currentId = ibId;

    while (true) {
      const child = await this.prisma.ibNode.findFirst({
        where: { parentId: currentId },
      });
      if (!child) break;

      const childConfig = await this.prisma.rebateConfig.findUnique({
        where: { ibId_assetType: { ibId: child.id, assetType } },
      });

      const childRebatePips = childConfig ? Number(childConfig.rebatePips) : 0;
      distributed.push({
        ibId: child.id,
        level: child.level,
        amount: childRebatePips * lots,
      });

      currentId = child.id;
    }

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
