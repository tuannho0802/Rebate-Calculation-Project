import { Module } from '@nestjs/common';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { RebateModule } from '../rebate/rebate.module';

@Module({
  imports: [PrismaModule, RebateModule],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}
