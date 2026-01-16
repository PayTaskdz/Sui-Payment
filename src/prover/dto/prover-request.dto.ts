import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ProverRequestDto {
  @ApiProperty({ description: 'OIDC id_token JWT' })
  @IsString()
  jwt!: string;

  @ApiProperty({ description: 'base64(extended ephemeral public key)' })
  @IsString()
  extendedEphemeralPublicKey!: string;

  @ApiProperty({ description: 'maxEpoch as string or number encoded as string', example: '10' })
  @IsString()
  maxEpoch!: string;

  @ApiProperty({ description: 'base64(jwtRandomness)' })
  @IsString()
  jwtRandomness!: string;

  @ApiProperty({ description: 'base64(userSalt)' })
  @IsString()
  salt!: string;

  @ApiProperty({ description: 'JWT claim name used for identity (usually sub)', example: 'sub' })
  @IsString()
  keyClaimName!: string;
}

