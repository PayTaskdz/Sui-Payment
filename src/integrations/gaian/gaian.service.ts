import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AppConfigService } from '../../config/config.service';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class GaianService {
  private readonly userBaseUrl: string;
  private readonly paymentBaseUrl: string;
  private readonly apiKey: string;

  constructor(
    private httpService: HttpService,
    private config: AppConfigService,
  ) {
    this.userBaseUrl = this.config.gaianUserBaseUrl;
    this.paymentBaseUrl = this.config.gaianPaymentBaseUrl;
    this.apiKey = this.config.gaianApiKey;
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
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.paymentBaseUrl}/api/v1/payment/parseQr`,
          { qrString },
          { headers: this.getHeaders() }
        )
      );
      return response.data;
    } catch (error: any) {
      throw new Error(`Gaian parseQr failed: ${error.response?.data?.message || error.message}`);
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
