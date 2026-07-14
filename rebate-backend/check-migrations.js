require('dotenv').config({ path: '.env.production' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

async function check() {
  const migrations = await prisma.$queryRawUnsafe(`
    SELECT migration_name, finished_at 
    FROM "_prisma_migrations" 
    WHERE migration_name LIKE '%wallet_payout%' 
    ORDER BY started_at;
  `);
  console.log(migrations);
  await prisma.$disconnect();
}

check().catch(console.error);
