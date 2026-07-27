import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';
import { CreateIbDto } from '../../ib/dto/create-ib.dto';

export class CreateSubIbByAdminDto extends CreateIbDto {
  @ApiProperty({ description: 'UUID của node cha do Admin chọn' })
  @IsUUID()
  @IsNotEmpty()
  targetParentId: string;
}
