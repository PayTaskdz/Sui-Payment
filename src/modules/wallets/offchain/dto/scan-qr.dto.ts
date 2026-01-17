import { IsString, IsOptional } from 'class-validator';

export class ScanQrDto {
  @IsString()
  qrString: string;

  @IsString()
  @IsOptional()
  country?: string = 'VN';

  @IsString()
  @IsOptional()
  label?: string;
}
