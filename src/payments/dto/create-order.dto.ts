import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ example: '00020101021138...', description: 'Bank QR string for Gaian payout' })
  @IsString()
  qrString: string;

  @ApiProperty({ example: 10, description: 'USDC amount to send (will be converted to fiat for payout)' })
  @IsNumber()
  @Min(0.01)
  usdcAmount: number;

  @ApiProperty({ example: '0x1234...abcd', description: 'Payer Sui wallet address' })
  @IsString()
  payerWalletAddress: string;

  @ApiPropertyOptional({ example: 'VND', description: 'Fiat currency (default: VND)' })
  @IsOptional()
  @IsString()
  fiatCurrency?: string;

  @ApiPropertyOptional({ example: 'VN', description: 'Country code for exchange (default: VN)' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 'unique-request-id', description: 'Idempotency key' })
  @IsOptional()
  @IsString()
  clientRequestId?: string;
}
