import { Controller, Get, Query, UseGuards, Delete, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { QueryAuditDto } from './dto/query-audit.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Lv0Guard } from '../../common/guards/lv0.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('📋 Audit')
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @UseGuards(JwtAuthGuard, Lv0Guard)
  @ApiBearerAuth('Bearer')
  @ApiOperation({ summary: 'Xem nhật ký thao tác (Admin: toàn hệ thống, MIB: toàn subtree của mình)' })
  getLogs(@CurrentUser() user: any, @Query() query: QueryAuditDto) {
    return this.auditService.getLogs(user.sub, query, user.role);
  }

  @Delete('logs/:id')
  @UseGuards(JwtAuthGuard, Lv0Guard)
  @ApiBearerAuth('Bearer')
  @ApiOperation({ summary: 'Ẩn 1 dòng nhật ký khỏi danh sách của riêng bạn (không xoá dữ liệu audit thật)' })
  dismissLog(@CurrentUser() user: any, @Param('id') id: string) {
    return this.auditService.dismissLog(user.sub, id);
  }
}
