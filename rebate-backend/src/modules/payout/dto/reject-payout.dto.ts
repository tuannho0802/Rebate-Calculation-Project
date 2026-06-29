import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectPayoutDto {
  @ApiProperty({ description: 'Lý do từ chối (tối thiểu 10 ký tự)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  rejectedReason: string;
}
