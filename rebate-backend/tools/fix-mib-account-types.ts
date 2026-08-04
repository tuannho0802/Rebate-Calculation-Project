import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Inspecting and fixing IbNode and Templates account types in database...');

  const invalidAccountTypes = ['Markup 0%', 'SEA STD', 'Standard', 'ORPHAN_TEMPLATE_DELETED_V1', 'NONEXISTENT_ACCOUNT_TYPE_XYZ'];

  // 1. Fix AccountTypeTemplate names
  const accTemplates = await prisma.accountTypeTemplate.findMany();
  for (const t of accTemplates) {
    if (invalidAccountTypes.includes(t.name)) {
      await prisma.accountTypeTemplate.update({
        where: { id: t.id },
        data: { name: 'STD' },
      });
      console.log(`Updated AccountTypeTemplate ${t.id}: name changed from '${t.name}' to 'STD'`);
    }
  }

  // 2. Fix MarkupLinkTemplate names
  const markupTemplates = await prisma.markupLinkTemplate.findMany();
  for (const t of markupTemplates) {
    if (invalidAccountTypes.includes(t.name)) {
      await prisma.markupLinkTemplate.update({
        where: { id: t.id },
        data: { name: 'STD' },
      });
      console.log(`Updated MarkupLinkTemplate ${t.id}: name changed from '${t.name}' to 'STD'`);
    }
  }

  // 3. Fix IbNodes accountType & accountTypes
  const allNodes = await prisma.ibNode.findMany();

  for (const node of allNodes) {
    let needsUpdate = false;
    let newAccountType = node.accountType;
    let newAccountTypes = [...(node.accountTypes || [])];

    // If accountType is invalid or empty, change to "STD"
    if (!newAccountType || invalidAccountTypes.includes(newAccountType)) {
      newAccountType = 'STD';
      needsUpdate = true;
    }

    // Filter out invalid items in accountTypes
    newAccountTypes = newAccountTypes.map(t => (invalidAccountTypes.includes(t) ? 'STD' : t));
    if (newAccountTypes.length === 0) {
      newAccountTypes = [newAccountType];
      needsUpdate = true;
    }

    // Deduplicate
    newAccountTypes = Array.from(new Set(newAccountTypes));

    if (
      needsUpdate ||
      newAccountType !== node.accountType ||
      JSON.stringify(newAccountTypes) !== JSON.stringify(node.accountTypes)
    ) {
      await prisma.ibNode.update({
        where: { id: node.id },
        data: {
          accountType: newAccountType,
          accountTypes: newAccountTypes,
        },
      });
      console.log(`Updated node ${node.email} (${node.name}): accountType=${newAccountType}, accountTypes=[${newAccountTypes.join(', ')}]`);
    }
  }

  // 4. Fix RebateConfig records with legacy account types
  const updatedConfigs = await prisma.rebateConfig.updateMany({
    where: {
      accountType: { in: invalidAccountTypes },
    },
    data: {
      accountType: 'STD',
    },
  });

  console.log(`Updated ${updatedConfigs.count} RebateConfig entries with legacy account types.`);
  console.log('Fix completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error running fix script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
