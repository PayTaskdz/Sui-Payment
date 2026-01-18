import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private configService: NestConfigService) { }

  get databaseUrl(): string {
    return this.configService.get<string>('DATABASE_URL') ?? '';
  }

  get gaianApiKey(): string {
    return this.configService.get<string>('GAIAN_API_KEY') ?? '';
  }

  get gaianQrApiKey(): string {
    return this.configService.get<string>('GAIAN_QR_API_KEY') ?? '';
  }

  get gaianUserBaseUrl(): string {
    return this.configService.get<string>('GAIAN_USER_BASE_URL') ?? '';
  }

  get gaianPaymentBaseUrl(): string {
    return this.configService.get<string>('GAIAN_PAYMENT_BASE_URL') ?? '';
  }

  get gaianQrBaseUrl(): string {
    return this.configService.get<string>('GAIAN_QR_BASE_URL') ?? '';
  }

  get jwtSecret(): string {
    return this.configService.get<string>('JWT_SECRET') ?? '';
  }

  get referralCommissionRate(): number {
    return this.configService.get<number>('REFERRAL_COMMISSION_RATE') ?? 0.15;
  }

  get port(): number {
    return this.configService.get<number>('PORT') ?? 3000;
  }
}
