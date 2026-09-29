import { Controller, Get, Query, UseGuards, Delete, Param, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { QueryAuditDto } from './dto/query-audit.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('📋 Audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @ApiBearerAuth('Bearer')
  @ApiOperation({ summary: 'Xem nhật ký thao tác (Chỉ Admin)' })
  getLogs(@CurrentUser() user: any, @Query() query: QueryAuditDto) {
    return this.auditService.getLogs(user.sub, query, user.role);
  }

  @Delete('logs/bulk')
  @ApiBearerAuth('Bearer')
  @ApiOperation({ summary: 'Xoá nhiều dòng nhật ký cùng lúc (Chỉ Admin)' })
  deleteBulk(@CurrentUser() user: any, @Body() dto: { ids: string[] }) {
    return this.auditService.deleteBulk(user.sub, dto.ids, user.role);
  }

  @Delete('logs/all')
  @ApiBearerAuth('Bearer')
  @ApiOperation({ summary: 'Xoá toàn bộ nhật ký khớp filter hiện tại (Chỉ Admin)' })
  deleteAll(@CurrentUser() user: any, @Query() query: QueryAuditDto) {
    return this.auditService.deleteAll(user.sub, query, user.role);
  }

  @Delete('logs/:id')
  @ApiBearerAuth('Bearer')
  @ApiOperation({ summary: 'Ẩn/xoá 1 dòng nhật ký (Chỉ Admin)' })
  dismissLog(@CurrentUser() user: any, @Param('id') id: string) {
    return this.auditService.dismissLog(user.sub, id);
  }
}
