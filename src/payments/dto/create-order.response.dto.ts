import { ApiProperty } from '@nestjs/swagger';

class PaymentInstructionDto {
  @ApiProperty()
  toAddress: string;

  @ApiProperty()
  coinType: string;

  @ApiProperty()
  amountRaw: string;
}

class PayoutDto {
  @ApiProperty()
  username: string;

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

  @ApiProperty({ type: PaymentInstructionDto })
  paymentInstruction: PaymentInstructionDto;

  @ApiProperty({ type: PayoutDto })
  payout: PayoutDto;
}

