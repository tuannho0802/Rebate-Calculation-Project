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
import { AppController } from './app.controller';

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
  ],
  controllers: [AppController],
})
export class AppModule {}
