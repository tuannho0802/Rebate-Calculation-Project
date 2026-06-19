import { Module } from '@nestjs/common';
import { IbService } from './ib.service';
import { IbController } from './ib.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [IbController],
  providers: [IbService],
  exports: [IbService],
})
export class IbModule {}
