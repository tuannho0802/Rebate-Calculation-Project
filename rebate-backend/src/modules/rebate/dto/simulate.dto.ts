import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsArray, IsOptional, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CustomNodeInputDto {
  @ApiProperty({ example: 'node-1' })
  @IsString()
  nodeId: string;

  @ApiProperty({ example: 'MIB Node' })
  @IsString()
  nodeName: string;

  @ApiProperty({ example: 0 })
  @IsNumber()
  level: number;

  @ApiProperty({
    example: { GOLD: 30, FOREX: 22 },
    description: 'Map of AssetType to total rebate pips held at node',
  })
  assets: Record<string, number>;
}

export class CustomSimulateDto {
  @ApiProperty({ type: [CustomNodeInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomNodeInputDto)
  treeNodes: CustomNodeInputDto[];

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(0)
  markupPips: number;

  @ApiPropertyOptional({ type: [String], example: ['GOLD', 'FOREX'] })
  @IsOptional()
  @IsArray()
  selectedAssets?: string[];
}
