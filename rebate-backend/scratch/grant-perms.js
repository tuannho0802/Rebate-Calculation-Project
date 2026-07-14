const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:postgres@localhost:5432/rebate_db?schema=public'
    }
  }
});

async function main() {
  await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO postgres;`);
  await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO public;`);
  console.log('Permissions granted.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
