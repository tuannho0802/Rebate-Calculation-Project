import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ example: 'GOLD_MINI', description: 'Mã ký hiệu sản phẩm (chữ hoa, số, gạch dưới)' })
  @IsString({ message: 'Mã sản phẩm phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Mã sản phẩm không được để trống' })
  @Matches(/^[A-Z0-9_]+$/, { message: 'Mã sản phẩm chỉ được chứa chữ cái in hoa, chữ số và dấu gạch dưới' })
  symbol!: string;

  @ApiProperty({ example: 'Gold Mini (XAUUSD)', description: 'Tên hiển thị của sản phẩm' })
  @IsString({ message: 'Tên sản phẩm phải là chuỗi' })
  @IsNotEmpty({ message: 'Tên sản phẩm không được để trống' })
  name!: string;

  @ApiProperty({ example: 'Metals', description: 'Danh mục sản phẩm', required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ example: 20, description: 'Mức trần Max Pips/USD mặc định của sàn' })
  @IsNumber({}, { message: 'Mức trần mặc định phải là số' })
  @Min(0, { message: 'Mức trần mặc định phải lớn hơn hoặc bằng 0' })
  defaultMax!: number;

  @ApiProperty({ example: 'pips', description: 'Đơn vị tính: pips, USD, %', default: 'pips', required: false })
  @IsOptional()
  @IsString()
  calcUnit?: string;

  @ApiProperty({ example: 0, description: 'Thứ tự hiển thị', required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  order?: number;

  @ApiProperty({ example: true, description: 'Cho phép áp dụng Link Markup (Bật/Tắt)', required: false, default: true })
  @IsOptional()
  @IsBoolean()
  allowMarkup?: boolean;
}
