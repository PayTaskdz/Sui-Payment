import { IsString, IsOptional } from 'class-validator';

export class AddOnchainWalletDto {
  @IsString()
  address: string;

  @IsString()
  chain: string; // "Sui", "Ethereum", "Bitcoin", etc.

  @IsString()
  @IsOptional()
  label?: string;

  @IsString()
  @IsOptional()
  walletProvider?: string; // "sui_wallet", "metamask", "phantom", etc.

  @IsString()
  @IsOptional()
  publicKey?: string;
}
