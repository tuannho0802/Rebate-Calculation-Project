const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  console.log('--- COLUMNS IN ib_nodes ---');
  const cols = await prisma.$queryRawUnsafe('SELECT column_name FROM information_schema.columns WHERE table_name = \'ib_nodes\'');
  console.log(cols.map(c => c.column_name));
}
main().catch(console.error).finally(() => prisma.$disconnect());
