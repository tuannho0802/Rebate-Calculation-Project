const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixTree() {
  const nodes = await prisma.ibNode.findMany({ orderBy: { level: 'asc' }});
  const nodeMap = new Map();
  nodes.forEach(n => nodeMap.set(n.id, n));

  for (const node of nodes) {
    if (node.level > 0 && node.parentId) {
      const parent = nodeMap.get(node.parentId);
      if (parent && parent.accountType !== node.accountType) {
        console.log(`Fixing node ${node.email}: changing ${node.accountType} -> ${parent.accountType}`);
        await prisma.ibNode.update({
          where: { id: node.id },
          data: { accountType: parent.accountType }
        });
        // update memory so children get the correct type
        nodeMap.set(node.id, { ...node, accountType: parent.accountType });
      }
    }
  }
  console.log("Fix completed.");
}

fixTree().finally(() => prisma.$disconnect());
