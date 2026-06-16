import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service';
import { LoginDto } from '../auth/dto/login.dto';

@ApiExcludeController()
@Controller('docs')
export class DocsController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async docsLogin(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }
}
