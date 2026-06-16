import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

interface JwtPayload {
  sub: string;
  email: string;
  level: number;
  role: 'IB' | 'MIB' | 'ADMIN';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET') || 'default-jwt-secret-key-at-least-64-characters-for-security',
    });
  }

  async validate(payload: JwtPayload) {
    return {
      sub: payload.sub,
      email: payload.email,
      level: payload.level,
      role: payload.role,
    };
  }
}
