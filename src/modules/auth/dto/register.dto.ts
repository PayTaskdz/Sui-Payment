import { IsString, IsEmail, IsOptional } from 'class-validator';

export class RegisterDto {
  @IsString()
  walletAddress: string;

  @IsEmail()
  @IsOptional()
  email?: string;
}
