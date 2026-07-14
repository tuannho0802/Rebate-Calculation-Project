import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProtectRootAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const targetIbId = request.params.id || request.params.ibId || request.query.ibId || request.body.id;

    if (!targetIbId) {
      return true;
    }

    const target = await this.prisma.ibNode.findUnique({
      where: { id: targetIbId },
      select: { isRootAdmin: true },
    });

    if (!target) {
      return true;
    }

    if (target.isRootAdmin) {
      throw new ForbiddenException({
        code: 'ROOT_ADMIN_PROTECTED',
        message: 'Không thể thao tác với Admin gốc',
      });
    }

    return true;
  }
}
