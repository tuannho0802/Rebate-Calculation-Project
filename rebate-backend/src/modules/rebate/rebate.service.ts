import { Injectable, NotFoundException, UnprocessableEntityException, ForbiddenException, HttpException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateRebateConfigDto } from './dto/update-config.dto';
import { BulkUpdateRebateConfigDto } from './dto/bulk-update-config.dto';
import { SaveRebateTemplatesDto } from './dto/save-templates.dto';
import { SaveBranchScenarioDto } from './dto/save-scenario.dto';
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

    // Lấy ID của Admin để lấy các templates cấu hình mặc định
    const adminNode = await this.prisma.ibNode.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true },
    });
    const adminId = adminNode?.id;

    const ownerIds = [ownerId];
    if (adminId && adminId !== ownerId) {
      ownerIds.push(adminId);
    }

    const [accountTypeTemplates, markupLinkTemplates] = await Promise.all([
      this.prisma.accountTypeTemplate.findMany({ where: { ownerId: { in: ownerIds } } }),
      this.prisma.markupLinkTemplate.findMany({ where: { ownerId: { in: ownerIds } } }),
    ]);

    // Tránh trùng lặp tên template, ưu tiên template của MIB (ownerId)
    const uniqueAccountTemplates: any[] = [];
    const uniqueMarkupTemplates: any[] = [];

    accountTypeTemplates.forEach((t: any) => {
      const exists = uniqueAccountTemplates.some((ut) => ut.name === t.name);
      if (!exists || t.ownerId === ownerId) {
        if (exists) {
          const idx = uniqueAccountTemplates.findIndex((ut) => ut.name === t.name);
          uniqueAccountTemplates[idx] = t;
        } else {
          uniqueAccountTemplates.push(t);
        }
      }
    });

    markupLinkTemplates.forEach((t: any) => {
      const exists = uniqueMarkupTemplates.some((ut) => ut.name === t.name);
      if (!exists || t.ownerId === ownerId) {
        if (exists) {
          const idx = uniqueMarkupTemplates.findIndex((ut) => ut.name === t.name);
          uniqueMarkupTemplates[idx] = t;
        } else {
          uniqueMarkupTemplates.push(t);
        }
      }
    });

    return {
      accountTypeTemplates: uniqueAccountTemplates.map((template: any) => ({
        id: template.id,
        name: template.name,
        rows: template.rows,
      })),
      markupLinkTemplates: uniqueMarkupTemplates.map((template: any) => ({
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

  async updateConfig(
    currentUserId: string,
    currentUserLevel: number,
    targetIbId: string,
    updateDto: UpdateRebateConfigDto,
    callerRole?: string,
    proposedById?: Map<string, Record<string, { rebatePips: number; markupPips: number }>>,
  ) {
    const targetIb = await this.prisma.ibNode.findUnique({
      where: { id: targetIbId },
      select: { parentId: true, level: true, accountType: true },
    });

    if (callerRole !== 'ADMIN' && currentUserLevel > 0) {
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
        const parentIbId = targetIb?.parentId;
        const parentConfig = (parentIbId && parentIbId !== targetIbId)
          ? await tx.rebateConfig.findUnique({
            where: { ibId_assetType_rebateType: { ibId: parentIbId, assetType, rebateType: rebateType as any } },
            include: { ib: true },
          })
          : null;

        // 1. Lấy config hiện tại -> before
        const existing = await tx.rebateConfig.findUnique({
          where: { ibId_assetType_rebateType: { ibId: targetIbId, assetType, rebateType: rebateType as any } },
        });

        const before = existing ? {
          rebatePips: Number(existing.rebatePips),
          markupPips: Number(existing.markupPips),
          markupPercent: Number(existing.markupPercent),
        } : null;

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

        if (parentConfig) {
          const parentRebateMax = parentConfig.ib.level === 0
            ? Number(parentConfig.maxPips) + Number(markupPips || 0)
            : Number(parentConfig.rebatePips || 0);

          const parentMarkupMax = 100;

          if (rebatePips > parentRebateMax) {
            throw new UnprocessableEntityException({
              code: 'REBATE_EXCEEDS_PARENT',
              message: `rebatePips (${rebatePips}) vượt quá Rebate Max của cấp trên (${parentRebateMax} pips)`,
            });
          }

          const targetMarkupVal = markupPercent !== undefined ? markupPercent : markupPips;
          if (targetMarkupVal > parentMarkupMax) {
            throw new UnprocessableEntityException({
              code: 'MARKUP_EXCEEDS_PARENT',
              message: `markupPercent (${targetMarkupVal}%) vượt quá mức tối đa (100%)`,
            });
          }
        } else {
          const limit = (existing && Number(existing.maxPips) > 0) ? Number(existing.maxPips) : (MAX_PIPS[assetType] || 100);
          if (rebatePips > limit) {
            throw new UnprocessableEntityException({
              code: 'REBATE_EXCEEDS_MAX',
              message: `rebatePips (${rebatePips}) vượt quá giới hạn tối đa (${limit} pips)`,
            });
          }
          if (markupPips > limit) {
            throw new UnprocessableEntityException({
              code: 'MARKUP_EXCEEDS_MAX',
              message: `markupPips (${markupPips}) vượt quá giới hạn tối đa (${limit} pips)`,
            });
          }
        }

        const targetShare = markupPercent !== undefined ? markupPercent : markupPips;
        const parentKeptPercent = Math.max(0, 100 - targetShare);

        // 1.1 Cập nhật % Markup giữ lại cho IB cha (cấp trên)
        if (parentConfig && currentUserId !== targetIbId) {
          await tx.rebateConfig.upsert({
            where: { ibId_assetType_rebateType: { ibId: currentUserId, assetType, rebateType: rebateType as any } },
            update: { markupPercent: parentKeptPercent },
            create: {
              ibId: currentUserId,
              assetType,
              rebateType: rebateType as any,
              rebatePips: Number(parentConfig.rebatePips),
              markupPips: Number(parentConfig.markupPips),
              markupPercent: parentKeptPercent,
              maxPips: Number(parentConfig.maxPips),
            },
          });
        }

        // 1.2 Xác định % Markup giữ lại cho IB con (targetIb)
        // Mặc định nút lá chưa chia cho ai sẽ là 100%
        const childTargetConfig = await tx.rebateConfig.findUnique({
          where: { ibId_assetType_rebateType: { ibId: targetIbId, assetType, rebateType: rebateType as any } },
        });

        const childRetainedPercent = childTargetConfig && childTargetConfig.markupPercent !== null && childTargetConfig.markupPercent !== undefined
          ? Number(childTargetConfig.markupPercent)
          : 100;

        const calculatedMaxPips = (assetConfig as any).maxPips !== undefined && Number((assetConfig as any).maxPips) > 0
          ? Number((assetConfig as any).maxPips)
          : (parentConfig ? Number(parentConfig.maxPips) : (MAX_PIPS[assetType] || 0));

        const childMaxPips = targetIb?.level === 0
          ? (existing && Number(existing.maxPips) > 0 ? Number(existing.maxPips) : (MAX_PIPS[assetType] || 0))
          : (targetIb?.level === 1 ? calculatedMaxPips : rebatePips);

        // 2. Update -> after
        const updated = await tx.rebateConfig.upsert({
          where: { ibId_assetType_rebateType: { ibId: targetIbId, assetType, rebateType: rebateType as any } },
          update: {
            rebatePips,
            markupPips: targetShare,
            markupPercent: childRetainedPercent,
            maxPips: childMaxPips,
          },
          create: {
            ibId: targetIbId,
            assetType,
            rebateType: rebateType as any,
            rebatePips,
            markupPips: targetShare,
            markupPercent: childRetainedPercent,
            maxPips: childMaxPips,
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

        if (hasChange) {
          pendingCascades.push({ assetType, rebateType });
        }
      }
    });

    for (const cascade of pendingCascades) {
      await this.resetSubtreeAssets(
        targetIbId,
        cascade.assetType,
        cascade.rebateType,
        currentUserId,
      );
    }

    // ADMIN sửa xong -> bắn notification theo notifyScope
    // (chạy non-blocking sau khi transaction đã commit)
    const scope = updateDto.notifyScope || 'direct';
    if (callerRole === 'ADMIN') {
      // Trích xuất những asset bị thay đổi thực sự
      const changes = { assets: updateDto.assets.map(a => ({ asset: a.assetType, rebatePips: a.rebatePips, markupPips: a.markupPips })) };
      this.notificationService.notifyConfigChangedByAdmin(targetIbId, scope as any, changes, currentUserId);
    } else {
      // Khi MIB hoặc IB sửa Rebate config cho chính mình hoặc Sub-IB con -> thông báo cho Admin duyệt
      const actor = await this.prisma.ibNode.findUnique({
        where: { id: currentUserId },
        select: { name: true, email: true },
      });
      const targetNode = await this.prisma.ibNode.findUnique({
        where: { id: targetIbId },
        select: { name: true, email: true },
      });

      const title = `MIB/IB (${actor?.email}) đã cập nhật chia hoa hồng Rebate`;
      const body = `MIB/IB (${actor?.email}) vừa lưu lại cấu hình chia hoa hồng Rebate cho Sub-IB (${targetNode?.email || actor?.email}). Vui lòng kiểm tra lại tỷ lệ và số dư hoa hồng hệ thống.`;

      await this.notificationService.notifyAdminsOnIbAction({
        actorId: currentUserId,
        title,
        body,
        actionType: 'REBATE_CONFIG_UPDATE',
        details: { targetIbId, targetEmail: targetNode?.email, assetsCount: updateDto.assets.length },
      });
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

    // Build proposedById: giá trị SẼ ĐƯỢC GHI của mọi item trong bulk, dùng làm
    // nguồn truth cho dry-run validation (xem dryRunCascadeSubtree).
    const proposedById = new Map<string, Record<string, { rebatePips: number; markupPips: number }>>();
    for (const item of dto.items) {
      const perAsset: Record<string, { rebatePips: number; markupPips: number }> = {};
      for (const a of item.assets) {
        perAsset[`${a.assetType}:${a.rebateType ?? 'STP_REBATE'}`] = { rebatePips: a.rebatePips, markupPips: a.markupPips };
      }
      proposedById.set(item.ibId, perAsset);
    }

    for (const item of sortedItems) {
      try {
        const config = await this.updateConfig(
          currentUserId,
          currentUserLevel,
          item.ibId,
          { assets: item.assets, notifyScope: dto.notifyScope },
          callerRole,
          proposedById,
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

    const warnings: any[] = [];

    return { results, successCount, failCount, warnings };
  }

  async saveBranchScenario(dto: SaveBranchScenarioDto, currentUserId: string) {
    if (!dto.nodes || dto.nodes.length === 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Danh sách nodes không được để trống',
      });
    }

    await this.prisma.$transaction(async (tx: any) => {
      for (const node of dto.nodes) {
        await tx.rebateConfig.updateMany({
          where: { ibId: node.ibId },
          data: {
            markupPercent: node.markupPercent,
            markupPips: node.markupPips,
          },
        });
      }
    });

    return {
      success: true,
      message: 'Đã lưu kịch bản phân bổ vào cơ sở dữ liệu thành công',
    };
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

      await this.resetSubtreeAssets(mibId, ov.assetType, ov.rebateType, changedById);
    }

    return this.getConfig(mibId);
  }

  private async resetSubtreeAssets(
    rootId: string,
    assetType: AssetType,
    rebateType: string,
    changedById: string,
  ) {
    const subtree: any[] = await this.prisma.$queryRaw`
      WITH RECURSIVE subtree AS (
        SELECT id, "parentId" FROM ib_nodes WHERE id = ${rootId}
        UNION ALL
        SELECT n.id, n."parentId"
        FROM ib_nodes n
        INNER JOIN subtree s ON n."parentId" = s.id
      )
      SELECT id FROM subtree WHERE id != ${rootId}
    `;

    const allIdsToNotify = [rootId, ...(subtree).map((s) => s.id)];

    if (subtree.length > 0) {
      const descendantIds = subtree.map(s => s.id);
      await this.prisma.rebateConfig.updateMany({
        where: {
          ibId: { in: descendantIds },
          assetType,
          rebateType: rebateType as any,
        },
        data: {
          rebatePips: 0,
          markupPips: 0,
          maxPips: 0,
        }
      });
    }

    for (const id of allIdsToNotify) {
      this.notificationService.createSystemNotification({
        recipientId: id,
        type: 'REBATE_UPDATED' as any,
        title: 'Sửa đổi Rebate',
        body: 'Vui lòng bạn hãy vô kiểm tra lại Rebate hiện tại của mình',
        metadata: { assetType, action: 'RESET' },
      });
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