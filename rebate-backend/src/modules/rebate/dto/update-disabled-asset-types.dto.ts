import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';
export class UpdateDisabledAssetTypesDto {
  @ApiProperty({
    type: [String],
    isArray: true,
    example: ['BITCOIN', 'CRYPTO'],
    description: 'Array of product symbols that are locked / disabled by Admin',
  })
  @IsArray()
  @IsString({ each: true })
  disabledAssetTypes!: string[];
}
