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

  /**
   * NGUỒN DUY NHẤT để tính "trần" (maxPips) THỰC TẾ áp dụng cho một IB.
   * Dùng CHUNG cho cả đường đọc (getConfig) LẪN đường ghi/validate
   * (updateConfig) — bắt buộc, để tránh tái phát bug "2 nơi tính trần
   * khác nhau" (VĐ3 gốc, rồi lặp lại ở updateConfig() ngày 27/07/2026:
   * UI hiện trần fallback đúng nhưng lúc Lưu lại validate theo giá trị
   * raw trong DB chưa fallback → REBATE_EXCEEDS_PARENT sai, xem Test B).
   *
   * Quy tắc: CHỈ fallback về MAX_PIPS[assetType] (trần công ty) khi là
   * MIB (level 0) VÀ maxPips trong DB <= 0 (chưa từng được set / bị
   * reset). Với non-MIB, maxPips = 0 là trạng thái HỢP LỆ ("cấp trên
   * chưa cấp gì cho asset này"), KHÔNG được fallback — nếu không child
   * sẽ tưởng nhầm mình có full budget.
   */
  private resolveEffectiveMaxPips(rawMaxPips: number, isMib: boolean, assetType: AssetType): number {
    return isMib && rawMaxPips <= 0 ? (MAX_PIPS[assetType] || 0) : rawMaxPips;
  }

  async getConfig(ibId: string) {
    const [configs, ib] = await Promise.all([
      this.prisma.rebateConfig.findMany({
        where: { ibId },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.ibNode.findUnique({ where: { id: ibId }, select: { level: true } }),
    ]);

    // Fallback về "Trần công ty" (MAX_PIPS[assetType]) khi maxPips <= 0 —
    // CHỈ áp dụng cho MIB (level 0). Với non-MIB, maxPips = 0 là trạng thái
    // hợp lệ ("cấp trên chưa cấp/cấp 0 pips cho asset này"), KHÔNG được che
    // bằng trần mặc định, nếu không child sẽ tưởng mình có full budget.
    const isMib = ib?.level === 0;

    const existingAssets = configs.map((c: any) => {
      const rawMaxPips = Number(c.maxPips);
      const maxPips = this.resolveEffectiveMaxPips(rawMaxPips, isMib, c.assetType as AssetType);
      return {
        assetType: c.assetType,
        rebateType: c.rebateType,
        rebatePips: Number(c.rebatePips),
        markupPips: Number(c.markupPips),
        markupPercent: Number(c.markupPercent),
        maxPips,
        updatedAt: c.updatedAt,
      };
    });

    if (!isMib) {
      return {
        ibId,
        assets: existingAssets,
        updatedAt: configs.length > 0 ? configs[0].updatedAt : new Date(),
      };
    }

    // FIX (27/07/2026) — "bootstrap gap": MIB không có dòng rebateConfig nào
    // trong DB trừ khi Admin từng override, hoặc chính MIB đã tự cấu hình.
    // Trước đây điều này khiến getConfig() trả về assets=[] hoàn toàn cho MIB
    // dù MIB là root của cả 1 nhánh (Dashboard hiện "Chưa có cấu hình Rebate
    // nào được kích hoạt"). Giờ với MIB, đảm bảo MỌI AssetType đều xuất hiện —
    // asset chưa có dòng thật thì trả về "ảo" với maxPips = trần công ty mặc định,
    // giống hệt như thể đã có sẵn (không ghi gì xuống DB, chỉ synth ở response).
    const existingAssetTypes = new Set(existingAssets.map((a) => a.assetType));
    const syntheticAssets = Object.values(AssetType)
      .filter((at) => !existingAssetTypes.has(at))
      .map((at) => ({
        assetType: at,
        rebateType: 'STP_REBATE' as any,
        rebatePips: 0,
        markupPips: 0,
        markupPercent: 100,
        maxPips: MAX_PIPS[at] || 0,
        updatedAt: null as any,
      }));

    return {
      ibId,
      assets: [...existingAssets, ...syntheticAssets],
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

  async saveTemplates(ibId: string, dto: SaveRebateTemplatesDto, actorId: string) {
    // Snapshot before khi ghi audit — chỉ lấy tên (không lấy full rows/share để tránh
    // log quá nặng, nhưng đủ để biết "trước đây có gì, đã đổi thành gì")
    const [beforeAccountTemplates, beforeMarkupTemplates] = await Promise.all([
      this.prisma.accountTypeTemplate.findMany({ where: { ownerId: ibId }, select: { name: true } }),
      this.prisma.markupLinkTemplate.findMany({ where: { ownerId: ibId }, select: { name: true, share: true } }),
    ]);

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

    // Fix: audit log trước đây bị bỏ sót hoàn toàn cho endpoint này
    await this.auditService.log({
      actorId,
      action: AUDIT_ACTIONS.REBATE_TEMPLATES_UPDATE,
      targetType: 'REBATE_TEMPLATES',
      targetId: ibId,
      before: {
        accountTypeTemplates: beforeAccountTemplates.map((t) => t.name),
        markupLinkTemplates: beforeMarkupTemplates,
      },
      after: {
        accountTypeTemplates: dto.accountTypeTemplates.map((t) => t.name),
        markupLinkTemplates: dto.markupLinkTemplates.map((t) => ({ name: t.name, share: t.share })),
      },
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

    if (callerRole !== 'ADMIN') {
      if (!targetIb || targetIb.parentId !== currentUserId) {
        throw new ForbiddenException({
          code: 'REBATE_TARGET_NOT_DIRECT_CHILD',
          message: 'Bạn chỉ có quyền chỉnh sửa Rebate cho cấp dưới trực tiếp của mình',
        });
      }
    }

    const pendingCascades: Array<{ assetType: AssetType; rebateType: string }> = [];

    await this.prisma.$transaction(async (tx: any) => {
      for (const assetConfig of updateDto.assets) {
        const { assetType, rebateType = 'STP_REBATE', rebatePips, markupPips, markupPercent } = assetConfig;
        const parentIbId = targetIb?.parentId;
        const hasParent = !!(parentIbId && parentIbId !== targetIbId);
        const parentConfig = hasParent
          ? await tx.rebateConfig.findUnique({
            where: { ibId_assetType_rebateType: { ibId: parentIbId, assetType, rebateType: rebateType as any } },
            include: { ib: true },
          })
          : null;
        // Level 1 luôn có cha là MIB (level 0) theo đúng cấu trúc cây — suy luận
        // trực tiếp từ targetIb.level thay vì phụ thuộc parentConfig.ib.level, để
        // xử lý đúng cả trường hợp MIB CHƯA TỪNG có dòng rebateConfig nào trong DB
        // (bootstrap gap: MIB không có dòng riêng nếu Admin chưa từng override VÀ
        // MIB chưa từng tự cấu hình chính mình — mục 1.1 bên dưới bỏ qua khi
        // parentConfig null. Fix 27/07/2026, xem hand-off "MIB không hiện trên
        // Dashboard dù là root").
        const parentIsMib = hasParent && targetIb?.level === 1;

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

        if (hasParent) {
          // FIX Test B (27/07/2026): trước đây đọc thẳng parentConfig.maxPips
          // raw từ DB (có thể = 0 nếu MIB chưa từng được set), khiến validate
          // ở đây khác với số đang hiển thị trên UI (vốn đã fallback về trần
          // công ty MAX_PIPS[assetType] bên getConfig()). Giờ dùng chung 1
          // nguồn duy nhất qua resolveEffectiveMaxPips(). parentConfig có thể
          // là null (MIB chưa từng có dòng nào — bootstrap gap) → coi như raw=0,
          // vẫn fallback đúng về MAX_PIPS[assetType] khi parentIsMib.
          const effectiveParentMaxPips = this.resolveEffectiveMaxPips(
            parentConfig ? Number(parentConfig.maxPips) : 0,
            parentIsMib,
            assetType,
          );

          const parentRebateMax = parentIsMib
            ? effectiveParentMaxPips + Number(markupPips || 0)
            : Number(parentConfig?.rebatePips || 0);

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
          const rawExistingMaxPips = existing ? Number(existing.maxPips) : 0;
          const limit = rawExistingMaxPips > 0 ? rawExistingMaxPips : (MAX_PIPS[assetType] || 100);
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

        // FIX (27/07/2026): trước đây biến `targetShare` bị dùng cho 2 việc khác
        // nhau cùng lúc — (a) tính % cấp cha giữ lại (parentKeptPercent), và (b) bị
        // gán thẳng vào cột `markupPips` khi lưu (dòng update/create bên dưới). Vì
        // FE luôn gửi markupPercent=100 (hardcode ở handleSave), `markupPips` trong
        // DB bị ghi đè thành 100 cho MỌI asset, đè mất giá trị markupPips THẬT mà FE
        // gửi lên (vd addedMarkupPips theo Loại tài khoản). Giờ tách rõ 2 khái niệm:
        // `parentSharePercent` CHỈ dùng để tính % cấp cha giữ lại; `markupPips` (biến
        // gốc từ request, destructure ở đầu vòng lặp) mới là giá trị đúng để lưu vào
        // cột `markupPips` trong DB (xem đoạn upsert bên dưới).
        const parentSharePercent = markupPercent !== undefined ? markupPercent : 100;
        const parentKeptPercent = Math.max(0, 100 - parentSharePercent);

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

        // Max của mọi level >= 1 luôn = đúng số pips vừa nhận từ cấp trên (rebatePips),
        // KHÔNG lấy trần gốc của MIB. Đây là nguyên tắc cascade: 20 -> 15 -> 10 -> 5 -> 0,
        // mỗi mốc là max của chính level đó.
        // XOÁ HẲN explicitMaxPips — KHÔNG tin field maxPips từ request body của FE nữa
        // (dù FE có gửi lên hay không), vì đây chính là đường khiến addedMarkupPips
        // (VĐ2) hoặc bất kỳ giá trị tạm tính client-side nào bị ghi đè vĩnh viễn vào DB.
        const childMaxPips = targetIb?.level === 0
          ? this.resolveEffectiveMaxPips(existing ? Number(existing.maxPips) : 0, true, assetType)
          : rebatePips;

        // 2. Update -> after
        const updated = await tx.rebateConfig.upsert({
          where: { ibId_assetType_rebateType: { ibId: targetIbId, assetType, rebateType: rebateType as any } },
          update: {
            rebatePips,
            markupPips: Number(markupPips || 0),
            markupPercent: childRetainedPercent,
            maxPips: childMaxPips,
          },
          create: {
            ibId: targetIbId,
            assetType,
            rebateType: rebateType as any,
            rebatePips,
            markupPips: Number(markupPips || 0),
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

    if (pendingCascades.length > 0) {
      await this.smartCascadeCheckAndReset(
        targetIbId,
        pendingCascades,
        currentUserId,
      );
    }

    const actor = await this.prisma.ibNode.findUnique({
      where: { id: currentUserId },
      select: { name: true, email: true },
    });

    const scope = updateDto.notifyScope || 'direct';
    if (callerRole === 'ADMIN') {
      // Khi Admin sửa: Gửi ĐÚNG 1 thông báo sạch sẽ cho targetIb (không rác JSON)
      const changes = { assets: updateDto.assets.map(a => ({ asset: a.assetType, rebatePips: a.rebatePips, markupPips: a.markupPips })) };
      this.notificationService.notifyConfigChangedByAdmin(targetIbId, scope as any, changes, currentUserId);
    } else {
      // Khi Cấp trên (IB) sửa cho Cấp dưới (targetIb): Gửi ĐÚNG 1 thông báo cho Cấp dưới
      if (currentUserId !== targetIbId) {
        const actorLabel = actor?.name ? `${actor.name} (${actor.email})` : (actor?.email || 'Cấp trên');
        await this.notificationService.createSystemNotification({
          recipientId: targetIbId,
          type: 'REBATE_UPDATED' as any,
          title: 'Cập nhật hoa hồng Rebate từ cấp trên',
          body: `${actorLabel} đã cập nhật lại số dư hoa hồng Rebate cho tài khoản của bạn. Vui lòng vào trang Rebate Management để kiểm tra chi tiết.`,
          metadata: {
            updatedBy: currentUserId,
            actorEmail: actor?.email,
            targetIbId,
            changedAssets: updateDto.assets.map((a) => ({ assetType: a.assetType, rebateType: a.rebateType })),
          },
        });
      }

      // Thông báo cho Admin biết có thao tác sửa từ MIB/IB
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
        actionType: AUDIT_ACTIONS.REBATE_CONFIG_UPDATE,
        details: {
          targetIbId,
          targetEmail: targetNode?.email,
          changedAssets: updateDto.assets.map((a) => ({ assetType: a.assetType, rebateType: a.rebateType })),
        },
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

  async saveBranchScenario(dto: SaveBranchScenarioDto, currentUserId: string, callerRole?: string) {
    if (!dto.nodes || dto.nodes.length === 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Danh sách nodes không được để trống',
      });
    }

    // --- Fix IDOR: mọi ibId trong payload phải nằm trong subtree của currentUser
    // (chính mình + con trực tiếp, dùng chung util getSubtreeIds() với các chỗ khác
    // trong service), trừ khi caller là ADMIN. Check trước khi transaction để đảm bảo
    // atomic — không ghi 1 phần nếu 1 node trong payload không hợp lệ.
    const allowedIds = new Set(await getSubtreeIds(this.prisma, currentUserId, callerRole));
    const forbiddenIds = dto.nodes.map((n) => n.ibId).filter((id) => !allowedIds.has(id));
    if (forbiddenIds.length > 0) {
      throw new ForbiddenException({
        code: 'SCENARIO_TARGET_NOT_IN_SUBTREE',
        message: 'Bạn không có quyền lưu kịch bản cho các IB ngoài nhánh của mình',
        details: { forbiddenIds },
      });
    }

    const before = await this.prisma.rebateConfig.findMany({
      where: { ibId: { in: dto.nodes.map((n) => n.ibId) } },
      select: { ibId: true, assetType: true, rebateType: true, markupPercent: true, markupPips: true },
    });

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

    // --- Fix: audit log trước đây bị bỏ sót hoàn toàn cho endpoint này ---
    await this.auditService.log({
      actorId: currentUserId,
      action: AUDIT_ACTIONS.REBATE_SCENARIO_SAVE,
      targetType: 'REBATE_CONFIG_BRANCH',
      targetId: currentUserId,
      before: { nodes: before },
      after: { nodes: dto.nodes },
    });

    // --- Fix: đồng bộ với updateConfig() — báo Admin khi người thực hiện không phải Admin ---
    if (callerRole !== 'ADMIN') {
      const actor = await this.prisma.ibNode.findUnique({
        where: { id: currentUserId },
        select: { name: true, email: true },
      });
      const actorLabel = actor?.name ? `${actor.name} (${actor.email})` : (actor?.email || 'MIB/IB');
      await this.notificationService.notifyAdminsOnIbAction({
        actorId: currentUserId,
        title: `${actorLabel} đã lưu kịch bản phân bổ Rebate Engine`,
        body: `${actorLabel} vừa lưu kịch bản phân bổ % và pips cho ${dto.nodes.length} node trong nhánh. Vui lòng kiểm tra lại.`,
        actionType: AUDIT_ACTIONS.REBATE_SCENARIO_SAVE,
        details: { nodeIds: dto.nodes.map((n) => n.ibId), count: dto.nodes.length },
      });
    }

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

      // Lưu ý: KHÔNG chặn ov.maxPips theo MAX_PIPS[assetType] ở đây — MAX_PIPS là trần MẶC ĐỊNH,
      // còn setMibMaxOverride() tồn tại đúng để Admin set trần TUỲ CHỈNH thay thế trần mặc định đó.
      // Chặn theo MAX_PIPS sẽ làm tính năng override vô nghĩa (không bao giờ override được gì).

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

      // Fix: trước đây chỉ ghi vào RebateConfigHistory (bảng riêng, không filter
      // được qua GET /audit/logs) — giờ ghi thêm vào AuditLog trung tâm để nhất
      // quán với mọi thao tác nhạy cảm khác của Admin.
      await this.auditService.log({
        actorId: changedById,
        action: AUDIT_ACTIONS.REBATE_MAX_OVERRIDE,
        targetType: 'REBATE_CONFIG',
        targetId: updated.id,
        before: { mibId, assetType: ov.assetType, rebateType: ov.rebateType, maxPips: before ? Number(before.maxPips) : null },
        after: { mibId, assetType: ov.assetType, rebateType: ov.rebateType, maxPips: ov.maxPips },
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

  /**
   * Kiểm tra và thu hồi Rebate thông minh theo nhánh (Smart Cascade Reset):
   * Chỉ reset khi mức Rebate mới của Cấp trên < Mức Cấp dưới đã chia cho tuyến dưới.
   * Nếu mức mới >= Mức đã chia thì BẢO TOÀN toàn bộ nhánh con cháu.
   * Gom tất cả các sản phẩm bị ảnh hưởng gửi ĐÚNG 1 thông báo duy nhất cho từng người dùng.
   */
  private async smartCascadeCheckAndReset(
    parentId: string,
    pendingCascades: Array<{ assetType: AssetType; rebateType: string }>,
    changedById: string,
  ) {
    const actorInfo = await this.prisma.ibNode.findUnique({
      where: { id: changedById },
      select: { id: true, name: true, email: true },
    });
    const actorLabel = actorInfo?.name ? `${actorInfo.name} (${actorInfo.email})` : (actorInfo?.email || 'Cấp trên');

    // Quản lý map recipientId -> Set<AssetType> bị ảnh hưởng để chỉ gửi ĐÚNG 1 thông báo tổng hợp
    const affectedParentsMap = new Map<string, Set<AssetType>>();

    const checkNode = async (
      currentParentId: string,
      assetsToCheck: Array<{ assetType: AssetType; rebateType: string }>,
    ) => {
      const parentConfigs = await this.prisma.rebateConfig.findMany({
        where: { ibId: currentParentId },
      });
      const parentConfigMap = new Map(
        parentConfigs.map((c) => [`${c.assetType}:${c.rebateType}`, Number(c.rebatePips)]),
      );

      const directChildren = await this.prisma.ibNode.findMany({
        where: { parentId: currentParentId },
        select: { id: true, name: true, email: true },
      });

      for (const child of directChildren) {
        const childViolatedAssets: Array<{ assetType: AssetType; rebateType: string }> = [];

        for (const cascade of assetsToCheck) {
          const parentPips = parentConfigMap.get(`${cascade.assetType}:${cascade.rebateType}`) || 0;
          const childConfig = await this.prisma.rebateConfig.findUnique({
            where: {
              ibId_assetType_rebateType: {
                ibId: child.id,
                assetType: cascade.assetType,
                rebateType: cascade.rebateType as any,
              },
            },
          });

          if (childConfig && Number(childConfig.rebatePips) > parentPips) {
            childViolatedAssets.push(cascade);

            await this.prisma.rebateConfig.update({
              where: { id: childConfig.id },
              data: {
                rebatePips: 0,
                markupPips: 0,
                maxPips: 0,
              },
            });

            if (!affectedParentsMap.has(currentParentId)) {
              affectedParentsMap.set(currentParentId, new Set());
            }
            affectedParentsMap.get(currentParentId)!.add(cascade.assetType);
          }
        }

        if (childViolatedAssets.length > 0) {
          // Lan truyền kiểm tra đệ quy xuống nhánh của child
          await checkNode(child.id, childViolatedAssets);
        }
      }
    };

    await checkNode(parentId, pendingCascades);

    // Gửi duy nhất 1 thông báo tổng hợp cho từng recipientId bị ảnh hưởng
    for (const [recipientId, assetSet] of affectedParentsMap.entries()) {
      const assetListStr = Array.from(assetSet).join(', ');
      await this.notificationService.createSystemNotification({
        recipientId,
        type: 'REBATE_UPDATED' as any,
        title: 'Cập nhật lại số dư Rebate từ cấp trên',
        body: `${actorLabel} đã cập nhật lại số Rebate của bạn (${assetListStr}) và số Rebate mới được nhận không đủ để chia cấp dưới nên hãy vào setup lại.`,
        metadata: {
          affectedAssets: Array.from(assetSet),
          action: 'RESET_REQUIRED',
        },
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