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

/**
 * Đi ngược từ targetId lên theo chuỗi parentId, kiểm tra xem ancestorId có
 * xuất hiện trên đường đi hay không — dùng cho ngoại lệ "MIB View-All"
 * (MIB được xem đệ quy toàn bộ nhánh của CHÍNH MÌNH, không phải toàn hệ
 * thống). Cùng logic với ib.service.ts#isDescendantOf và
 * subtree.guard.ts#isDescendantOf (giữ nguyên 2 bản đó để tránh đổi diff
 * không liên quan) — hàm này dùng cho các service chưa có sẵn helper này
 * (wallet, export...).
 *
 * Cây IB tối đa 5 cấp (level 0..5) nên chuỗi đi ngược không bao giờ dài —
 * giới hạn MAX_DEPTH để phòng hờ vòng lặp bất thường trong dữ liệu.
 */
/**
 * Trả về toàn bộ id trong subtree của rootId (đệ quy mọi cấp), bao gồm
 * chính rootId. Dùng cho ngoại lệ "MIB View-All" ở các nơi cần lọc theo
 * TOÀN BỘ cây của MIB (khác getSubtreeIds() ở trên — hàm đó chỉ trả về
 * self + con trực tiếp, đúng cho Parent-Strict nhưng KHÔNG đủ cho MIB).
 */
export async function getDescendantIds(prisma: PrismaService, rootId: string): Promise<string[]> {
  const rows: { id: string }[] = await (prisma as any).$queryRaw`
    WITH RECURSIVE subtree AS (
      SELECT id, "parentId" FROM ib_nodes WHERE id = ${rootId}
      UNION ALL
      SELECT n.id, n."parentId"
      FROM ib_nodes n
      INNER JOIN subtree s ON n."parentId" = s.id
    )
    SELECT id FROM subtree
  `;
  return rows.map((r) => r.id);
}

export async function isDescendantOf(
  prisma: PrismaService,
  targetId: string,
  ancestorId: string,
): Promise<boolean> {
  let currentId: string | null = targetId;
  let depth = 0;
  const MAX_DEPTH = 10;

  while (currentId && depth < MAX_DEPTH) {
    const node: { parentId: string | null } | null = await prisma.ibNode.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    });

    if (!node) return false;
    if (node.parentId === ancestorId) return true;
    if (!node.parentId) return false;

    currentId = node.parentId;
    depth++;
  }

  return false;
}