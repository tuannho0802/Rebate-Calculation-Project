import { Module } from '@nestjs/common';
import { IbService } from './ib.service';
import { IbController } from './ib.controller';

@Module({
  controllers: [IbController],
  providers: [IbService],
  exports: [IbService],
})
export class IbModule {}
