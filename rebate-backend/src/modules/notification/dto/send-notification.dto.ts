import {
  IsUUID,
  IsString,
  MaxLength,
  IsEnum,
  IsOptional,
  IsObject,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';

export class SendNotificationDto {
  @IsUUID()
  @ApiProperty({ description: 'UUID của IB nhận thông báo (phải trong subtree của mình)' })
  recipientId: string;

  @IsString()
  @MaxLength(200)
  @ApiProperty({ example: 'Cập nhật rebate tháng 7' })
  title: string;

  @IsString()
  @MaxLength(2000)
  @ApiProperty({ example: 'Mức rebate của bạn đã được điều chỉnh lên 3 pips từ 01/07/2026.' })
  body: string;

  @IsEnum(NotificationType)
  @IsOptional()
  @ApiProperty({ enum: NotificationType, default: 'MANUAL', required: false })
  type?: NotificationType;

  @IsObject()
  @IsOptional()
  @ApiProperty({ required: false, example: { transactionId: 'uuid' } })
  metadata?: Record<string, unknown>;
}
