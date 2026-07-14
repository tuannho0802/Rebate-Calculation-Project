import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsNotEmpty, IsNumber, Min, ValidateNested } from 'class-validator';
import { AssetType } from '@prisma/client';

export class MibMaxOverrideItemDto {
  @ApiProperty({ enum: AssetType, example: AssetType.D_FOREX })
  @IsEnum(AssetType)
  @IsNotEmpty()
  assetType!: AssetType;

  @ApiProperty({ example: 'STP_REBATE' })
  @IsNotEmpty()
  rebateType!: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(0)
  maxPips!: number;
}

export class MibMaxOverrideDto {
  @ApiProperty({ type: [MibMaxOverrideItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MibMaxOverrideItemDto)
  overrides!: MibMaxOverrideItemDto[];
}
