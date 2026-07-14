import { Injectable, NotFoundException, UnprocessableEntityException, ForbiddenException, HttpException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateRebateConfigDto } from './dto/update-config.dto';
import { BulkUpdateRebateConfigDto } from './dto/bulk-update-config.dto';
import { SaveRebateTemplatesDto } from './dto/save-templates.dto';
import { AssetType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../audit/audit.constants';
import { getSubtreeIds } from '../../common/utils/subtree.util';
import { NotificationService } from '../notification/notification.service';

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
    private readonly notificationService: NotificationService,
  ) { }

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

  async getTemplates(ibId: string) {
    // Find the root MIB for this ibId
    const rootIb: any[] = await this.prisma.$queryRaw`
      WITH RECURSIVE ancestor_tree AS (
        SELECT id, "parentId" FROM ib_nodes WHERE id = ${ibId}
        UNION ALL
        SELECT n.id, n."parentId" FROM ib_nodes n
        INNER JOIN ancestor_tree a ON n.id = a."parentId"
      )
      SELECT id FROM ancestor_tree WHERE "parentId" IS NULL LIMIT 1
    `;

    const ownerId = rootIb.length > 0 ? rootIb[0].id : ibId;

    const [accountTypeTemplates, markupLinkTemplates] = await Promise.all([
      this.prisma.accountTypeTemplate.findMany({ where: { ownerId } }),
      this.prisma.markupLinkTemplate.findMany({ where: { ownerId } }),
    ]);

    return {
      accountTypeTemplates: accountTypeTemplates.map((template: any) => ({
        id: template.id,
        name: template.name,
        rows: template.rows,
      })),
      markupLinkTemplates: markupLinkTemplates.map((template: any) => ({
        id: template.id,
        name: template.name,
        share: Number(template.share),
      })),
    };
  }

  async saveTemplates(ibId: string, dto: SaveRebateTemplatesDto) {
    await this.prisma.$transaction(async (tx: any) => {
      await tx.markupLinkTemplate.deleteMany({ where: { ownerId: ibId } });
      await tx.accountTypeTemplate.deleteMany({ where: { ownerId: ibId } });

      await tx.accountTypeTemplate.createMany({
        data: dto.accountTypeTemplates.map((template) => ({
          ownerId: ibId,
          name: template.name,
          rows: template.rows,
        })),
      });

      await tx.markupLinkTemplate.createMany({
        data: dto.markupLinkTemplates.map((link) => ({
          ownerId: ibId,
          name: link.name,
          share: link.share,
        })),
      });
    });

    return this.getTemplates(ibId);
  }

  async updateConfig(currentUserId: string, currentUserLevel: number, targetIbId: string, updateDto: UpdateRebateConfigDto, callerRole?: string) {
    // ADMIN: bypass chọn hoàn toàn, được set config cho bất kỳ IB nào
    // Lv0: bypass subtree (SubtreeGuard đã kiểm soat cross-tree)
    // Lv1+: chỉ được set config cho con trực tiếp
    if (callerRole !== 'ADMIN' && currentUserLevel > 0) {
      const targetIb = await this.prisma.ibNode.findUnique({
        where: { id: targetIbId },
        select: { parentId: true },
      });
      if (!targetIb || targetIb.parentId !== currentUserId) {
        throw new ForbiddenException({
          code: 'REBATE_TARGET_NOT_DIRECT_CHILD',
          message: 'Ban chi co the set rebate config cho IB truc tiep duoi ban',
        });
      }
    }

    const pendingCascades: Array<{ assetType: AssetType; rebateType: string }> = [];

    await this.prisma.$transaction(async (tx: any) => {
      for (const assetConfig of updateDto.assets) {
        const { assetType, rebateType = 'STP_REBATE', rebatePips, markupPips, markupPercent } = assetConfig;
        const isSelfTarget = currentUserId === targetIbId;

        const parentConfig = isSelfTarget
          ? null
          : await tx.rebateConfig.findUnique({
            where: { ibId_assetType_rebateType: { ibId: currentUserId, assetType, rebateType: rebateType as any } },
          });

        // 1. Lấy config hiện tại -> before
        const existing = await tx.rebateConfig.findUnique({
          where: { ibId_assetType_rebateType: { ibId: targetIbId, assetType, rebateType: rebateType as any } },
        });

        const before = existing ? {
          rebatePips: Number(existing.rebatePips),
          markupPips: Number(existing.markupPips),
          markupPercent: Number(existing.markupPercent),
        } : null;

        const totalRequested = rebatePips + markupPips;
        const totalExisting = before ? (before.rebatePips + before.markupPips) : 0;

        let limit: number;
        if (parentConfig) {
          limit = Number(parentConfig.markupPips);
        } else {
          limit = existing ? Number(existing.maxPips) : (MAX_PIPS[assetType] || 0);
        }

        if (parentConfig) {
          if (rebatePips < 0) {
            throw new UnprocessableEntityException({
              code: 'REBATE_INVALID',
              message: 'rebatePips phải lớn hơn hoặc bằng 0',
            });
          }

          if (markupPips < 0) {
            throw new UnprocessableEntityException({
              code: 'MARKUP_INVALID',
              message: 'markupPips phải lớn hơn hoặc bằng 0',
            });
          }

          if (rebatePips > limit) {
            throw new UnprocessableEntityException({
              code: 'REBATE_EXCEEDS_MAX',
              message: `Số rebatePips vượt quá giới hạn tối đa (${limit} pips)`,
            });
          }

          if (rebatePips + markupPips > limit) {
            throw new UnprocessableEntityException({
              code: 'MARKUP_EXCEEDS_MAX',
              message: `Tổng rebatePips + markupPips vượt quá giới hạn tối đa (${limit} pips)`,
            });
          }
        } else {
          if (rebatePips > limit) {
            throw new UnprocessableEntityException({
              code: 'REBATE_EXCEEDS_MAX',
              message: `Số rebatePips vượt quá giới hạn tối đa (${limit} pips)`,
            });
          }
          if (markupPips > limit) {
            throw new UnprocessableEntityException({
              code: 'MARKUP_EXCEEDS_MAX',
              message: `Số markupPips vượt quá giới hạn tối đa (${limit} pips)`,
            });
          }
        }

        // 2. Update -> after
        const updated = await tx.rebateConfig.upsert({
          where: { ibId_assetType_rebateType: { ibId: targetIbId, assetType, rebateType: rebateType as any } },
          update: {
            rebatePips,
            markupPips,
            markupPercent,
            maxPips: limit,
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

        // 4. Cascading update toàn subtree sau khi transaction commit
        // (cascade đọc trực tiếp maxPips/rebatePips vừa ghi của targetIbId,
        // không cần truyền số liệu qua tay — xem cascadeMaxPipsToSubtree)
        if (hasChange && existing && totalRequested !== totalExisting) {
          pendingCascades.push({ assetType, rebateType });
        }
      }
    });

    for (const cascade of pendingCascades) {
      await this.cascadeMaxPipsToSubtree(
        targetIbId,
        cascade.assetType,
        cascade.rebateType,
        currentUserId,
      );
    }

    // ADMIN sửa xong -> bắn notification theo notifyScope
    // (chạy non-blocking sau khi transaction đã commit)
    if (callerRole === 'ADMIN') {
      const scope = updateDto.notifyScope || 'direct';
      // Trích xuất những asset bị thay đổi thực sự
      const changes = { assets: updateDto.assets.map(a => ({ asset: a.assetType, rebatePips: a.rebatePips, markupPips: a.markupPips })) };
      this.notificationService.notifyConfigChangedByAdmin(targetIbId, scope as any, changes, currentUserId);
    }

    return this.getConfig(targetIbId);
  }

  async bulkUpdateConfig(
    currentUserId: string,
    currentUserLevel: number,
    dto: BulkUpdateRebateConfigDto,
    callerRole?: string,
  ) {
    const results: Array<{
      ibId: string;
      success: boolean;
      config?: Awaited<ReturnType<RebateService['getConfig']>>;
      error?: { code: string; message: string; details?: Record<string, unknown> };
    }> = [];
    let successCount = 0;
    let failCount = 0;

    const ibs = await this.prisma.ibNode.findMany({
      where: { id: { in: dto.items.map(i => i.ibId) } },
      select: { id: true, level: true },
    });
    const levelById = new Map(ibs.map(i => [i.id, i.level]));
    const sortedItems = [...dto.items].sort((a, b) => {
      const la = levelById.get(a.ibId) ?? Number.MAX_SAFE_INTEGER;
      const lb = levelById.get(b.ibId) ?? Number.MAX_SAFE_INTEGER;
      return la - lb;
    });

    for (const item of sortedItems) {
      try {
        const config = await this.updateConfig(
          currentUserId,
          currentUserLevel,
          item.ibId,
          { assets: item.assets, notifyScope: dto.notifyScope },
          callerRole,
        );
        results.push({ ibId: item.ibId, success: true, config });
        successCount += 1;
      } catch (error) {
        const err = error as HttpException;
        const response = typeof err.getResponse === 'function'
          ? (err.getResponse() as { code?: string; message?: string; details?: Record<string, unknown> })
          : undefined;

        // eslint-disable-next-line no-console
        console.error('bulkUpdateConfig item failed', {
          ibId: item.ibId,
          error: error instanceof Error ? error.message : String(error),
        });

        results.push({
          ibId: item.ibId,
          success: false,
          error: {
            code: response?.code ?? 'INTERNAL_ERROR',
            message: response?.message ?? (error instanceof Error ? error.message : 'Đã có lỗi xảy ra'),
            details: response?.details ?? {},
          },
        });
        failCount += 1;
      }
    }

    return { results, successCount, failCount };
  }

  async setMibMaxOverride(
    mibId: string,
    overrides: { assetType: AssetType; rebateType: string; maxPips: number }[],
    changedById: string,
  ) {
    const mib = await this.prisma.ibNode.findUnique({ where: { id: mibId }, select: { level: true } });
    if (!mib || mib.level !== 0) {
      throw new BadRequestException({
        code: 'NOT_A_MIB',
        message: 'Chỉ được set trần tuỳ chỉnh cho MIB (level 0)',
      });
    }

    for (const ov of overrides) {
      if (ov.maxPips < 0) {
        throw new UnprocessableEntityException({
          code: 'MAX_OVERRIDE_INVALID',
          message: 'Trần tuỳ chỉnh phải >= 0',
        });
      }

      const companyCeiling = MAX_PIPS[ov.assetType];
      if (companyCeiling !== undefined && ov.maxPips > companyCeiling) {
        throw new UnprocessableEntityException({
          code: 'MAX_OVERRIDE_INVALID',
          message: `Trần tuỳ chỉnh (${ov.maxPips}) vượt quá trần công ty (${companyCeiling} pips) cho ${ov.assetType}`,
        });
      }

      const before = await this.prisma.rebateConfig.findUnique({
        where: { ibId_assetType_rebateType: { ibId: mibId, assetType: ov.assetType, rebateType: ov.rebateType as any } },
      });

      const updated = await this.prisma.rebateConfig.upsert({
        where: { ibId_assetType_rebateType: { ibId: mibId, assetType: ov.assetType, rebateType: ov.rebateType as any } },
        update: { maxPips: ov.maxPips },
        create: {
          ibId: mibId,
          assetType: ov.assetType,
          rebateType: ov.rebateType as any,
          rebatePips: 0,
          markupPips: 0,
          markupPercent: 100,
          maxPips: ov.maxPips,
        },
      });

      await this.prisma.rebateConfigHistory.create({
        data: {
          rebateConfigId: updated.id,
          changedById,
          before: { maxPips: before ? Number(before.maxPips) : null },
          after: { maxPips: ov.maxPips },
        },
      });

      await this.cascadeMaxPipsToSubtree(mibId, ov.assetType, ov.rebateType, changedById);
    }

    return this.getConfig(mibId);
  }

  private async cascadeMaxPipsToSubtree(
    rootId: string,
    assetType: AssetType,
    rebateType: string,
    changedById: string,
  ) {
    const subtree: { id: string; parentId: string | null; level: number }[] = await this.prisma.$queryRaw`
      WITH RECURSIVE subtree AS (
        SELECT id, "parentId", level FROM ib_nodes WHERE id = ${rootId}
        UNION ALL
        SELECT n.id, n."parentId", n.level
        FROM ib_nodes n
        INNER JOIN subtree s ON n."parentId" = s.id
      )
      SELECT id, "parentId", level FROM subtree WHERE id != ${rootId} ORDER BY level ASC
    `;

    // CÔNG THỨC DUY NHẤT cho maxPips trong toàn hệ thống — "ngân sách còn lại":
    //   maxPips(con) = maxPips(cha) - rebatePips(cha)
    // Tức là trần của con = trần của cha trừ đi phần cha đã tự giữ cho mình.
    // Đây là cơ chế cascade DUY NHẤT ghi vào field maxPips — thay thế mọi cascade
    // khác trong hệ thống (kể cả cascade từng chạy cuối updateConfig()).
    // parentConfig luôn đọc được giá trị mới nhất vì subtree xử lý tuần tự theo
    // level ASC (cha luôn được upsert xong trước khi tới lượt con).
    for (const node of subtree) {
      const parentConfig = await this.prisma.rebateConfig.findUnique({
        where: { ibId_assetType_rebateType: { ibId: node.parentId!, assetType, rebateType: rebateType as any } },
      });
      const parentRemaining = parentConfig
        ? Number(parentConfig.maxPips) - Number(parentConfig.rebatePips)
        : 0;
      const newMaxPips = Math.max(0, parentRemaining);

      const existingConfig = await this.prisma.rebateConfig.findUnique({
        where: { ibId_assetType_rebateType: { ibId: node.id, assetType, rebateType: rebateType as any } },
      });

      await this.prisma.rebateConfig.upsert({
        where: { ibId_assetType_rebateType: { ibId: node.id, assetType, rebateType: rebateType as any } },
        update: { maxPips: newMaxPips },
        create: {
          ibId: node.id,
          assetType,
          rebateType: rebateType as any,
          rebatePips: 0,
          markupPips: 0,
          markupPercent: 100,
          maxPips: newMaxPips,
        },
      });

      const existingRebate = existingConfig ? Number(existingConfig.rebatePips) : 0;
      const existingMarkup = existingConfig ? Number(existingConfig.markupPips) : 0;
      if (existingRebate + existingMarkup > newMaxPips) {
        await this.auditService.log({
          actorId: changedById,
          action: AUDIT_ACTIONS.REBATE_CONFIG_OVER_CEILING_DETECTED,
          targetType: 'REBATE_CONFIG',
          targetId: node.id,
          after: { rebatePips: existingRebate, markupPips: existingMarkup, newMaxPips },
        });
      }
    }
  }

  async calculateCascadeDistribution(
    ibId: string,
    assetType: AssetType,
    lots: number,
    rebateType: string = 'STP_REBATE'
  ) {
    const config = await this.prisma.rebateConfig.findUnique({
      where: { ibId_assetType_rebateType: { ibId, assetType, rebateType: rebateType as any } },
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
        AND c."rebateType" = ${rebateType}
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
    callerRole?: string,
  ) {
    // Verify ibId trong subtree (ADMIN bypass)
    if (callerRole !== 'ADMIN' && currentUserId !== ibId) {
      const target = await this.prisma.ibNode.findUnique({ where: { id: ibId }, select: { parentId: true } });
      if (!target || target.parentId !== currentUserId) {
        throw new ForbiddenException({ code: 'IB_NOT_IN_SUBTREE' });
      }
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