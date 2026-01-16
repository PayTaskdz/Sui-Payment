import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsString } from 'class-validator';

export class ZkLoginVerifyDto {
  @ApiProperty({ description: 'Google OIDC id_token JWT' })
  @IsString()
  idToken!: string;

  @ApiProperty()
  @IsString()
  nonce!: string;

  @ApiProperty({ example: '123' })
  @IsString()
  maxEpoch!: string;

  @ApiProperty({ description: 'base64(jwtRandomness)' })
  @IsString()
  jwtRandomness!: string;

  @ApiProperty({ description: 'base64(extended ephemeral public key)' })
  @IsString()
  extendedEphemeralPublicKey!: string;

  @ApiProperty({ example: 'sub' })
  @IsString()
  keyClaimName!: string;

  @ApiProperty({ description: 'Proof response returned by prover-fe /v1' })
  @IsObject()
  proof!: Record<string, unknown>;
}

