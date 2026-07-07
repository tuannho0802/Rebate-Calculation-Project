import { Controller, Get, Query, Res, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ExportService } from './export.service';

@ApiTags('Export')
@ApiBearerAuth('Bearer')
@UseGuards(JwtAuthGuard)
@Controller('export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('rebate-config')
  @ApiOperation({ summary: 'Xuất cấu hình rebate ra Excel' })
  @ApiQuery({ name: 'period', required: false, description: 'Định dạng YYYY-MM' })
  async exportRebateConfig(
    @CurrentUser() user: any,
    @Query('period') period: string,
    @Res() res: any,
  ) {
    const buffer = await this.exportService.generateRebateConfigExcel(user.sub);
    const filename = `rebate-config-${period || new Date().toISOString().slice(0, 7)}.xlsx`;

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Xuất lịch sử transaction ra Excel' })
  @ApiQuery({ name: 'period', required: false, description: 'Định dạng YYYY-MM' })
  @ApiQuery({ name: 'ibId', required: false, description: 'ID của IB cần xuất, mặc định là của chính mình' })
  async exportTransactions(
    @CurrentUser() user: any,
    @Query('period') period: string,
    @Query('ibId') ibId: string,
    @Res() res: any,
  ) {
    const targetIbId = ibId || user.sub;
    const buffer = await this.exportService.generateTransactionsExcel(user.sub, targetIbId, period);
    const filename = `transactions-${period || new Date().toISOString().slice(0, 7)}.xlsx`;

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
