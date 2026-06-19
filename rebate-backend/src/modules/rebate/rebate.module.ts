import { Module } from '@nestjs/common';
import { RebateService } from './rebate.service';
import { RebateController } from './rebate.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [RebateController],
  providers: [RebateService],
  exports: [RebateService],
})
export class RebateModule {}
