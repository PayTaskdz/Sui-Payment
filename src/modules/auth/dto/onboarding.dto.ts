import { IsString, IsEmail, IsOptional, MinLength, MaxLength } from 'class-validator';

export class OnboardingDto {
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  username: string;

  @IsString()
  walletAddress: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
