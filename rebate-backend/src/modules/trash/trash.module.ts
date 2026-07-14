import { Module } from '@nestjs/common';
import { TrashController } from './trash.controller';
import { TrashService } from './trash.service';

import { NotificationModule } from '../notification/notification.module';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule, NotificationModule, AuditModule],
  controllers: [TrashController],
  providers: [TrashService]
})
export class TrashModule {}
