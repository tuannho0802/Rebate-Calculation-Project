import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AccountTypeRowDto {
  @ApiProperty({ description: 'Mã loại sản phẩm hoặc symbol', example: 'FOREX' })
  @IsString()
  @IsNotEmpty()
  assetType!: string;

  @ApiProperty({ description: 'Giá trị tối đa (max ceiling) cho rebate template', example: '8' })
  @IsString()
  @IsNotEmpty()
  maxCeiling!: string;

  @ApiProperty({ description: 'Đơn vị tính cho loại sản phẩm', example: 'pips' })
  @IsString()
  @IsNotEmpty()
  calcUnit!: string;
}

export class AccountTypeTemplateDto {
  @ApiProperty({ description: 'Tên bảng account type', example: 'SEA STD' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ type: [AccountTypeRowDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AccountTypeRowDto)
  rows!: AccountTypeRowDto[];
}

export class MarkupLinkRowDto {
  @ApiProperty({ description: 'Tên link markup / account type', example: 'SEA STD' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Share markup tối đa', example: 8 })
  @IsNumber()
  @Min(0)
  share!: number;
}

export class SaveRebateTemplatesDto {
  @ApiProperty({ type: [AccountTypeTemplateDto], description: 'Danh sách bảng account type' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AccountTypeTemplateDto)
  accountTypeTemplates!: AccountTypeTemplateDto[];

  @ApiProperty({ type: [MarkupLinkRowDto], description: 'Danh sách link markup templates' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarkupLinkRowDto)
  markupLinkTemplates!: MarkupLinkRowDto[];
}
