import { IsString, IsEnum } from 'class-validator';

export class SetDefaultWalletDto {
  @IsString()
  walletId: string;

  @IsEnum(['onchain', 'offchain'])
  walletType: 'onchain' | 'offchain';
}
