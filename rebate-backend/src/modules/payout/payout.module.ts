import { Module } from '@nestjs/common';
import { PayoutService } from './payout.service';
import { PayoutController } from './payout.controller';
import { WalletModule } from '../wallet/wallet.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [WalletModule, AuditModule, NotificationModule],
  controllers: [PayoutController],
  providers: [PayoutService],
})
export class PayoutModule {}
