import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';

@Injectable()
export class SelfFinanceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Chặn ADMIN tại các route tài chính cho chính mình
    if (user && user.role === 'ADMIN') {
      throw new ForbiddenException({
        code: 'ADMIN_FINANCE_NOT_ALLOWED',
        message: 'Admin không được phép tham gia vào các hoạt động tài chính cá nhân',
      });
    }

    return true;
  }
}
