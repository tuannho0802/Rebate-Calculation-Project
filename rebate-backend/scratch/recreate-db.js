const { PrismaClient } = require('@prisma/client');
// Connect to the 'postgres' database, not 'rebate_db'
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:postgres@localhost:5432/postgres?schema=public'
    }
  }
});

async function main() {
  console.log('Terminating connections to rebate_db...');
  await prisma.$executeRawUnsafe(`SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = 'rebate_db' AND pid <> pg_backend_pid();`);
  
  console.log('Dropping rebate_db...');
  await prisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS rebate_db;`);
  
  console.log('Creating rebate_db with UTF8 encoding...');
  await prisma.$executeRawUnsafe(`CREATE DATABASE rebate_db WITH ENCODING 'UTF8' LC_COLLATE='C' LC_CTYPE='C' TEMPLATE=template0;`);
  
  console.log('Done!');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
