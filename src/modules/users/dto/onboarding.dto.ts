import { IsEmail, IsOptional, IsString, Length, Matches } from 'class-validator';

export class OnboardingDto {
  @IsString()
  @Length(3, 30)
  @Matches(/^[a-z0-9_]+$/)
  username: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Length(3, 30)
  @Matches(/^[a-z0-9_]+$/)
  referralUsername?: string;
}

