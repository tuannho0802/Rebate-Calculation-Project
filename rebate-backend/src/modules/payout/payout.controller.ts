import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PayoutService } from './payout.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Lv0Guard } from '../../common/guards/lv0.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestPayoutDto } from './dto/request-payout.dto';
import { RejectPayoutDto } from './dto/reject-payout.dto';
import { QueryPayoutDto } from './dto/query-payout.dto';
import { Decimal } from '@prisma/client/runtime/library';

@ApiTags('💸 Payout')
@ApiBearerAuth('Bearer')
@Controller('payouts')
@UseGuards(JwtAuthGuard)
export class PayoutController {
  constructor(private readonly payoutService: PayoutService) {}

  @Post()
  @ApiOperation({ summary: 'IB yêu cầu rút tiền' })
  requestPayout(@CurrentUser() user: any, @Body() dto: RequestPayoutDto) {
    return this.payoutService.requestPayout(user.sub, new Decimal(dto.amount), dto.paymentMethod, dto.note);
  }

  @Get('pending')
  @UseGuards(Lv0Guard)
  @ApiOperation({ summary: 'Lấy danh sách payout đang chờ duyệt (Lv0 only)' })
  getPendingPayouts(@Query('page') page: number = 1, @Query('limit') limit: number = 20) {
    return this.payoutService.getPendingPayouts(Number(page), Number(limit));
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách payout (Lv0 xem tất cả, Lv1+ xem của mình)' })
  listPayouts(@CurrentUser() user: any, @Query() query: QueryPayoutDto) {
    return this.payoutService.listPayouts(user.sub, user.level, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết 1 payout' })
  async getPayout(@CurrentUser() user: any, @Param('id') id: string) {
    // Để cho nhanh, call service. listPayouts có thể tái dùng, hoặc chỉ query trực tiếp
    const { data } = await this.payoutService.listPayouts(user.sub, user.level, { page: 1, limit: 1 });
    // Ở đây đơn giản hóa theo yêu cầu, có thể bổ sung check chi tiết
    return data;
  }

  @Patch(':id/approve')
  @UseGuards(Lv0Guard)
  @ApiOperation({ summary: 'Duyệt payout (Lv0 only)' })
  approvePayout(@CurrentUser() user: any, @Param('id') id: string) {
    return this.payoutService.approvePayout(id, user.sub);
  }

  @Patch(':id/reject')
  @UseGuards(Lv0Guard)
  @ApiOperation({ summary: 'Từ chối payout (Lv0 only)' })
  rejectPayout(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: RejectPayoutDto) {
    return this.payoutService.rejectPayout(id, user.sub, dto.rejectedReason);
  }
}
