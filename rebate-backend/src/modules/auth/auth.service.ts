import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../audit/audit.constants';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.prisma.ibNode.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Email hoặc mật khẩu không đúng',
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Tài khoản đã bị vô hiệu hóa',
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Email hoặc mật khẩu không đúng',
      });
    }

    const role = user.level === 0 ? 'MIB' : 'IB';

    const accessToken = this.generateAccessToken(user.id, user.email, user.level, role);
    const refreshToken = this.generateRefreshToken(user.id, user.email, user.level, role);

    // Save refresh token
    const expiresDays = parseInt(this.configService.get<string>('JWT_REFRESH_EXPIRES', '7d').replace('d', ''), 10) || 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresDays);

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        ibId: user.id,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        level: user.level,
        role,
      },
    };
  }

  async refresh(refreshDto: RefreshDto) {
    const { refreshToken } = refreshDto;

    // Verify token structure & signature
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch (err: unknown) {
      try {
        // eslint-disable-next-line no-console
        const errMsg = err instanceof Error ? err.message : (typeof err === 'object' ? JSON.stringify(err) : String(err));
        console.warn('AuthService.refresh: jwt verify failed', errMsg);
      } catch (logErr) {
        // ignore logging errors
      }
      throw new UnauthorizedException({
        code: 'AUTH_TOKEN_INVALID',
        message: 'Phiên đăng nhập không hợp lệ',
      });
    }

    // Check DB
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!tokenRecord || new Date() > tokenRecord.expiresAt) {
      // Clean up expired token if exists
      if (tokenRecord) {
        await this.prisma.refreshToken.delete({ where: { id: tokenRecord.id } });
      }
      throw new UnauthorizedException({
        code: 'AUTH_REFRESH_EXPIRED',
        message: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
      });
    }

    // Delete old refresh token (rotation)
    await this.prisma.refreshToken.delete({
      where: { id: tokenRecord.id },
    });

    // Generate new tokens
    const role = payload.role || (payload.level === 0 ? 'MIB' : 'IB');
    const newAccessToken = this.generateAccessToken(payload.sub, payload.email, payload.level, role);
    const newRefreshToken = this.generateRefreshToken(payload.sub, payload.email, payload.level, role);

    // Save new refresh token
    const expiresDays = parseInt(this.configService.get<string>('JWT_REFRESH_EXPIRES', '7d').replace('d', ''), 10) || 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresDays);

    await this.prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        ibId: payload.sub,
        expiresAt,
      },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(ibId: string) {
    await this.prisma.refreshToken.deleteMany({
      where: { ibId },
    });
    return null;
  }

  async changePassword(ibId: string, changePasswordDto: any) {
    const { oldPassword, newPassword } = changePasswordDto;

    const user = await this.prisma.ibNode.findUnique({ where: { id: ibId } });
    if (!user) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Không tìm thấy người dùng',
      });
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Mật khẩu cũ không đúng',
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction(async (tx: any) => {
      await tx.ibNode.update({
        where: { id: ibId },
        data: { password: hashedPassword },
      });

      // Invalidate all refresh tokens for this user
      await tx.refreshToken.deleteMany({
        where: { ibId },
      });
    });

    // Ghi audit log — KHÔNG ghi before/after cho password (security)
    await this.auditService.log({
      actorId: ibId,
      action: AUDIT_ACTIONS.PASSWORD_CHANGE,
      targetType: 'IB',
      targetId: ibId,
    });

    return { message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.' };
  }

  private generateAccessToken(sub: string, email: string, level: number, role: string): string {
    return this.jwtService.sign(
      { sub, email, level, role },
      {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES', '15m') as any,
      },
    );
  }

  private generateRefreshToken(sub: string, email: string, level: number, role: string): string {
    return this.jwtService.sign(
      { sub, email, level, role },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES', '7d') as any,
      },
    );
  }
}
