import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      // Log details to help debugging token validation issues
      try {
        // Avoid throwing from logging
        // eslint-disable-next-line no-console
        console.warn('JwtAuthGuard: token validation failed', { err: err?.message || err, info });
      } catch (logErr) {
        // ignore
      }

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
