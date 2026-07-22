import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MoveIbDto {
  @ApiProperty({
    description: 'ID của IB/MIB cấp trên mới muốn ghép nhánh vào',
    example: 'd9b23b12-3456-7890-abcd-ef1234567890',
  })
  @IsNotEmpty({ message: 'targetParentId không được để trống' })
  @IsString({ message: 'targetParentId phải là chuỗi ký tự' })
  targetParentId: string;
}
