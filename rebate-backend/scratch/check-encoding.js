const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const serverEncoding = await prisma.$queryRaw`SHOW server_encoding;`;
  const clientEncoding = await prisma.$queryRaw`SHOW client_encoding;`;
  const dbEncoding = await prisma.$queryRaw`SELECT datname, pg_encoding_to_char(encoding) FROM pg_database WHERE datname = 'rebate_db';`;
  
  console.log('Server Encoding:', serverEncoding);
  console.log('Client Encoding:', clientEncoding);
  console.log('DB Encoding:', dbEncoding);
}

main().finally(() => prisma.$disconnect());
