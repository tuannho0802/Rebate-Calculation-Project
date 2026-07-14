import { PrismaService } from '../src/prisma/prisma.service';
import { RebateService } from '../src/modules/rebate/rebate.service';

async function main() {
  const prisma = new PrismaService();
  const auditService = { log: async () => {} } as any;
  const notificationService = { notifyConfigChangedByAdmin: () => {} } as any;
  const rebateService = new RebateService(prisma, auditService, notificationService);

  const mibEmail = 'mib@test.com';
  const childName = 'Dong Ho Nguyen';
  const assetType = 'D_FOREX';
  const rebateType = 'STP_REBATE';

  const mib = await prisma.ibNode.findUnique({
    where: { email: mibEmail },
    select: { id: true, email: true, level: true },
  });
  if (!mib) throw new Error(`MIB_NOT_FOUND ${mibEmail}`);

  const child = await prisma.ibNode.findFirst({
    where: { name: childName, parentId: mib.id },
    select: { id: true, email: true, level: true, parentId: true },
  });
  if (!child) throw new Error(`CHILD_NOT_FOUND_OR_NOT_DIRECT_CHILD_OF_MIB`);

  const admin = await prisma.ibNode.findFirst({
    where: { role: 'ADMIN' },
    select: { id: true, email: true, level: true, role: true },
  });
  if (!admin) throw new Error('ADMIN_NOT_FOUND');

  const caller = { id: admin.id, level: admin.level, role: admin.role };

  const findCfg = async (ibId: string) => {
    const row = await prisma.rebateConfig.findUnique({
      where: { ibId_assetType_rebateType: { ibId, assetType: assetType as any, rebateType: rebateType as any } },
    });
    if (!row) return null;
    return {
      id: row.id,
      ibId: row.ibId,
      assetType: row.assetType,
      rebateType: row.rebateType,
      rebatePips: Number(row.rebatePips),
      markupPips: Number(row.markupPips),
      markupPercent: Number(row.markupPercent),
      maxPips: Number(row.maxPips),
      updatedAt: row.updatedAt,
    };
  };

  const beforeMib = await findCfg(mib.id);
  const beforeChild = await findCfg(child.id);

  const output: any = {
    step1_db_check: {
      mib,
      child,
      d_forex: { mib: beforeMib, child: beforeChild },
    },
  };

  if (!beforeMib || !beforeChild) {
    output.bulk_test = { skipped: true, reason: 'MISSING_CONFIG_ROW' };
    process.stdout.write(JSON.stringify(output, null, 2));
    return;
  }

  const resetToBaseline = async () => {
    await prisma.rebateConfig.update({
      where: { id: beforeMib.id },
      data: { rebatePips: 0, markupPips: 0, markupPercent: 100, maxPips: 15 },
    });
    await prisma.rebateConfig.update({
      where: { id: beforeChild.id },
      data: { rebatePips: beforeChild.rebatePips, markupPips: beforeChild.markupPips, markupPercent: beforeChild.markupPercent, maxPips: 0 },
    });
  };

  const restoreOriginal = async () => {
    await prisma.rebateConfig.update({
      where: { id: beforeMib.id },
      data: {
        rebatePips: beforeMib.rebatePips,
        markupPips: beforeMib.markupPips,
        markupPercent: beforeMib.markupPercent,
        maxPips: beforeMib.maxPips,
      },
    });
    await prisma.rebateConfig.update({
      where: { id: beforeChild.id },
      data: {
        rebatePips: beforeChild.rebatePips,
        markupPips: beforeChild.markupPips,
        markupPercent: beforeChild.markupPercent,
        maxPips: beforeChild.maxPips,
      },
    });
  };

  await resetToBaseline();

  const parentItem = {
    ibId: mib.id,
    assets: [{ assetType, rebateType, rebatePips: 0, markupPips: 5, markupPercent: 100 }],
  };
  const childItem = {
    ibId: child.id,
    assets: [{ assetType, rebateType, rebatePips: 3, markupPips: 0, markupPercent: 100 }],
  };

  const dtoParentFirst = { items: [parentItem, childItem], notifyScope: 'direct' as const };
  const dtoChildFirst = { items: [childItem, parentItem], notifyScope: 'direct' as const };

  let resParentFirst: any;
  let resChildFirst: any;
  let afterParentFirst: any;
  let afterChildFirst: any;

  try {
    resParentFirst = await rebateService.bulkUpdateConfig(caller.id, caller.level, dtoParentFirst as any, caller.role);
    afterParentFirst = {
      mib: await findCfg(mib.id),
      child: await findCfg(child.id),
    };

    await resetToBaseline();

    resChildFirst = await rebateService.bulkUpdateConfig(caller.id, caller.level, dtoChildFirst as any, caller.role);
    afterChildFirst = {
      mib: await findCfg(mib.id),
      child: await findCfg(child.id),
    };
  } finally {
    await restoreOriginal();
  }

  output.bulk_test = {
    admin_example: admin,
    caller_used_for_test: caller,
    parentFirst: {
      successCount: resParentFirst.successCount,
      failCount: resParentFirst.failCount,
      results: resParentFirst.results.map((r: any) => ({ ibId: r.ibId, success: r.success, errorCode: r.error?.code })),
      after: afterParentFirst,
    },
    childFirst: {
      successCount: resChildFirst.successCount,
      failCount: resChildFirst.failCount,
      results: resChildFirst.results.map((r: any) => ({ ibId: r.ibId, success: r.success, errorCode: r.error?.code })),
      after: afterChildFirst,
    },
    after: {
      mib: await findCfg(mib.id),
      child: await findCfg(child.id),
    },
  };

  process.stdout.write(JSON.stringify(output, null, 2));
}

main().catch((e) => {
  process.stderr.write(String(e && e.message ? e.message : e));
  process.exitCode = 1;
});
