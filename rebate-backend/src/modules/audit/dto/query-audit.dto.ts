import { IsOptional, IsString, IsDateString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class QueryAuditDto {
  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, description: 'UUID của người thực hiện thao tác' })
  actorId?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, description: 'UUID của entity bị tác động' })
  targetId?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, example: 'REBATE_CONFIG_UPDATE', description: 'Loại thao tác' })
  action?: string;

  @IsOptional()
  @IsDateString()
  @ApiProperty({ required: false, example: '2026-06-01', description: 'Từ ngày (YYYY-MM-DD)' })
  from?: string;

  @IsOptional()
  @IsDateString()
  @ApiProperty({ required: false, example: '2026-06-30', description: 'Đến ngày (YYYY-MM-DD)' })
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiProperty({ required: false, default: 1 })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @ApiProperty({ required: false, default: 20 })
  limit?: number = 20;
}
