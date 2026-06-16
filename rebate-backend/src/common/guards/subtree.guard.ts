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
      return true;
    }

    // A user can always access their own data
    if (user.sub === targetIbId) {
      return true;
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
    if (!isAuthorized) {
      throw new ForbiddenException({
        code: 'IB_NOT_IN_SUBTREE',
        message: 'Bạn không có quyền xem thông tin IB này',
      });
    }

    return true;
  }
}
