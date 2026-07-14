import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ReportService } from './report.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SubtreeGuard } from '../../common/guards/subtree.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AssetType, RebateType } from '@prisma/client';

@ApiTags('📊 Report')
@ApiBearerAuth('Bearer')
@Controller('report')
@UseGuards(JwtAuthGuard)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('summary')
  @ApiBearerAuth('Bearer')
  @UseGuards(SubtreeGuard)
  @ApiOperation({
    summary: 'Get rebate summary report',
    description:
      'Returns aggregated rebate summary for a specific IB or the authenticated user\'s entire subtree, optionally filtered by period (YYYY-MM).\n\n' +
      '**Lv0**: có thể truyền bất kỳ `ibId` trong cây.\n' +
      '**Lv1+**: `ibId` phải nằm trong subtree của mình — 403 nếu ngoài subtree.',
  })
  @ApiQuery({ name: 'ibId', required: false, description: 'Filter by specific IB account ID. Defaults to the authenticated user\'s subtree.', example: 'clxyz123' })
  @ApiQuery({ name: 'period', required: false, description: 'Filter by month in YYYY-MM format', example: '2025-01' })
  @ApiResponse({ status: 200, description: 'Summary report returned successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden — requested IB not in subtree' })
  async getSummary(
    @CurrentUser() user: any,
    @Query('ibId') ibId?: string,
    @Query('period') period?: string,
  ) {
    return this.reportService.getSummary(user.sub, user.level, ibId, period, user.role);
  }

  @Get('transactions')
  @ApiBearerAuth('Bearer')
  @UseGuards(SubtreeGuard)
  @ApiOperation({
    summary: 'Get rebate transactions list',
    description:
      'Returns a paginated list of rebate transactions with optional filters.\n\n' +
      '**Lv0**: có thể truyền bất kỳ `ibId` trong cây.\n' +
      '**Lv1+**: `ibId` phải nằm trong subtree của mình — 403 nếu ngoài subtree.',
  })
  @ApiQuery({ name: 'ibId', required: false, description: 'Filter by specific IB account ID', example: 'clxyz123' })
  @ApiQuery({ name: 'period', required: false, description: 'Filter by month in YYYY-MM format', example: '2025-01' })
  @ApiQuery({ name: 'assetType', required: false, enum: AssetType, description: 'Filter by asset type', example: AssetType.FOREX })
  @ApiQuery({ name: 'rebateType', required: false, enum: RebateType, description: 'Filter by rebate type (e.g. STP_REBATE)', example: RebateType.STP_REBATE })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-indexed)', example: '1' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (max 100)', example: '20' })
  @ApiResponse({ status: 200, description: 'Transaction list returned successfully with pagination metadata' })
  @ApiResponse({ status: 403, description: 'Forbidden — requested IB not in subtree' })
  async getTransactions(
    @CurrentUser() user: any,
    @Query('ibId') ibId?: string,
    @Query('period') period?: string,
    @Query('assetType') assetType?: AssetType,
    @Query('rebateType') rebateType?: RebateType,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = parseInt(page || '1', 10) || 1;
    const limitNum = Math.min(parseInt(limit || '20', 10) || 20, 100);

    return this.reportService.getTransactions(
      user.sub,
      user.level,
      ibId,
      period,
      assetType,
      rebateType,
      pageNum,
      limitNum,
      user.role,
    );
  }
}
