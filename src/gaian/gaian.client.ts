import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';
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
export class GaianClient {
  private readonly paymentBaseUrl: string;
  private readonly userBaseUrl: string;
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
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.paymentBaseUrl = this.configService.get<string>('GAIAN_PAYMENT_BASE_URL') ?? '';
    this.userBaseUrl = this.configService.get<string>('GAIAN_USER_BASE_URL') ?? '';
    this.apiKey = this.configService.get<string>('GAIAN_API_KEY') ?? '';
  }

  private ensurePaymentConfigured() {
    if (!this.paymentBaseUrl) {
      throw new BadRequestException('GAIAN_PAYMENT_BASE_URL_NOT_CONFIGURED');
    }
    if (!this.apiKey) {
      throw new BadRequestException('GAIAN_API_KEY_NOT_CONFIGURED');
    }
  }

  private ensureUserConfigured() {
    if (!this.userBaseUrl) {
      throw new BadRequestException('GAIAN_USER_BASE_URL_NOT_CONFIGURED');
    }
    if (!this.apiKey) {
      throw new BadRequestException('GAIAN_API_KEY_NOT_CONFIGURED');
    }
  }

  private static getBankNameFromBin(bankBin: string): string {
    return GaianClient.BANK_BIN_MAP[bankBin] || 'Unknown Bank';
  }

  private getHeaders() {
    return {
      'x-api-key': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  private static buildAxiosErrorDebug(err: unknown) {
    const e = err as AxiosError<any>;

    const status = e?.response?.status;
    const statusText = (e as any)?.response?.statusText;
    const data = e?.response?.data;

    const message = e?.message ?? String(err);

    return {
      message,
      status,
      statusText,
      data,
    };
  }

  async registerUser(data: { walletAddress: string; email?: string }) {
    this.ensureUserConfigured();
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.userBaseUrl}/api/v1/user/register`,
          data,
          { headers: this.getHeaders() },
        ),
      );
      return response.data;
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 409) {
        return { status: 'success', message: 'User already registered' };
      }
      throw new BadRequestException({
        message: 'GAIAN_REGISTER_USER_FAILED',
        gaian: GaianClient.buildAxiosErrorDebug(error),
      });
    }
  }

  async getUserInfo(walletAddress: string) {
    this.ensureUserConfigured();
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.userBaseUrl}/api/v1/users?walletAddress=${walletAddress}`,
          { headers: this.getHeaders() },
        ),
      );
      return response.data;
    } catch (err) {
      throw new BadRequestException({
        message: 'GAIAN_GET_USER_INFO_FAILED',
        gaian: GaianClient.buildAxiosErrorDebug(err),
      });
    }
  }

  async getKycLink(walletAddress: string) {
    this.ensureUserConfigured();
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.userBaseUrl}/api/v1/kyc/link`,
          { walletAddress },
          { headers: this.getHeaders() },
        ),
      );
      return response.data;
    } catch (err) {
      throw new BadRequestException({
        message: 'GAIAN_GET_KYC_LINK_FAILED',
        gaian: GaianClient.buildAxiosErrorDebug(err),
      });
    }
  }

  async parseQr(qrString: string) {
    this.ensurePaymentConfigured();
    try {
      const response = await fetch(`${this.paymentBaseUrl}/api/v1/parseQr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({
          qrString,
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
        bankName: GaianClient.getBankNameFromBin(bankBin),
        accountNumber,
        beneficiaryName: beneficiaryName || 'Unknown',
        amount: amount ? Number(amount) : undefined,
        memo,
      };
    } catch {
      return null;
    }
  }

  async calculateExchange(payload: {
    amount: number;
    country: string;
    chain: string;
    token: string;
  }) {
    this.ensurePaymentConfigured();
    const url = `${this.paymentBaseUrl}/api/v1/calculateExchange`;

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, payload, {
          headers: {
            'x-api-key': this.apiKey,
          },
        }),
      );
      return response.data;
    } catch (err) {
      throw new BadRequestException({
        message: 'GAIAN_CALCULATE_EXCHANGE_FAILED',
        gaian: GaianClient.buildAxiosErrorDebug(err),
      });
    }
  }

  async placeOrderPrefund(payload: {
    qrString: string;
    amount: number;
    fiatCurrency: string;
    cryptoCurrency: string;
    fromAddress: string;
    transactionReference?: string;
  }) {
    this.ensurePaymentConfigured();
    const url = `${this.paymentBaseUrl}/api/v1/placeOrder/prefund`;

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, payload, {
          headers: {
            'x-api-key': this.apiKey,
          },
        }),
      );
      return response.data;
    } catch (err) {
      throw new BadRequestException({
        message: 'GAIAN_PLACE_ORDER_PREFUND_FAILED',
        gaian: GaianClient.buildAxiosErrorDebug(err),
      });
    }
  }

  async getStatus(orderId: string) {
    this.ensurePaymentConfigured();
    const url = `${this.paymentBaseUrl}/api/v1/status`;

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            'x-api-key': this.apiKey,
          },
          params: {
            orderId,
          },
        }),
      );
      return response.data;
    } catch (err) {
      throw new BadRequestException({
        message: 'GAIAN_GET_STATUS_FAILED',
        gaian: GaianClient.buildAxiosErrorDebug(err),
      });
    }
  }

  async getUserOrdersByWallet(
    walletAddress: string,
    query?: { page?: number; limit?: number; status?: string },
  ) {
    this.ensureUserConfigured();
    const url = `${this.userBaseUrl}/api/v1/users/wallet/${walletAddress}/orders`;

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            'x-api-key': this.apiKey,
          },
          params: {
            page: query?.page,
            limit: query?.limit,
            status: query?.status,
          },
        }),
      );
      return response.data;
    } catch (err) {
      throw new BadRequestException({
        message: 'GAIAN_GET_USER_ORDERS_FAILED',
        gaian: GaianClient.buildAxiosErrorDebug(err),
      });
    }
  }
}
