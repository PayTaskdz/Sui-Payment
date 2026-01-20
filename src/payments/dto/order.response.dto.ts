import { ApiProperty } from '@nestjs/swagger';
import { PaymentTargetResponseDto } from './payment-target.response.dto';

export class OrderResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  username: string;

  @ApiProperty()
  payerWalletAddress: string;

  @ApiProperty()
  cryptoCurrency: string;

  @ApiProperty()
  coinType: string;

  @ApiProperty()
  expectedCryptoAmountRaw: string;

  @ApiProperty({ required: false, nullable: true })
  userPaymentTxDigest: string | null;

  @ApiProperty({ required: false, nullable: true })
  userPaymentVerifiedAt: Date | null;

  @ApiProperty()
  fiatAmount: string;

  @ApiProperty()
  fiatCurrency: string;

  @ApiProperty({ required: false })
  platformFee?: {
    feePercent: string;
    feeRate: number;
    feeAmount: number;
    baseFiatAmount: number;
    finalFiatAmount: number;
  };

  @ApiProperty({ enum: ['AWAITING_USER_PAYMENT', 'USER_PAYMENT_VERIFIED', 'CONFIRMING_GAIAN_PAYMENT', 'CONFIRMED_GAIAN_PAYMENT', 'COMPLETED', 'FAILED'] })
  status: string;

  @ApiProperty({ enum: ['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED'], nullable: true })
  bankTransferStatus: string | null;

  @ApiProperty({ required: false, nullable: true })
  bankTransactionReference: any | null;

  @ApiProperty({ required: false, nullable: true })
  exchangeRate: string | null;

  @ApiProperty({ required: false, nullable: true })
  gaianOrderId: string | null;

  @ApiProperty({ required: false, nullable: true })
  clientRequestId: string | null;

  @ApiProperty({ required: false })
  paymentTarget?: PaymentTargetResponseDto;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

