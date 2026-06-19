import {
  IsUUID, IsEnum, IsNumber, IsOptional, IsDateString,
  IsString, Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AssetType, RebateType } from '@prisma/client';

export class CreateTransactionDto {
  @IsUUID()
  @ApiProperty({ example: 'uuid-of-ib', description: 'ID của IB thực hiện giao dịch' })
  ibId: string;

  @IsEnum(AssetType)
  @ApiProperty({ enum: AssetType, example: 'FOREX' })
  assetType: AssetType;

  @IsEnum(RebateType)
  @IsOptional()
  @ApiProperty({ enum: RebateType, default: 'STP_REBATE', required: false })
  rebateType?: RebateType;

  @IsNumber()
  @Min(0.0001)
  @ApiProperty({ example: 1.5, description: 'Số lot giao dịch (tối thiểu 0.0001)' })
  lots: number;

  @IsNumber()
  @Min(0)
  @ApiProperty({ example: 3.00, description: 'Số tiền rebate (USD)' })
  rebateAmount: number;

  @IsDateString()
  @ApiProperty({ example: '2026-06-15T10:00:00Z', description: 'Thời điểm giao dịch' })
  tradedAt: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ example: 'Giao dịch tháng 6', required: false })
  note?: string;
}
