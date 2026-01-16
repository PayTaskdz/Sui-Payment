import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ConfirmUserPaymentDto {
  @ApiProperty({ example: '5Hh9gNq...txDigest' })
  @IsString()
  userPaymentTxDigest: string;
}

