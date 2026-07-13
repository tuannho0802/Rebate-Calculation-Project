const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  await prisma.ibNode.update({ where: { email: 'datdoilau@gmail.com' }, data: { accountType: 'Markup 100%' } });
  const nodes = await prisma.ibNode.findMany();
  for (const node of nodes) {
    if (node.level > 1 && node.parentId) {
      const parent = nodes.find(n => n.id === node.parentId);
      if (parent && parent.accountType !== node.accountType) {
        console.log('fixing', node.email, 'to', parent.accountType);
        await prisma.ibNode.update({ where: { id: node.id }, data: { accountType: parent.accountType } });
      }
    }
  }
  console.log('Done');
}
run().finally(() => prisma.$disconnect());
