import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class VerifyDto {
  @ApiProperty({ example: '0x...' })
  @IsString()
  address!: string;

  @ApiPropertyOptional({ example: 'paypath.app', description: 'Optional. If omitted, backend uses AUTH_DOMAIN' })
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiProperty({ example: 'a1b2c3...' })
  @IsString()
  nonce!: string;

  @ApiProperty({ example: '2026-01-16T12:00:00.000Z' })
  @IsString()
  issuedAt!: string;

  @ApiProperty({ example: '2026-01-16T12:05:00.000Z' })
  @IsString()
  expirationTime!: string;

  @ApiPropertyOptional({ example: 'Sign in to PayPath' })
  @IsOptional()
  @IsString()
  statement?: string;

  @ApiProperty({ example: 'domain: paypath.app\naddress: 0x...\nnonce: ...\nissuedAt: ...\nexpirationTime: ...' })
  @IsString()
  message!: string;

  @ApiProperty({ example: '...' })
  @IsString()
  signature!: string;
}

