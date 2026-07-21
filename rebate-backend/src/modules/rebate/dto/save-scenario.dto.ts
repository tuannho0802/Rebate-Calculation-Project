import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsNumber, IsString, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class BranchScenarioNodeDto {
  @ApiProperty({ description: 'UUID của IB Node' })
  @IsString()
  @IsNotEmpty()
  ibId!: string;

  @ApiProperty({ description: 'Tỷ lệ % giữ lại (0 - 100)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  markupPercent!: number;

  @ApiProperty({ description: 'Số pips markup giữ lại' })
  @IsNumber()
  @Min(0)
  markupPips!: number;
}

export class SaveBranchScenarioDto {
  @ApiProperty({ type: [BranchScenarioNodeDto], description: 'Danh sách các node trong nhánh cùng với tỷ lệ % và số pips giữ lại' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BranchScenarioNodeDto)
  nodes!: BranchScenarioNodeDto[];
}
