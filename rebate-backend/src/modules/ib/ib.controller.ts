import { Controller, Get, Post, Body, Param, Query, UseGuards, HttpStatus, HttpCode } from '@nestjs/common';
import { IbService } from './ib.service';
import { CreateIbDto } from './dto/create-ib.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SubtreeGuard } from '../../common/guards/subtree.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('ib')
@UseGuards(JwtAuthGuard)
export class IbController {
  constructor(private readonly ibService: IbService) {}

  @Get('me')
  async getMe(@CurrentUser() user: any) {
    return this.ibService.getMe(user.sub);
  }

  @Get('tree')
  async getTree(
    @CurrentUser() user: any,
    @Query('depth') depth: '1' | 'all' = '1',
  ) {
    return this.ibService.getTree(user.sub, depth);
  }

  @Get(':id')
  @UseGuards(SubtreeGuard)
  async getById(@Param('id') id: string) {
    return this.ibService.getById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: any,
    @Body() createIbDto: CreateIbDto,
  ) {
    return this.ibService.create(user.sub, user.level, createIbDto);
  }
}

