import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportService } from './report.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SubtreeGuard } from '../../common/guards/subtree.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AssetType } from '@prisma/client';

@Controller('report')
@UseGuards(JwtAuthGuard)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('summary')
  @UseGuards(SubtreeGuard)
  async getSummary(
    @CurrentUser() user: any,
    @Query('ibId') ibId?: string,
    @Query('period') period?: string,
  ) {
    return this.reportService.getSummary(user.sub, ibId, period);
  }

  @Get('transactions')
  @UseGuards(SubtreeGuard)
  async getTransactions(
    @CurrentUser() user: any,
    @Query('ibId') ibId?: string,
    @Query('period') period?: string,
    @Query('assetType') assetType?: AssetType,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = parseInt(page || '1', 10) || 1;
    const limitNum = parseInt(limit || '20', 10) || 20;

    return this.reportService.getTransactions(
      user.sub,
      ibId,
      period,
      assetType,
      pageNum,
      limitNum,
    );
  }
}

