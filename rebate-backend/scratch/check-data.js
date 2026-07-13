const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  console.log('--- ib_nodes ---');
  const nodes = await prisma.$queryRawUnsafe('SELECT email, level, "accountType", "referralCode" FROM ib_nodes LIMIT 10');
  console.table(nodes);

  console.log('--- count account_type_templates ---');
  const count1 = await prisma.$queryRawUnsafe('SELECT COUNT(*) FROM account_type_templates');
  console.log(count1[0].count.toString());

  console.log('--- count markup_link_templates ---');
  const count2 = await prisma.$queryRawUnsafe('SELECT COUNT(*) FROM markup_link_templates');
  console.log(count2[0].count.toString());
}
main().catch(console.error).finally(() => prisma.$disconnect());
