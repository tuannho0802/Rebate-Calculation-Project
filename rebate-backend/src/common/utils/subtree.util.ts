import { PrismaService } from '../../prisma/prisma.service';

/**
 * Lấy tất cả IDs trong subtree của rootId (bao gồm chính rootId)
 * Sử dụng CTE recursive query.
 */
export async function getSubtreeIds(
  prisma: PrismaService,
  rootId: string,
  role?: string,
): Promise<string[]> {
  // ADMIN -> xem toàn bộ hệ thống
  if (role === 'ADMIN') {
    const all = await prisma.ibNode.findMany({ select: { id: true } });
    return all.map((r) => r.id);
  }

  // IB -> xem chính mình + 1 cấp trực tiếp
  const children = await prisma.ibNode.findMany({
    where: { parentId: rootId },
    select: { id: true },
  });
  
  return [rootId, ...children.map((c) => c.id)];
}
