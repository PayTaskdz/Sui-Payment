import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,

  IsString,
  Matches,
  Min,
  ValidateIf,
} from 'class-validator';

export class QuoteDto {
  @ApiProperty({ example: 'FIAT_TO_USDC', enum: ['FIAT_TO_USDC', 'USDC_TO_FIAT'] })
  @IsString()
  @IsIn(['FIAT_TO_USDC', 'USDC_TO_FIAT'])
  direction: 'FIAT_TO_USDC' | 'USDC_TO_FIAT';

  @ApiProperty({ example: 26000, description: 'Required when direction=FIAT_TO_USDC' })
  @ValidateIf((o: QuoteDto) => o.direction === 'FIAT_TO_USDC')
  @IsNumber()
  @Min(0)
  fiatAmount?: number;

  @ApiProperty({ example: '0.9985', description: 'Required when direction=USDC_TO_FIAT' })
  @ValidateIf((o: QuoteDto) => o.direction === 'USDC_TO_FIAT')
  @IsString()
  @Matches(/^[0-9]+(\.[0-9]+)?$/, { message: 'usdcAmount must be a decimal string' })
  usdcAmount?: string;

  @ApiProperty({ example: 'VN', description: 'Country for Gaian calculateExchange' })
  @IsString()
  @IsNotEmpty()
  country: string;

  @ApiProperty({ example: 'USDC' })
  @IsString()
  @IsNotEmpty()
  token: string;
}

