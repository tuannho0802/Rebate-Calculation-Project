import { IsNumber, Min, IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RequestPayoutDto {
  @ApiProperty({ description: 'Số tiền rút (tối thiểu 10)', minimum: 10 })
  @IsNumber()
  @Min(10)
  amount: number;

  @ApiProperty({ description: 'Phương thức thanh toán', example: 'bank_transfer' })
  @IsString()
  @IsNotEmpty()
  paymentMethod: string;

  @ApiPropertyOptional({ description: 'Ghi chú thêm' })
  @IsString()
  @IsOptional()
  note?: string;
}
