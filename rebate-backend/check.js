const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const node = await prisma.ibNode.findUnique({ where: { email: 'datdoilau@gmail.com' }});
  console.log('datdoilau accountType:', node?.accountType);
  const children = await prisma.ibNode.findMany({ where: { parentId: node?.id } });
  console.log('children:', children.map(c => ({ email: c.email, accountType: c.accountType })));
}
run().finally(() => prisma.$disconnect());
