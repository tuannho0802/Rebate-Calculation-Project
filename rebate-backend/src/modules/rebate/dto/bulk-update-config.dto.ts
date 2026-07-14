import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RebateAssetConfigDto } from './update-config.dto';

export class BulkRebateItemDto {
  @ApiProperty({ description: 'UUID của IB cần cập nhật', example: 'clxyz123' })
  @IsString()
  @IsNotEmpty()
  ibId!: string;

  @ApiProperty({ type: [RebateAssetConfigDto], description: 'Danh sách cấu hình asset cần cập nhật' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RebateAssetConfigDto)
  assets!: RebateAssetConfigDto[];
}

export class BulkUpdateRebateConfigDto {
  @ApiProperty({ type: [BulkRebateItemDto], description: 'Danh sách IB cần cập nhật (tối đa 200)' })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => BulkRebateItemDto)
  items!: BulkRebateItemDto[];

  @ApiProperty({
    enum: ['direct', 'cascade'],
    required: false,
    default: 'direct',
    description: 'Phạm vi thông báo khi Admin sửa config: direct (chỉ IB đó) hoặc cascade (IB + toàn bộ chain cha)',
  })
  @IsOptional()
  @IsString()
  notifyScope?: 'direct' | 'cascade';
}
