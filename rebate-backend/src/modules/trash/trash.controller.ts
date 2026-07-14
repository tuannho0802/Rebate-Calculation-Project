import { Controller, Get, Patch, Delete, Param, UseGuards, Req } from '@nestjs/common';
import * as express from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TrashService } from './trash.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { ProtectRootAdminGuard } from '../../common/guards/protect-root-admin.guard';

@ApiTags('Trash Can')
@ApiBearerAuth('Bearer')
@Controller('trash')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class TrashController {
  constructor(private readonly trashService: TrashService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách tài khoản trong thùng rác' })
  findAll() {
    return this.trashService.findAllTrash();
  }

  @Patch(':id/restore')
  @ApiOperation({ summary: 'Khôi phục tài khoản từ thùng rác' })
  restore(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Req() req: express.Request,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.trashService.restore(id, user.sub, ip);
  }

  @Delete(':id/permanent')
  @UseGuards(ProtectRootAdminGuard)
  @ApiOperation({ summary: 'Xóa vĩnh viễn tài khoản' })
  hardDelete(@Param('id') id: string) {
    return this.trashService.hardDelete(id);
  }
}
