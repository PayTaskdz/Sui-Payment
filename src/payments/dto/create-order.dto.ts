import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ example: 'alice' })
  @IsString()
  username: string;

  @ApiProperty({ example: 60000, description: 'Fiat amount to payout' })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({ example: 'VND', enum: ['VND', 'PHP'] })
  @IsString()
  @IsIn(['VND', 'PHP'])
  fiatCurrency: string;

  @ApiProperty({ example: 'USDC', description: 'Stablecoin user will transfer to partner wallet' })
  @IsString()
  cryptoCurrency: string;

  @ApiProperty({ example: 'VN', description: 'Country fiat for exchange calculation (e.g., VN, PH)' })
  @IsString()
  country: string;

  

  @ApiProperty({
    example: 'USDC',
    description: 'Token symbol/name used by Gaian calculateExchange endpoint',
  })
  @IsString()
  token: string;

  @ApiProperty({ example: '0x1234...abcd', description: 'User Sui wallet address (payer)' })
  @IsString()
  payerWalletAddress: string;

  @ApiPropertyOptional({ example: '3e2c3f8d-8c7c-4f2f-9f1c-4a2f52d0a8b1' })
  @IsOptional()
  @IsString()
  clientRequestId?: string;

  @ApiPropertyOptional({ example: 'invoice_0001' })
  @IsOptional()
  @IsString()
  transactionReference?: string;
}

