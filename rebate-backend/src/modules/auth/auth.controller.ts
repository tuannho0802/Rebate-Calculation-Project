import { Body, Controller, Post, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('🔐 Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Login and obtain access/refresh tokens' })
  @ApiResponse({
    status: 200,
    description: 'Success response template',
    schema: {
      example: {
        success: true,
        data: {
          accessToken: 'eyJ...',
          refreshToken: 'eyJ...',
          user: {
            id: 'uuid',
            email: 'ib@example.com',
            level: 1,
            role: 'IB'
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials',
    schema: {
      example: {
        success: false,
        error: {
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'Email hoặc mật khẩu không đúng'
        }
      }
    }
  })

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @ApiOperation({ summary: 'Exchange refresh token for a new access token' })
  @ApiResponse({
    status: 200,
    description: 'Access token successfully refreshed',
    schema: {
      example: {
        success: true,
        data: {
          accessToken: 'eyJ...',
          refreshToken: 'eyJ...'
        }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Refresh token expired or invalid',
    schema: {
      example: {
        success: false,
        error: {
          code: 'AUTH_REFRESH_EXPIRED',
          message: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại'
        }
      }
    }
  })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() refreshDto: RefreshDto) {
    return this.authService.refresh(refreshDto);
  }

  @ApiOperation({ summary: 'Log out current user and invalidate tokens' })
  @ApiBearerAuth('Bearer')
  @ApiResponse({
    status: 200,
    description: 'User successfully logged out',
    schema: {
      example: {
        success: true,
        data: null
      }
    }
  })
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: any) {
    return this.authService.logout(user.sub);
  }

  @ApiOperation({ summary: 'Change user password' })
  @ApiBearerAuth('Bearer')
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Invalid old password' })
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(@CurrentUser() user: any, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.sub, dto);
  }
}


