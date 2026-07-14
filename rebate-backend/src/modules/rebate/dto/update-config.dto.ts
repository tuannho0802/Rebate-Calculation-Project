import { IsArray, IsEnum, IsNumber, IsNotEmpty, IsOptional, IsString, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { AssetType } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class RebateAssetConfigDto {
  @ApiProperty({ enum: AssetType, example: AssetType.FOREX, description: 'Asset type category' })
  @IsEnum(AssetType, { message: 'Loại tài sản không hợp lệ' })
  @IsNotEmpty()
  assetType!: AssetType;

  @IsOptional()
  @IsString({ message: 'rebateType phải là chuỗi' })
  @ApiProperty({ example: 'CUSTOM_REBATE', description: 'Custom rebate type name', required: false, default: 'STP_REBATE' })
  rebateType: string = 'STP_REBATE';

  @ApiProperty({ example: 2.0, description: 'Pips retained by the IB' })
  @IsNumber({}, { message: 'rebatePips phải là số' })
  @Min(0, { message: 'rebatePips phải là số dương hoặc 0' })
  rebatePips!: number;

  @ApiProperty({ example: 8.0, description: 'Pips passed down to child IBs' })
  @IsNumber({}, { message: 'markupPips phải là số' })
  @Min(0, { message: 'markupPips phải là số dương hoặc 0' })
  markupPips!: number;

  @ApiProperty({ example: 100.0, description: 'Markup allocation percentage' })
  @IsNumber({}, { message: 'markupPercent phải là số' })
  @Min(0, { message: 'markupPercent tối thiểu là 0%' })
  @Max(100, { message: 'markupPercent tối đa là 100%' })
  markupPercent!: number;
}

export class UpdateRebateConfigDto {
  @ApiProperty({ type: [RebateAssetConfigDto], description: 'List of asset configurations to update' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RebateAssetConfigDto)
  assets!: RebateAssetConfigDto[];

  @ApiProperty({
    enum: ['direct', 'cascade'],
    required: false,
    default: 'direct',
    description: 'Admin only — phạm vi thông báo khi Admin sửa config: direct (chỉ IB đó) hoặc cascade (IB + toàn bộ chain cha)',
  })
  @IsOptional()
  @IsString()
  notifyScope?: 'direct' | 'cascade';
}

