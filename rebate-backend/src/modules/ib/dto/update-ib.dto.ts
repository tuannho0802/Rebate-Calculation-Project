import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateIbDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @ApiPropertyOptional({ example: 'Nguyen Van B', description: 'Tên mới của IB (không bắt buộc)' })
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @ApiPropertyOptional({ example: 'newemail@example.com', description: 'Email mới (không bắt buộc, phải là duy nhất)' })
  email?: string;
}
