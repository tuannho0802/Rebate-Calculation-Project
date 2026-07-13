import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SubtreeGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      return false;
    }

    const targetIbId = request.params.id || request.params.ibId || request.query.ibId;
    if (!targetIbId) {
      try {
        // eslint-disable-next-line no-console
        console.debug('SubtreeGuard: no targetIbId found, allowing access by default', {
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
      return true;
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
        url: request.originalUrl ?? request.url,
        method: request.method,
        params: request.params,
        query: request.query,
      });
    } catch (e) {
      // ignore logging errors
    }

    // Check if targetIbId exists in the user's subtree recursively
    const result = await this.prisma.$queryRaw<{ found: boolean }[]>`
      WITH RECURSIVE subtree AS (
        SELECT id FROM ib_nodes WHERE id = ${user.sub}
        UNION ALL
        SELECT n.id FROM ib_nodes n
        INNER JOIN subtree s ON n."parentId" = s.id
      )
      SELECT EXISTS(SELECT 1 FROM subtree WHERE id = ${targetIbId}) as found
    `;

    const isAuthorized = result?.[0]?.found ?? false;
    try {
      // eslint-disable-next-line no-console
      console.debug('SubtreeGuard: subtree authorization result', {
        requester: user.sub,
        userLevel: user.level,
        target: targetIbId,
        isAuthorized,
        foundRows: result,
        url: request.originalUrl ?? request.url,
        params: request.params,
        query: request.query,
        userPayload: user,
      });
    } catch (e) {
      // ignore logging errors
    }

    if (!isAuthorized) {
      try {
        // eslint-disable-next-line no-console
        console.warn('SubtreeGuard: access denied for non-subtree target', {
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
        message: 'Bạn không có quyền xem thông tin IB này',
      });
    }

    return true;
  }
}
