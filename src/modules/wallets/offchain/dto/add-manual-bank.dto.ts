import { IsString, IsOptional } from 'class-validator';

export class AddManualBankDto {
  @IsString()
  country: string; // "VN", "PH"

  @IsString()
  bankBin: string;

  @IsString()
  bankName: string;

  @IsString()
  accountNumber: string;

  @IsString()
  accountName: string;

  @IsString()
  @IsOptional()
  label?: string;

  @IsString()
  qrString: string; // Required for Place Order API
}
