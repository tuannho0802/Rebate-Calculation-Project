import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength, IsArray } from 'class-validator';

export class CreateMibDto {
  @ApiProperty({ description: 'Email của MIB mới' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Tên hiển thị của MIB' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Mật khẩu của MIB', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ description: 'Loại tài khoản', default: 'STD' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  accountType?: string;

  @ApiPropertyOptional({ description: 'Danh sách các loại tài khoản link được cấp', type: [String] })
  @IsArray()
  @IsOptional()
  accountTypes?: string[];

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
}
