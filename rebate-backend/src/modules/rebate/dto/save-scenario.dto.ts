import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class BranchScenarioNodeDto {
  @ApiProperty({ description: 'UUID của IB Node' })
  @IsUUID()
  ibId!: string;

  @ApiProperty({ description: 'Loại tài khoản link', example: 'STD10', required: false })
  @IsOptional()
  @IsString()
  accountType?: string;

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

  @ApiProperty({ description: 'Loại tài khoản link cho đợt lưu kịch bản này', example: 'STD10', required: false })
  @IsOptional()
  @IsString()
  accountType?: string;
}
