import { Controller, Get, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { RebateService } from './rebate.service';
import { UpdateRebateConfigDto } from './dto/update-config.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SubtreeGuard } from '../../common/guards/subtree.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AssetType } from '@prisma/client';

@Controller('rebate')
@UseGuards(JwtAuthGuard)
export class RebateController {
  constructor(private readonly rebateService: RebateService) {}

  @Get('config/:ibId')
  @UseGuards(SubtreeGuard)
  async getConfig(@Param('ibId') ibId: string) {
    return this.rebateService.getConfig(ibId);
  }

  @Put('config/:ibId')
  @UseGuards(SubtreeGuard)
  async updateConfig(
    @CurrentUser() user: any,
    @Param('ibId') ibId: string,
    @Body() updateDto: UpdateRebateConfigDto,
  ) {
    return this.rebateService.updateConfig(user.sub, ibId, updateDto);
  }

  @Get('calculate')
  @UseGuards(SubtreeGuard)
  async calculate(
    @Query('ibId') ibId: string,
    @Query('assetType') assetType: AssetType,
    @Query('lots') lots: string,
  ) {
    const parsedLots = parseFloat(lots) || 0;
    return this.rebateService.calculate(ibId, assetType, parsedLots);
  }
}

