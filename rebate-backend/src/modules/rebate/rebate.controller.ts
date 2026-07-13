import { Controller, Get, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { RebateService } from './rebate.service';
import { UpdateRebateConfigDto } from './dto/update-config.dto';
import { SaveRebateTemplatesDto } from './dto/save-templates.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SubtreeGuard } from '../../common/guards/subtree.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AssetType } from '@prisma/client';

@ApiTags('💰 Rebate')
@ApiBearerAuth('Bearer')
@Controller('rebate')
@UseGuards(JwtAuthGuard)
export class RebateController {
  constructor(private readonly rebateService: RebateService) {}

  @Get('config/:ibId')
  @ApiBearerAuth('Bearer')
  @UseGuards(SubtreeGuard)
  @ApiOperation({ summary: 'Get rebate config for an IB', description: 'Returns the rebate configuration for all asset types for a given IB. Requires the requesting user to be in the IB\'s upline subtree.' })
  @ApiParam({ name: 'ibId', description: 'The IB account ID', example: 'clxyz123' })
  @ApiResponse({ status: 200, description: 'Rebate configuration returned successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden — not in subtree' })
  @ApiResponse({ status: 404, description: 'IB not found' })
  async getConfig(@Param('ibId') ibId: string) {
    try {
      // eslint-disable-next-line no-console
      console.log('RebateController.getConfig called', { ibId, requestPath: `/rebate/config/${ibId}` });
    } catch (e) {
      // ignore logging errors
    }
    return this.rebateService.getConfig(ibId);
  }

  @Put('config/:ibId')
  @ApiBearerAuth('Bearer')
  @UseGuards(SubtreeGuard)
  @ApiOperation({ summary: 'Update rebate config for an IB', description: 'Updates rebate configuration (rebatePips, markupPips, markupPercent) per asset type for the specified IB.' })
  @ApiParam({ name: 'ibId', description: 'The IB account ID to update', example: 'clxyz123' })
  @ApiResponse({ status: 200, description: 'Rebate configuration updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation error — invalid config values' })
  @ApiResponse({ status: 403, description: 'Forbidden — not in subtree' })
  @ApiResponse({ status: 404, description: 'IB not found' })
  async updateConfig(
    @CurrentUser() user: any,
    @Param('ibId') ibId: string,
    @Body() updateDto: UpdateRebateConfigDto,
  ) {
    try {
      // eslint-disable-next-line no-console
      console.log('RebateController.updateConfig called', { user: { sub: user?.sub, level: user?.level }, ibId, assetsCount: Array.isArray((updateDto as any)?.assets) ? (updateDto as any).assets.length : 0 });
    } catch (e) {
      // ignore logging errors
    }
    return this.rebateService.updateConfig(user.sub, user.level, ibId, updateDto);
  }

  @Get('config/:ibId/history')
  @ApiOperation({ summary: 'Lịch sử thay đổi cấu hình rebate của một IB' })
  @ApiParam({ name: 'ibId', description: 'UUID của IB cần xem lịch sử' })
  @ApiQuery({ name: 'page', required: false, type: Number, default: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, default: 20 })
  @ApiResponse({ status: 200, description: 'Lịch sử cấu hình rebate' })
  @ApiResponse({ status: 403, description: 'IB không thuộc subtree của bạn' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy config' })
  async getConfigHistory(
    @CurrentUser() user: any,
    @Param('ibId') ibId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.rebateService.getConfigHistory(
      user.sub,
      ibId,
      parseInt(page, 10) || 1,
      Math.min(parseInt(limit, 10) || 20, 100),
    );
  }

  @Get('templates/:ibId')
  @ApiBearerAuth('Bearer')
  @UseGuards(SubtreeGuard)
  @ApiOperation({ summary: 'Lấy template account type và markup link cho IB' })
  @ApiParam({ name: 'ibId', description: 'UUID của IB', example: 'clxyz123' })
  @ApiResponse({ status: 200, description: 'Templates returned successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden — not in subtree' })
  async getTemplates(@Param('ibId') ibId: string) {
    return this.rebateService.getTemplates(ibId);
  }

  @Put('templates/:ibId')
  @ApiBearerAuth('Bearer')
  @UseGuards(SubtreeGuard)
  @ApiOperation({ summary: 'Lưu template account type và markup link cho IB' })
  @ApiParam({ name: 'ibId', description: 'UUID của IB', example: 'clxyz123' })
  @ApiResponse({ status: 200, description: 'Templates saved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden — not in subtree' })
  async saveTemplates(
    @Param('ibId') ibId: string,
    @Body() dto: SaveRebateTemplatesDto,
  ) {
    return this.rebateService.saveTemplates(ibId, dto);
  }

  @Get('calculate')
  @ApiBearerAuth('Bearer')
  @UseGuards(SubtreeGuard)
  @ApiOperation({ summary: 'Calculate rebate amount', description: 'Calculates the rebate amount for a given IB, asset type, and number of lots traded.' })
  @ApiQuery({ name: 'ibId', description: 'The IB account ID', example: 'clxyz123' })
  @ApiQuery({ name: 'assetType', enum: AssetType, description: 'Asset type for the calculation', example: AssetType.FOREX })
  @ApiQuery({ name: 'lots', description: 'Number of lots traded', example: '1.5' })
  @ApiQuery({ name: 'rebateType', description: 'Rebate type (default: STP_REBATE)', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Rebate calculation result returned successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden — not in subtree' })
  @ApiResponse({ status: 404, description: 'IB or config not found' })
  async calculateCascadeDistribution(
    @Query('ibId') ibId: string,
    @Query('assetType') assetType: AssetType,
    @Query('lots') lots: string,
    @Query('rebateType') rebateType: string = 'STP_REBATE',
  ) {
    const parsedLots = Number(lots);
    return this.rebateService.calculateCascadeDistribution(ibId, assetType, parsedLots, rebateType);
  }
}
