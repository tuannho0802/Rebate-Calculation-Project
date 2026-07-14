import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateIbDto {
  @ApiProperty({ description: 'Email của sub-IB' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Tên hiển thị của IB', default: '' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Mật khẩu của sub-IB', minLength: 6 })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ description: 'Số điện thoại' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ description: 'Quốc gia' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({ description: 'Thông tin tài khoản ngân hàng (JSON)' })
  @IsString()
  @IsOptional()
  bankAccount?: string;

  @ApiPropertyOptional({ description: 'Thông tin thanh toán (JSON)' })
  @IsString()
  @IsOptional()
  paymentInfo?: string;

  @ApiPropertyOptional({ description: 'Loại tài khoản IB', default: 'SEA STD' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  accountType?: string;

  @ApiPropertyOptional({
    description: 'UUID của account type template dùng để khởi tạo rebate_configs cho IB mới',
  })
  @IsUUID()
  @IsOptional()
  accountTypeTemplateId?: string;

  @ApiPropertyOptional({ description: 'Ghi chú nội bộ' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;
}
