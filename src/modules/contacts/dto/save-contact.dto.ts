import { IsString, IsOptional } from 'class-validator';

export class SaveContactDto {
  @IsString()
  recipientUsername: string;

  @IsString()
  @IsOptional()
  label?: string;
}
