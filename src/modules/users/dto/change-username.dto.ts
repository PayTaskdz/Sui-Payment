import { IsString, MinLength, MaxLength } from 'class-validator';

export class hangeUsernameDto {
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  newUsername: string;
}
