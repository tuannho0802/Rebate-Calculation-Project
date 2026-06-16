import { IsArray, IsEnum, IsNumber, IsNotEmpty, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { AssetType } from '@prisma/client';

export class RebateAssetConfigDto {
  @IsEnum(AssetType, { message: 'Loại tài sản không hợp lệ' })
  @IsNotEmpty()
  assetType!: AssetType;

  @IsNumber({}, { message: 'rebatePips phải là số' })
  @Min(0, { message: 'rebatePips phải là số dương hoặc 0' })
  rebatePips!: number;

  @IsNumber({}, { message: 'markupPips phải là số' })
  @Min(0, { message: 'markupPips phải là số dương hoặc 0' })
  markupPips!: number;

  @IsNumber({}, { message: 'markupPercent phải là số' })
  @Min(0, { message: 'markupPercent tối thiểu là 0%' })
  @Max(100, { message: 'markupPercent tối đa là 100%' })
  markupPercent!: number;
}

export class UpdateRebateConfigDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RebateAssetConfigDto)
  assets!: RebateAssetConfigDto[];
}
