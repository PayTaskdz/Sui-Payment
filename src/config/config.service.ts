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

  get gaianQrApiKey(): string {
    return this.configService.get<string>('GAIAN_QR_API_KEY') ?? '';
  }

  get gaianUserBaseUrl(): string {
    return this.configService.get<string>("GAIAN_USER_BASE_URL") ?? "";
  }

  get gaianPaymentBaseUrl(): string {
    return this.configService.get<string>("GAIAN_PAYMENT_BASE_URL") ?? "";
  }

  get gaianQrBaseUrl(): string {
    return this.configService.get<string>('GAIAN_QR_BASE_URL') ?? '';
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

  // Tier thresholds (points needed to reach each tier)
  get TIER_PLUS_THRESHOLD(): number {
    return this.configService.get<number>('TIER_PLUS_THRESHOLD', 300);
  }

  get TIER_PREMIUM_THRESHOLD(): number {
    return this.configService.get<number>('TIER_PREMIUM_THRESHOLD', 700);
  }

  get TIER_ELITE_THRESHOLD(): number {
    return this.configService.get<number>('TIER_ELITE_THRESHOLD', 1150);
  }

  // Commission rates for each tier
  get TIER_STANDARD_COMMISSION(): number {
    return this.configService.get<number>('TIER_STANDARD_COMMISSION', 0.15); // 15%
  }

  get TIER_PLUS_COMMISSION(): number {
    return this.configService.get<number>('TIER_PLUS_COMMISSION', 0.30); // 30%
  }

  get TIER_PREMIUM_COMMISSION(): number {
    return this.configService.get<number>('TIER_PREMIUM_COMMISSION', 0.45); // 45%
  }

  get TIER_ELITE_COMMISSION(): number {
    return this.configService.get<number>('TIER_ELITE_COMMISSION', 0.60); // 60%
  }

  // Points rewards for transaction volume
  get POINTS_OVER_50_USD(): number {
    return this.configService.get<number>('POINTS_OVER_50_USD', 10);
  }

  // Points rewards for transaction frequency
  get POINTS_DAILY_3_TX(): number {
    return this.configService.get<number>('POINTS_DAILY_3_TX', 50);
  }

  get POINTS_WEEKLY_15_TX(): number {
    return this.configService.get<number>('POINTS_WEEKLY_15_TX', 100);
  }

  get POINTS_MONTHLY_50_TX(): number {
    return this.configService.get<number>('POINTS_MONTHLY_50_TX', 300);
  }

  // Referral rewards
  get POINTS_REFERRAL_BONUS(): number {
    return this.configService.get<number>('POINTS_REFERRAL_BONUS', 50);
  }

  get MAX_REFERRAL_POINTS_PER_PERIOD(): number {
    return this.configService.get<number>('MAX_REFERRAL_POINTS_PER_PERIOD', 500);
  }
}