import { IsArray, ValidateNested, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CreateTransactionDto } from './create-transaction.dto';

export class CreateBatchTransactionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTransactionDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ApiProperty({ type: [CreateTransactionDto], description: 'Danh sách giao dịch (1-500)' })
  transactions: CreateTransactionDto[];
}
