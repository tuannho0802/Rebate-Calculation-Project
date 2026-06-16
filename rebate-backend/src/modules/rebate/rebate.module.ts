import { Module } from '@nestjs/common';
import { RebateService } from './rebate.service';
import { RebateController } from './rebate.controller';

@Module({
  controllers: [RebateController],
  providers: [RebateService],
  exports: [RebateService],
})
export class RebateModule {}
