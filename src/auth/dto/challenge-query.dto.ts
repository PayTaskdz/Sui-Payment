import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ChallengeQueryDto {
  @ApiProperty({ example: '0x...' })
  @IsString()
  address!: string;
}

