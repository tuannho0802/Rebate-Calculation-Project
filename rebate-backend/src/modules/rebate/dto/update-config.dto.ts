import { IsArray, IsEnum, IsNumber, IsNotEmpty, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { AssetType, RebateType } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class RebateAssetConfigDto {
  @ApiProperty({ enum: AssetType, example: AssetType.FOREX, description: 'Asset type category' })
  @IsEnum(AssetType, { message: 'Loại tài sản không hợp lệ' })
  @IsNotEmpty()
  assetType!: AssetType;

  @IsEnum(RebateType)
  @ApiProperty({ enum: RebateType, default: 'STP_REBATE' })
  rebateType!: RebateType;

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
}

