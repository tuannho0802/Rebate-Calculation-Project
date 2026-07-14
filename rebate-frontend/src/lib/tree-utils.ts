import type { IbTreeNode } from '@/types';

/**
 * Chuẩn hoá response GET /ib/tree:
 * - ADMIN: BE trả mảng các root MIB (level 0 nhiều nhánh)
 * - IB thường: BE trả 1 object (chính node của IB đó)
 * Luôn trả về mảng để nơi gọi xử lý thống nhất 1 kiểu.
 */
export function normalizeTreeRoots(data: IbTreeNode | IbTreeNode[] | null | undefined): IbTreeNode[] {
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}

/** Duyệt đệ quy 1 cây, chỉ lấy node isActive (giữ đúng hành vi cũ). */
export function flattenIbTree(node: IbTreeNode): IbTreeNode[] {
  let result: IbTreeNode[] = [node];
  for (const child of node.children ?? []) {
    if (child.isActive) result = result.concat(flattenIbTree(child));
  }
  return result;
}

/** Chuẩn hoá + flatten TẤT CẢ root cùng lúc — dùng cho các trang cần danh sách phẳng. */
export function flattenAllRoots(data: IbTreeNode | IbTreeNode[] | null | undefined): IbTreeNode[] {
  return normalizeTreeRoots(data).flatMap(flattenIbTree);
}
