import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class GaianClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.baseUrl = this.configService.get<string>('GAIAN_BASE_URL') ?? '';
    this.apiKey = this.configService.get<string>('GAIAN_API_KEY') ?? '';
  }

  private ensureConfigured() {
    if (!this.baseUrl) {
      throw new BadRequestException('GAIAN_BASE_URL_NOT_CONFIGURED');
    }
    if (!this.apiKey) {
      throw new BadRequestException('GAIAN_API_KEY_NOT_CONFIGURED');
    }
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

  async calculateExchange(payload: {
    amount: number;
    country: string;
    chain: string;
    token: string;
  }) {
    this.ensureConfigured();
    const url = `${this.baseUrl}/api/v1/calculateExchange`;

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
    this.ensureConfigured();
    const url = `${this.baseUrl}/api/v1/placeOrder/prefund`;

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
    this.ensureConfigured();
    const url = `${this.baseUrl}/api/v1/status`;

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
    this.ensureConfigured();
    const url = `${this.baseUrl}/api/v1/users/wallet/${walletAddress}/orders`;

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

