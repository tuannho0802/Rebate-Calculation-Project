import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateIbDto {
  @ApiProperty({ example: 'new-sub-ib@test.com', description: 'Địa chỉ email của Sub-IB mới (phải là duy nhất trong hệ thống)' })
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email!: string;

  @ApiProperty({ example: 'Test@1234', description: 'Mật khẩu ban đầu cho Sub-IB (tối thiểu 6 ký tự)' })
  @IsString()
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  password!: string;

  @ApiProperty({ example: 'Nguyen Van A', description: 'Tên hiển thị của Sub-IB' })
  @IsString()
  @IsNotEmpty({ message: 'Tên không được để trống' })
  name!: string;
}
