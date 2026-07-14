const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.notification.findFirst({
  where: { OR: [{ title: { contains: 'Cấu hình' } }, { title: { contains: 'Tài khoản' } }, { title: { contains: 'Giao dịch' } }] }
}).then(n => console.log('\n--- SAMPLE NOTIFICATION ---', n))
  .catch(console.error)
  .finally(() => p.$disconnect());
