import { IsString, IsOptional } from 'class-validator';

export class RegisterDto {
  @IsString()
  walletAddress: string;

  @IsString()
  @IsOptional()
  referralUsername?: string;
}
