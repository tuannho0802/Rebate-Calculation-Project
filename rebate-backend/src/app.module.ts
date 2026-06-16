import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { IbModule } from './modules/ib/ib.module';
import { RebateModule } from './modules/rebate/rebate.module';
import { ReportModule } from './modules/report/report.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    IbModule,
    RebateModule,
    ReportModule,
  ],
})
export class AppModule {}

