import { Injectable } from "@nestjs/common";
import { ConfigService as NestConfigService } from "@nestjs/config";

@Injectable()
export class AppConfigService {
  constructor(private configService: NestConfigService) {}

  get databaseUrl(): string {
    return this.configService.get<string>("DATABASE_URL") ?? "";
  }

  get gaianApiKey(): string {
    return this.configService.get<string>("GAIAN_API_KEY") ?? "";
  }

  get gaianUserBaseUrl(): string {
    return this.configService.get<string>("GAIAN_USER_BASE_URL") ?? "";
  }

  get gaianPaymentBaseUrl(): string {
    return this.configService.get<string>("GAIAN_PAYMENT_BASE_URL") ?? "";
  }

  get jwtSecret(): string {
    return this.configService.get<string>("JWT_SECRET") ?? "";
  }

  get referralCommissionRate(): number {
    return this.configService.get<number>("REFERRAL_COMMISSION_RATE") ?? 0.15;
  }

  // --- REFERRAL REWARD CONFIGS ---
  get referralKycBonus(): number {
    return this.configService.get<number>("REFERRAL_KYC_BONUS") ?? 50;
  }

  get referralF1CompletionBonus(): number {
    return this.configService.get<number>("REFERRAL_F1_COMPLETION_BONUS") ?? 50;
  }

  get referralFeeDiscountRate(): number {
    return this.configService.get<number>("REFERRAL_FEE_DISCOUNT_RATE") ?? 0.5;
  }

  get referralFeeDiscountMaxUses(): number {
    return (
      this.configService.get<number>("REFERRAL_FEE_DISCOUNT_MAX_USES") ?? 10
    );
  }

  get referralPointsLimitPerPeriod(): number {
    return (
      this.configService.get<number>("REFERRAL_POINTS_LIMIT_PER_PERIOD") ?? 500
    );
  }

  get referralPeriodMonths(): number {
    return this.configService.get<number>("REFERRAL_PERIOD_MONTHS") ?? 6;
  }

  get referralOffchainTxRequired(): number {
    return this.configService.get<number>("REFERRAL_OFFCHAIN_TX_REQUIRED") ?? 3;
  }

  get port(): number {
    return this.configService.get<number>("PORT") ?? 3000;
  }
}
