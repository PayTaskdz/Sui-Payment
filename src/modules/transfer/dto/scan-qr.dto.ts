import { IsString } from 'class-validator';

export class ScanQrDto {
  @IsString()
  qrString: string;
}
