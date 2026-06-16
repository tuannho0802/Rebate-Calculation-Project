import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      if (info && info.name === 'TokenExpiredError') {
        throw new UnauthorizedException({
          code: 'AUTH_TOKEN_EXPIRED',
          message: 'Access token đã hết hạn',
        });
      }
      throw err || new UnauthorizedException({
        code: 'AUTH_TOKEN_INVALID',
        message: 'Phiên đăng nhập không hợp lệ',
      });
    }
    return user;
  }
}
