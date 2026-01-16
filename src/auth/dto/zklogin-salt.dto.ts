import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ZkLoginSaltRequestDto {
  @ApiProperty({ description: 'Google OIDC id_token JWT' })
  @IsString()
  idToken!: string;
}

export class ZkLoginSaltResponseDto {
  @ApiProperty({ description: 'base64 salt' })
  salt!: string;
}

