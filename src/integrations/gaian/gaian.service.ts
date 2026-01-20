import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AppConfigService } from '../../config/config.service';
import { firstValueFrom } from 'rxjs';

export interface GaianQrResponse {
  success: boolean;
  qrInfo?: {
    isValid: boolean;
    bankBin: string;
    accountNumber: string;
    beneficiaryName: string;
    amount?: number;
    memo?: string;
  };
  error?: string;
}

@Injectable()
export class GaianService {
  private readonly userBaseUrl: string;
  private readonly paymentBaseUrl: string;
  private readonly apiKey: string;
  // Bank BIN to Bank Name mapping (common Vietnamese banks)
  private static readonly BANK_BIN_MAP: Record<string, string> = {
    '970436': 'Vietcombank',
    '970418': 'BIDV',
    '970407': 'Techcombank',
    '970422': 'MB Bank',
    '970415': 'VietinBank',
    '970405': 'Agribank',
    '970416': 'ACB',
    '970432': 'VPBank',
    '970423': 'TPBank',
    '970403': 'Sacombank',
    '970414': 'OCB',
    '970448': 'SHB',
    '970406': 'HDBank',
    '970429': 'SCB',
    '970431': 'Eximbank',
    '970443': 'VIB',
    '970454': 'VietABank',
    '970439': 'PVcomBank',
    '970426': 'MSB',
    '970441': 'VRB',
    '970458': 'UOB',
    '970452': 'KienlongBank',
    '970449': 'LienVietPostBank',
    '970427': 'VietBank',
    '970400': 'SaigonBank',
    '970433': 'ABBANK',
    '970409': 'BacABank',
    '970428': 'NAB',
    '970434': 'Indovina',
    '970438': 'BaoVietBank',
    '970440': 'SeABank',
    '970437': 'NCBBANK',
    '970425': 'AnBinhBank',
    '970456': 'IBK',
    '970462': 'Woori',
    '970457': 'Shinhan',
    '970455': 'CIMB',
    '970424': 'SCBVL',
    '970430': 'GPBank',
    '970419': 'NHBank',
};
  constructor(
    private httpService: HttpService,
    private config: AppConfigService,
  ) {
    this.userBaseUrl = this.config.gaianUserBaseUrl;
    this.paymentBaseUrl = this.config.gaianPaymentBaseUrl;
    this.apiKey = this.config.gaianApiKey;
  }

  private static getBankNameFromBin(bankBin: string): string {
    return GaianService.BANK_BIN_MAP[bankBin] || 'Unknown Bank';
  }

  private getHeaders() {
    return {
      'x-api-key': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  async registerUser(data: { walletAddress: string; email?: string }) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.userBaseUrl}/api/v1/user/register`,
          data,
          { headers: this.getHeaders() }
        )
      );
      return response.data;
    } catch (error: any) {
      throw new Error(`Gaian registerUser failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async getUserInfo(walletAddress: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.userBaseUrl}/api/v1/users?walletAddress=${walletAddress}`,
          { headers: this.getHeaders() }
        )
      );
      return response.data;
    } catch (error: any) {
      throw new Error(`Gaian getUserInfo failed: ${error.response?.data?.message || error.message}`);
    }
  }
  
  async getKycLink(walletAddress: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.userBaseUrl}/api/v1/kyc/link`,
          { walletAddress },
          { headers: this.getHeaders() }
        )
      );
      return response.data;
    } catch (error: any) {
      throw new Error(`Gaian getKycLink failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async parseQr(qrString: string) {
    try {
        const response = await fetch(`${this.paymentBaseUrl}/api/v1/parseQr`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
            },
            body: JSON.stringify({
                qrString: qrString,
                country: 'VN',
            }),
        });

        if (!response.ok) {
            return null;
        }

        const data: GaianQrResponse = await response.json();

        if (!data.success || !data.qrInfo || !data.qrInfo.isValid) {
            return null;
        }
        
        const { bankBin, accountNumber, beneficiaryName, amount, memo } = data.qrInfo;

        if (!bankBin || !accountNumber) {
            return null;
        }

        return {
            bankBin,
            bankName: GaianService.getBankNameFromBin(bankBin),
            accountNumber,
            beneficiaryName: beneficiaryName || 'Unknown',
            amount: amount ? Number(amount) : undefined,
            memo,
        };
    } catch {
        return null;
    }
  }

  async placeOrder(data: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.paymentBaseUrl}/api/v1/orders`,
          data,
          { headers: this.getHeaders() }
        )
      );
      return response.data;
    } catch (error: any) {
      throw new Error(`Gaian placeOrder failed: ${error.response?.data?.message || error.message}`);
    }
  }
}
