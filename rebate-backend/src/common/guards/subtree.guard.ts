import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SubtreeGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      return false;
    }

    // Nếu là ADMIN -> cho qua (kiểm tra TRƯỚC khi cần targetIbId, vì Admin
    // không bị giới hạn subtree dù endpoint có xác định được targetIbId hay không)
    if (user.role === 'ADMIN') return true;

    const targetIbId = request.params.id || request.params.ibId || request.query.ibId;
    if (!targetIbId) {
      // FIX (hardening): trước đây "không xác định được targetIbId" mặc định
      // CHO QUA (fail-open) — nguy hiểm vì nếu sau này có endpoint mới gắn
      // SubtreeGuard mà lỡ đặt id trong request body (thay vì params/query),
      // request sẽ lọt qua kiểm tra quyền mà không ai nhận ra. Giờ đổi thành
      // fail-closed: không xác định được target -> từ chối, trừ khi là ADMIN
      // (đã return true ở trên).
      try {
        // eslint-disable-next-line no-console
        console.warn('SubtreeGuard: no targetIbId found in params/query — denying by default (fail-closed)', {
          url: request.originalUrl ?? request.url,
          method: request.method,
          params: request.params,
          query: request.query,
          userSub: user.sub,
          userId: user.id,
        });
      } catch (e) {
        // ignore logging errors
      }
      throw new ForbiddenException({
        code: 'SUBTREE_TARGET_UNRESOLVED',
        message: 'Không xác định được đối tượng cần kiểm tra quyền truy cập',
      });
    }

    // A user can always access their own data
    if (user.sub === targetIbId) {
      return true;
    }

    // Log requester and target for debugging subtree authorization issues
    try {
      // eslint-disable-next-line no-console
      console.debug('SubtreeGuard: checking access', {
        requester: user.sub,
        userId: user.id,
        target: targetIbId,
        userLevel: user.level,
        url: request.originalUrl ?? request.url,
        method: request.method,
        params: request.params,
        query: request.query,
      });
    } catch (e) {
      // ignore logging errors
    }

    let isAuthorized: boolean;

    if (user.level === 0) {
      // MIB (Lv0): được xem TOÀN BỘ nhánh của chính mình (đệ quy mọi cấp con,
      // cháu, chắt...), miễn nhánh đó bắt nguồn từ chính MIB đang gọi API.
      // Không cho MIB này xem sang nhánh của MIB khác (vẫn phải là hậu duệ
      // thật sự của user.sub, không phải chỉ "level thấp hơn").
      isAuthorized = await this.isDescendantOf(targetIbId, user.sub);
    } else {
      // Lv1+: GIỮ NGUYÊN hành vi cũ — chỉ được xem cấp con trực tiếp.
      const target = await this.prisma.ibNode.findUnique({
        where: { id: targetIbId },
        select: { parentId: true },
      });
      isAuthorized = target?.parentId === user.sub;
    }

    if (!isAuthorized) {
      try {
        // eslint-disable-next-line no-console
        console.warn('SubtreeGuard: access denied for non-direct child target', {
          requester: user.sub,
          userLevel: user.level,
          target: targetIbId,
          url: request.originalUrl ?? request.url,
          params: request.params,
          query: request.query,
        });
      } catch (e) {
        // ignore logging errors
      }
      throw new ForbiddenException({
        code: 'IB_NOT_IN_SUBTREE',
        message:
          user.level === 0
            ? 'Bạn không có quyền xem thông tin IB này (không thuộc nhánh của bạn)'
            : 'Bạn không có quyền xem thông tin IB này (chỉ được xem cấp con trực tiếp)',
      });
    }

    return true;
  }

  /**
   * Đi ngược từ targetId lên theo chuỗi parentId, kiểm tra xem ancestorId có
   * xuất hiện trên đường đi hay không. Cây IB tối đa 5 cấp (level 0..5) nên
   * chuỗi đi ngược không bao giờ dài — giới hạn depth để chặn vòng lặp bất
   * thường trong dữ liệu (phòng hờ, không nên xảy ra với dữ liệu hợp lệ).
   */
  private async isDescendantOf(targetId: string, ancestorId: string): Promise<boolean> {
    let currentId: string | null = targetId;
    let depth = 0;
    const MAX_DEPTH = 10;

    while (currentId && depth < MAX_DEPTH) {
      const node: { parentId: string | null } | null = await this.prisma.ibNode.findUnique({
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
}