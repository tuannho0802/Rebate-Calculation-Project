import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsNumber, IsString, Min, ValidateNested } from 'class-validator';

export class MibMaxOverrideItemDto {
  @ApiProperty({ example: 'D_FOREX', description: 'Mã sản phẩm (Symbol)' })
  @IsString()
  @IsNotEmpty()
  assetType!: string;

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
