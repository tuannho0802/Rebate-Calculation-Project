import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';

/**
 * Lv0Guard — chặn mọi user không phải Lv0 (MIB).
 * Dùng kết hợp với SubtreeGuard (SubtreeGuard vẫn chạy để bảo vệ cross-tree).
 *
 * Guard order: @UseGuards(JwtAuthGuard, Lv0Guard, SubtreeGuard)
 * - Lv0Guard chỉ block Lv1+, KHÔNG replace SubtreeGuard.
 * - SubtreeGuard giữ nguyên — đảm bảo Lv0 không thao tác trên IB ngoài cây của mình.
 */
@Injectable()
export class Lv0Guard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || (user.level !== 0 && user.role !== 'ADMIN')) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_LV0_ONLY',
        message: 'Chức năng này chỉ dành cho MIB (Level 0) hoặc Admin',
      });
    }

    return true;
  }
}
