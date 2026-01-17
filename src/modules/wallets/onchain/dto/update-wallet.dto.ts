import { IsString, IsOptional } from 'class-validator';

export class UpdateWalletDto {
  @IsString()
  @IsOptional()
  label?: string;
}
