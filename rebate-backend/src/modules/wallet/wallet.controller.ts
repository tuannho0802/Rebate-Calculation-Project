import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('💰 Wallet')
@ApiBearerAuth('Bearer')
@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('me')
  @ApiOperation({ summary: 'Lấy thông tin ví của mình' })
  @ApiResponse({ status: 200, description: 'Trả về balance, totalEarned, totalPaid' })
  async getMyBalance(@CurrentUser() user: any) {
    const wallet = await this.walletService.getBalance(user.sub, user.sub, user.level);
    return {
      ibId: wallet.ibId,
      balance: Number(wallet.balance),
      totalEarned: Number(wallet.totalEarned),
      totalPaid: Number(wallet.totalPaid),
      currency: wallet.currency,
      updatedAt: wallet.updatedAt,
    };
  }

  @Get(':ibId')
  @ApiOperation({ summary: 'Lấy thông tin ví của IB trong cây (Lv0 xem tất cả)' })
  @ApiParam({ name: 'ibId', description: 'UUID của IB' })
  @ApiResponse({ status: 200, description: 'Trả về thông tin ví' })
  @ApiResponse({ status: 403, description: 'Không thuộc subtree' })
  async getIbBalance(@CurrentUser() user: any, @Param('ibId') ibId: string) {
    const wallet = await this.walletService.getBalance(user.sub, ibId, user.level);
    return {
      ibId: wallet.ibId,
      balance: Number(wallet.balance),
      totalEarned: Number(wallet.totalEarned),
      totalPaid: Number(wallet.totalPaid),
      currency: wallet.currency,
      updatedAt: wallet.updatedAt,
    };
  }
}
