const { PrismaClient } = require('@prisma/client');
// Local DB
const prisma = new PrismaClient();

async function main() {
  console.log('--- LOCAL: wallets / payouts in information_schema.tables ---');
  const tables = await prisma.$queryRawUnsafe(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN ('wallets', 'payouts')
  `);
  console.table(tables);
}

main().catch(console.error).finally(() => prisma.$disconnect());
