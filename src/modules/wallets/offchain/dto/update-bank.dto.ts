import { IsString, IsOptional } from 'class-validator';

export class UpdateBankDto {
  @IsString()
  @IsOptional()
  label?: string;
}
