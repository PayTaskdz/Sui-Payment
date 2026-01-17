import { IsString } from 'class-validator';

export class ScanQrDto {
  @IsString()
  qrString: string;

  @IsString()
  userId: string; // Current user scanning (for audit/future features)
}
