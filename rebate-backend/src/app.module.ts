import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { IbModule } from './modules/ib/ib.module';
import { RebateModule } from './modules/rebate/rebate.module';
import { ReportModule } from './modules/report/report.module';
import { DocsModule } from './modules/docs/docs.module';
import { AuditModule } from './modules/audit/audit.module';
import { TransactionModule } from './modules/transaction/transaction.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { NotificationModule } from './modules/notification/notification.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { PayoutModule } from './modules/payout/payout.module';
import { ExportModule } from './modules/export/export.module';
import { AppController } from './app.controller';
import { AdminModule } from './modules/admin/admin.module';
import { TrashModule } from './modules/trash/trash.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    IbModule,
    RebateModule,
    ReportModule,
    DocsModule,
    AuditModule,
    TransactionModule,
    DashboardModule,
    NotificationModule,
    WalletModule,
    PayoutModule,
    ExportModule,
    AdminModule,
    TrashModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
