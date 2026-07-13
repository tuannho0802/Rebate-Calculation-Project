import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateIbDto {
  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ example: 'Nguyen Van B', description: 'Tên mới của IB (không bắt buộc)' })
  name?: string;

  @IsEmail()
  @IsOptional()
  @ApiPropertyOptional({ example: 'new-email@test.com', description: 'Email mới (không bắt buộc)' })
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  @ApiPropertyOptional({ description: 'Số điện thoại' })
  phone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  @ApiPropertyOptional({ description: 'Quốc gia' })
  country?: string;

  @ApiPropertyOptional({ description: 'Loại tài khoản IB', default: 'SEA STD' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  accountType?: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ description: 'Thông tin tài khoản ngân hàng (JSON)' })
  bankAccount?: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ description: 'Thông tin thanh toán (JSON)' })
  paymentInfo?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  @ApiPropertyOptional({ description: 'Ghi chú nội bộ' })
  notes?: string;
}
