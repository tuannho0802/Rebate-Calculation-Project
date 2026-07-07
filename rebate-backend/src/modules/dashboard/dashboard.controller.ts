import { Controller, Get, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('📈 Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('Bearer')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Lấy tổng quan nhanh toàn cây IB của mình' })
  getSummary(@CurrentUser() user: any) {
    return this.dashboardService.getSummary(user.sub);
  }

  @Get('overview')
  @ApiOperation({ summary: 'Tổng quan dashboard: wallet, rebate, subtree, top IBs' })
  getOverview(@CurrentUser() user: any) {
    return this.dashboardService.getOverview(user.sub);
  }

  @Get('rebate-summary')
  @ApiOperation({ summary: 'Thống kê rebate theo kỳ (byAsset, byRebateType, byLevel)' })
  @ApiQuery({ name: 'period', description: 'Định dạng YYYY-MM', required: true })
  getRebateSummary(
    @CurrentUser() user: any,
    @Query('period') period: string,
  ) {
    return this.dashboardService.getRebateSummary(user.sub, period);
  }

  @Get('ib-performance')
  @ApiOperation({ summary: 'Hiệu suất từng IB trong subtree theo kỳ' })
  @ApiQuery({ name: 'period', description: 'Định dạng YYYY-MM', required: true })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getIbPerformance(
    @CurrentUser() user: any,
    @Query('period') period: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    return this.dashboardService.getIbPerformance(user.sub, period, safePage, safeLimit);
  }
}
