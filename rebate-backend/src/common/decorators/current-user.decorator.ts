import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUserPayload {
  sub: string;      // IB ID (UUID)
  email: string;
  level: number;    // 0=MIB, 1, 2, 3, 4, 5
  role: 'IB' | 'MIB' | 'ADMIN';
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CurrentUserPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
