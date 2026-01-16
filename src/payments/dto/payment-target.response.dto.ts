import { ApiProperty } from '@nestjs/swagger';

export class PaymentTargetResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  username: string;

  @ApiProperty()
  fiatCurrency: string;

  @ApiProperty({ required: false, nullable: true })
  displayName: string | null;

  @ApiProperty({ required: false, nullable: true })
  country: string | null;
}

