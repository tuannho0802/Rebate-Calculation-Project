import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum } from 'class-validator';
import { AssetType } from '@prisma/client';

export class UpdateDisabledAssetTypesDto {
  @ApiProperty({
    enum: AssetType,
    isArray: true,
    example: [AssetType.BITCOIN, AssetType.CRYPTO],
    description: 'Array of asset types that are locked / disabled by Admin',
  })
  @IsArray()
  @IsEnum(AssetType, { each: true })
  disabledAssetTypes!: AssetType[];
}
