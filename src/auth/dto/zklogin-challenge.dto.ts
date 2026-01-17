import { ApiProperty } from '@nestjs/swagger';

export class ZkLoginChallengeResponseDto {
  @ApiProperty()
  nonce!: string;

  @ApiProperty({ example: '123' })
  maxEpoch!: string;

  @ApiProperty({ example: 'paypath.app' })
  domain!: string;

  @ApiProperty({ example: '2026-01-16T12:05:00.000Z' })
  expirationTime!: string;
}

