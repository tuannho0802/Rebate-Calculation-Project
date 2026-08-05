import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { PayoutService } from './payout.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Lv0Guard } from '../../common/guards/lv0.guard';
import { SelfFinanceGuard } from '../../common/guards/self-finance.guard';
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
  constructor(private readonly payoutService: PayoutService) { }

  @Post()
  @UseGuards(SelfFinanceGuard)
  @ApiOperation({ summary: 'IB yêu cầu rút tiền (Admin bị chặn)' })
  requestPayout(@CurrentUser() user: any, @Body() dto: RequestPayoutDto) {
    return this.payoutService.requestPayout(user.sub, new Decimal(dto.amount), dto.paymentMethod, dto.note);
  }

  @Get('pending')
  @UseGuards(Lv0Guard)
  @ApiOperation({ summary: 'Lấy danh sách payout đang chờ duyệt (Lv0 xem trong nhánh của mình, Admin xem toàn hệ thống)' })
  getPendingPayouts(
    @CurrentUser() user: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.payoutService.getPendingPayouts(Number(page), Number(limit), user.sub, user.role);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách payout (Lv0 xem tất cả, Lv1+ xem của mình)' })
  listPayouts(@CurrentUser() user: any, @Query() query: QueryPayoutDto) {
    return this.payoutService.listPayouts(user.sub, user.level, query, user.role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết 1 payout' })
  @ApiResponse({ status: 403, description: 'Payout không thuộc subtree/nhánh của bạn' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy payout' })
  async getPayout(@CurrentUser() user: any, @Param('id') id: string) {
    // FIX: bản cũ bỏ qua hẳn tham số `id`, luôn trả về payout đầu tiên
    // trong listPayouts({limit:1}) bất kể client hỏi payout nào.
    return this.payoutService.getPayoutById(id, user.sub, user.level, user.role);
  }

  @Patch(':id/approve')
  @UseGuards(Lv0Guard)
  @ApiOperation({ summary: 'Duyệt payout (Lv0/Admin — Lv0 chỉ trong nhánh của mình)' })
  @ApiResponse({ status: 403, description: 'Payout không thuộc nhánh của bạn' })
  approvePayout(@CurrentUser() user: any, @Param('id') id: string) {
    return this.payoutService.approvePayout(id, user.sub, user.role);
  }

  @Patch(':id/reject')
  @UseGuards(Lv0Guard)
  @ApiOperation({ summary: 'Từ chối payout (Lv0/Admin — Lv0 chỉ trong nhánh của mình)' })
  @ApiResponse({ status: 403, description: 'Payout không thuộc nhánh của bạn' })
  rejectPayout(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: RejectPayoutDto) {
    return this.payoutService.rejectPayout(id, user.sub, dto.rejectedReason, user.role);
  }
}