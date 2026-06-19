import { PrismaService } from '../../prisma/prisma.service';

/**
 * Lấy tất cả IDs trong subtree của rootId (bao gồm chính rootId)
 * Sử dụng CTE recursive query.
 */
export async function getSubtreeIds(
  prisma: PrismaService,
  rootId: string,
): Promise<string[]> {
  const result = await prisma.$queryRaw<{ id: string }[]>`
    WITH RECURSIVE subtree AS (
      SELECT id FROM ib_nodes WHERE id = ${rootId}
      UNION ALL
      SELECT n.id FROM ib_nodes n
      INNER JOIN subtree s ON n."parentId" = s.id
    )
    SELECT id FROM subtree
  `;
  return result.map((r) => r.id);
}
