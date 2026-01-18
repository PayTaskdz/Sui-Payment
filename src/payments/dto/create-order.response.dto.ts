import { ApiProperty } from '@nestjs/swagger';

class PaymentInstructionDto {
  @ApiProperty()
  toAddress: string;

  @ApiProperty()
  coinType: string;

  @ApiProperty({ description: 'Total USDC amount user must transfer (includes HiddenWallet fee)' })
  totalCrypto: string;

  @ApiProperty({ description: 'Total USDC raw amount user must transfer (includes HiddenWallet fee)' })
  totalCryptoRaw: string;

  @ApiProperty({ description: 'Total payout fiat amount (VND/PHP)' })
  totalPayout: number;
}

class PayoutDto {
  @ApiProperty({ required: false })
  username?: string;

  @ApiProperty()
  fiatCurrency: string;
}

export class CreateOrderResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  exchangeInfo: any;

  @ApiProperty({
    required: false,
    description: 'HiddenWallet markup fee applied on top of payout fiat amount',
  })
  hiddenWallet?: {
    feePercent: string;
    feeRate: number;
    feeAmount: number;
    amountBeforeFee: number;
    amountWithFee: number;
  };

  @ApiProperty({ type: PaymentInstructionDto })
  paymentInstruction: PaymentInstructionDto;

  @ApiProperty({ type: PayoutDto })
  payout: PayoutDto;
}

