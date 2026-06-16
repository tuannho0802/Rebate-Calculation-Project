import { Module } from '@nestjs/common';
import { DocsController } from './docs.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [DocsController],
})
export class DocsModule {}
