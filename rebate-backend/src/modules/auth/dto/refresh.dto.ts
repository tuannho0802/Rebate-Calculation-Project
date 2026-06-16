import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshDto {
  @IsString()
  @IsNotEmpty({ message: 'Refresh token không được để trống' })
  refreshToken!: string;
}
