import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ZkLoginRegisterDto {
  @ApiProperty({ description: 'Computed nonce (base64url) used in OIDC request' })
  @IsString()
  nonce!: string;
}

