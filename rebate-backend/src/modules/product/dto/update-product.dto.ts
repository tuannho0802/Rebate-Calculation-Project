import { IsBoolean, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProductDto {
  @ApiProperty({ example: 'GOLD_MINI', description: 'Mã ký hiệu sản phẩm', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9_]+$/, { message: 'Mã sản phẩm chỉ được chứa chữ cái in hoa, chữ số và dấu gạch dưới' })
  symbol?: string;

  @ApiProperty({ example: 'Gold Mini (XAUUSD)', description: 'Tên hiển thị', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'Metals', description: 'Danh mục sản phẩm', required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ example: 20, description: 'Mức trần Max Pips/USD mặc định', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Mức trần mặc định phải lớn hơn hoặc bằng 0' })
  defaultMax?: number;

  @ApiProperty({ example: 'pips', description: 'Đơn vị tính', required: false })
  @IsOptional()
  @IsString()
  calcUnit?: string;

  @ApiProperty({ example: 0, description: 'Thứ tự hiển thị', required: false })
  @IsOptional()
  @IsNumber()
  order?: number;

  @ApiProperty({ example: true, description: 'Trạng thái hoạt động (bật/tắt/khoá)', required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ example: true, description: 'Cho phép áp dụng Link Markup (Bật/Tắt)', required: false })
  @IsOptional()
  @IsBoolean()
  allowMarkup?: boolean;
}
