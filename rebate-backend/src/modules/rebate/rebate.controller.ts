import { Controller, Get, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { RebateService } from './rebate.service';
import { UpdateRebateConfigDto } from './dto/update-config.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SubtreeGuard } from '../../common/guards/subtree.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AssetType, RebateType } from '@prisma/client';

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
    return this.rebateService.updateConfig(user.sub, ibId, updateDto);
  }

  @Get('calculate')
  @ApiBearerAuth('Bearer')
  @UseGuards(SubtreeGuard)
  @ApiOperation({ summary: 'Calculate rebate amount', description: 'Calculates the rebate amount for a given IB, asset type, and number of lots traded.' })
  @ApiQuery({ name: 'ibId', description: 'The IB account ID', example: 'clxyz123' })
  @ApiQuery({ name: 'assetType', enum: AssetType, description: 'Asset type for the calculation', example: AssetType.FOREX })
  @ApiQuery({ name: 'lots', description: 'Number of lots traded', example: '1.5' })
  @ApiQuery({ name: 'rebateType', enum: RebateType, required: false, description: 'Rebate type (default: STP_REBATE)' })
  @ApiResponse({ status: 200, description: 'Rebate calculation result returned successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden — not in subtree' })
  @ApiResponse({ status: 404, description: 'IB or config not found' })
  async calculateCascadeDistribution(
    @Query('ibId') ibId: string,
    @Query('assetType') assetType: AssetType,
    @Query('lots') lots: string,
    @Query('rebateType') rebateType: RebateType = RebateType.STP_REBATE,
  ) {
    const parsedLots = Number(lots);
    return this.rebateService.calculateCascadeDistribution(ibId, assetType, parsedLots, rebateType);
  }
}
