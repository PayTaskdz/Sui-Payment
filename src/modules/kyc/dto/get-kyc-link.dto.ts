import { IsString } from 'class-validator';

export class GetKycLinkDto {
  @IsString()
  walletAddress: string;
}
