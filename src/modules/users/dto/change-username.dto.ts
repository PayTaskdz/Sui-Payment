import { IsString, MinLength, MaxLength } from 'class-validator';

export class ChangeUsernameDto {
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  newUsername: string;
}
