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

  async updateConfig(
    currentUserId: string,
    currentUserLevel: number,
    targetIbId: string,
    updateDto: UpdateRebateConfigDto,
    callerRole?: string,
    proposedById?: Map<string, Record<string, { rebatePips: number; markupPips: number }>>,
  ) {
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
          // PHA 1 — DRY-RUN: tính toán cascade cho toàn bộ subtree (KHÔNG ghi DB).
          // Nếu bất kỳ node con nào sẽ vi phạm (đang giữ > trần mới) → CHẶN CỨNG,
          // ném lỗi trước khi commit, giữ nguyên toàn bộ trạng thái cũ.
          // Validation dùng proposedById (toàn bộ item trong cùng bulk) làm nguồn
          // giá trị sẽ được ghi, nên bulk gửi cả tổ tiên lẫn con cùng lúc vẫn qua được.
          const dryViolations = await this.dryRunCascadeSubtree(
            targetIbId,
            assetType,
            rebateType,
            limit,
            rebatePips,
            proposedById ?? new Map(),
            tx,
          );
          const violating = dryViolations.filter(n => n.rebatePips + n.markupPips > n.newMaxPips);
          if (violating.length > 0) {
            const nodeNames = await tx.ibNode.findMany({
              where: { id: { in: violating.map(v => v.ibId) } },
              select: { id: true, name: true, email: true },
            });
            const nameById = new Map(nodeNames.map((n: any) => [n.id, n.name ?? n.email]));
            const lines = violating.map(v => {
              const held = v.rebatePips + v.markupPips;
              const nm = nameById.get(v.ibId) ?? v.ibId;
              return `- ${nm}: đang giữ ${v.rebatePips} rebate + ${v.markupPips} markup = ${held}, trần mới sẽ chỉ còn ${v.newMaxPips}.`;
            });
            throw new UnprocessableEntityException({
              code: 'CASCADE_WOULD_VIOLATE_DESCENDANT',
              message:
                `Không thể lưu vì sẽ khiến các node cấp dưới vượt trần:\n${lines.join('\n')}\n` +
                `Vui lòng giảm rebate/markup của các node vi phạm trước khi lưu.`,
              details: {
                violations: violating.map(v => ({
                  ibId: v.ibId,
                  newMaxPips: v.newMaxPips,
                  rebatePips: v.rebatePips,
                  markupPips: v.markupPips,
                })),
              },
            });
          }
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

    const warnings = await this.checkBulkLeftoverViolations(currentUserId, results);

    return { results, successCount, failCount, warnings };
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

      // PHA 1 — DRY-RUN: nếu hạ trần MIB khiến 1 node con vượt trần → CHẶN CỨNG
      // trước khi ghi bất kỳ gì (giữ nguyên trạng thái cũ).
      const mibRebatePips = before ? Number(before.rebatePips) : 0;
      const dryViolations = await this.dryRunCascadeSubtree(
        mibId,
        ov.assetType,
        ov.rebateType,
        ov.maxPips,
        mibRebatePips,
        new Map(),
        this.prisma,
      );
      const violating = dryViolations.filter(n => n.rebatePips + n.markupPips > n.newMaxPips);
      if (violating.length > 0) {
        const nodeNames = await this.prisma.ibNode.findMany({
          where: { id: { in: violating.map(v => v.ibId) } },
          select: { id: true, name: true, email: true },
        });
        const nameById = new Map(nodeNames.map((n: any) => [n.id, n.name ?? n.email]));
        const lines = violating.map(v => {
          const held = v.rebatePips + v.markupPips;
          const nm = nameById.get(v.ibId) ?? v.ibId;
          return `- ${nm}: đang giữ ${v.rebatePips} rebate + ${v.markupPips} markup = ${held}, trần mới sẽ chỉ còn ${v.newMaxPips}.`;
        });
        throw new UnprocessableEntityException({
          code: 'CASCADE_WOULD_VIOLATE_DESCENDANT',
          message:
            `Không thể set trần MIB vì sẽ khiến các node cấp dưới vượt trần:\n${lines.join('\n')}\n` +
            `Vui lòng giảm rebate/markup của các node vi phạm trước khi lưu.`,
          details: {
            violations: violating.map(v => ({
              ibId: v.ibId,
              newMaxPips: v.newMaxPips,
              rebatePips: v.rebatePips,
              markupPips: v.markupPips,
            })),
          },
        });
      }

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

  /**
   * PHA 1 (DRY-RUN) của cascade: tính toán newMaxPips cho TOÀN BỘ subtree theo công thức
   *   newMaxPips(con) = max(0, maxPips(cha) - rebatePips(cha))
   * NHƯNG KHÔNG GHI DB. Trả về danh sách node kèm (rebatePips, markupPips, newMaxPips)
   * để caller so sánh và phát hiện vi phạm (đang giữ > trần mới).
   *
   * `proposedById` chứa giá trị SẼ ĐƯỢC GHI của các node khác trong cùng 1 bulk request
   * (key = `${assetType}:${rebateType}`). Nếu 1 node có proposed value, dùng giá trị đó
   * thay vì DB hiện tại — đảm bảo bulk gửi cả tổ tiên lẫn con cùng lúc vẫn validate đúng.
   *
   * `prisma` có thể là tx (trong transaction) hoặc this.prisma (setMibMaxOverride).
   */
  private async dryRunCascadeSubtree(
    rootId: string,
    assetType: AssetType,
    rebateType: string,
    rootMaxPips: number,
    rootRebatePips: number,
    proposedById: Map<string, Record<string, { rebatePips: number; markupPips: number }>>,
    prisma: any,
  ): Promise<Array<{ ibId: string; newMaxPips: number; rebatePips: number; markupPips: number }>> {
    const subtree: { id: string; parentId: string | null; level: number }[] = await prisma.$queryRaw`
      WITH RECURSIVE subtree AS (
        SELECT id, "parentId", level FROM ib_nodes WHERE id = ${rootId}
        UNION ALL
        SELECT n.id, n."parentId", n.level
        FROM ib_nodes n
        INNER JOIN subtree s ON n."parentId" = s.id
      )
      SELECT id, "parentId", level FROM subtree WHERE id != ${rootId} ORDER BY level ASC
    `;

    const computedMax = new Map<string, number>();
    computedMax.set(rootId, rootMaxPips);
    const key = `${assetType}:${rebateType}`;
    const out: Array<{ ibId: string; newMaxPips: number; rebatePips: number; markupPips: number }> = [];

    for (const node of subtree) {
      const parentId = node.parentId!;
      const parentMax = computedMax.get(parentId)!;
      let parentRebate: number;
      if (parentId === rootId) {
        parentRebate = rootRebatePips;
      } else {
        const prop = proposedById.get(parentId)?.[key];
        if (prop) {
          parentRebate = prop.rebatePips;
        } else {
          const pc = await prisma.rebateConfig.findUnique({
            where: { ibId_assetType_rebateType: { ibId: parentId, assetType, rebateType: rebateType as any } },
          });
          parentRebate = pc ? Number(pc.rebatePips) : 0;
        }
      }
      const newMaxPips = Math.max(0, parentMax - parentRebate);
      computedMax.set(node.id, newMaxPips);

      const prop = proposedById.get(node.id)?.[key];
      let rebatePips: number;
      let markupPips: number;
      if (prop) {
        rebatePips = prop.rebatePips;
        markupPips = prop.markupPips;
      } else {
        const nc = await prisma.rebateConfig.findUnique({
          where: { ibId_assetType_rebateType: { ibId: node.id, assetType, rebateType: rebateType as any } },
        });
        rebatePips = nc ? Number(nc.rebatePips) : 0;
        markupPips = nc ? Number(nc.markupPips) : 0;
      }
      out.push({ ibId: node.id, newMaxPips, rebatePips, markupPips });
    }
    return out;
  }

  /**
   * Sau khi 1 bulkUpdateConfig xử lý xong (kể cả có item fail), quét lại TOÀN BỘ node
   * từng bị cascade ảnh hưởng để phát hiện vi phạm còn sót lại (trường hợp 1 item trong
   * nhóm fail sau khi item khác đã cascade xuống nó). Không tự sửa — chỉ đánh dấu
   * `warnings` trong response và ghi audit `BULK_PARTIAL_LEFT_VIOLATION` để admin biết
   * xử lý tay, không để âm thầm tồn tại trong DB.
   */
  private async checkBulkLeftoverViolations(
    actorId: string,
    results: Array<{ ibId: string; success: boolean }>,
  ): Promise<Array<{ ibId: string; assetType: string; rebateType: string; rebatePips: number; markupPips: number; maxPips: number }>> {
    const savedIds = results.filter(r => r.success).map(r => r.ibId);
    if (savedIds.length === 0) return [];

    let affected: string[] = [];
    for (const id of savedIds) {
      const sub: { id: string }[] = await this.prisma.$queryRaw`
        WITH RECURSIVE subtree AS (
          SELECT id, "parentId" FROM ib_nodes WHERE id = ${id}
          UNION ALL
          SELECT n.id, n."parentId" FROM ib_nodes n INNER JOIN subtree s ON n."parentId" = s.id
        )
        SELECT id FROM subtree WHERE id != ${id}
      `;
      affected = affected.concat(sub.map(s => s.id));
    }
    if (affected.length === 0) return [];

    const violated: any[] = await this.prisma.$queryRaw`
      SELECT rc."ibId", rc."assetType", rc."rebateType", rc."rebatePips", rc."markupPips", rc."maxPips"
      FROM rebate_configs rc
      WHERE rc."ibId" = ANY(${affected}::text[])
        AND (rc."rebatePips" + rc."markupPips") > rc."maxPips"
    `;

    const warnings = violated.map((v: any) => ({
      ibId: v.ibId,
      assetType: v.assetType,
      rebateType: v.rebateType,
      rebatePips: Number(v.rebatePips),
      markupPips: Number(v.markupPips),
      maxPips: Number(v.maxPips),
    }));

    for (const w of warnings) {
      await this.auditService.log({
        actorId,
        action: AUDIT_ACTIONS.BULK_PARTIAL_LEFT_VIOLATION,
        targetType: 'REBATE_CONFIG',
        targetId: w.ibId,
        after: { assetType: w.assetType, rebateType: w.rebateType, rebatePips: w.rebatePips, markupPips: w.markupPips, maxPips: w.maxPips },
      });
    }
    return warnings;
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