import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { BusinessException } from '../../common/business.exception';
import { AppConfigService } from '../../config/config.service';
import { GaianClient } from '../../gaian/gaian.client';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private config: AppConfigService,
    private gaianClient: GaianClient,
  ) { }

  /**
   * Calculate loyalty tier based on points
   */
  calculateLoyaltyTier(points: number): string {
    if (points >= this.config.TIER_ELITE_THRESHOLD) return 'Elite';
    if (points >= this.config.TIER_PREMIUM_THRESHOLD) return 'Premium';
    if (points >= this.config.TIER_PLUS_THRESHOLD) return 'Plus';
    return 'Standard';
  }

  /**
   * Get commission rate based on tier
   */
  getCommissionRateForTier(tier: string): number {
    switch (tier) {
      case 'Elite': return this.config.TIER_ELITE_COMMISSION;
      case 'Premium': return this.config.TIER_PREMIUM_COMMISSION;
      case 'Plus': return this.config.TIER_PLUS_COMMISSION;
      default: return this.config.TIER_STANDARD_COMMISSION;
    }
  }

  /**
   * Calculate points needed to reach next tier
   */
  getPointsToNextTier(currentPoints: number): number | null {
    if (currentPoints >= this.config.TIER_ELITE_THRESHOLD) return null;
    if (currentPoints >= this.config.TIER_PREMIUM_THRESHOLD) {
      return this.config.TIER_ELITE_THRESHOLD - currentPoints;
    }
    if (currentPoints >= this.config.TIER_PLUS_THRESHOLD) {
      return this.config.TIER_PREMIUM_THRESHOLD - currentPoints;
    }
    return this.config.TIER_PLUS_THRESHOLD - currentPoints;
  }

  /**
   * Count user's transactions in different time periods
   */
  async getTransactionCounts(username: string) {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [dailyCount, weeklyCount, monthlyCount, totalCount] = await Promise.all([
      this.prisma.order.count({
        where: {
          username,
          status: 'COMPLETED',
          createdAt: { gte: oneDayAgo },
        },
      }),
      this.prisma.order.count({
        where: {
          username,
          status: 'COMPLETED',
          createdAt: { gte: sevenDaysAgo },
        },
      }),
      this.prisma.order.count({
        where: {
          username,
          status: 'COMPLETED',
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      this.prisma.order.count({
        where: {
          username,
          status: 'COMPLETED',
        },
      }),
    ]);

    return { dailyCount, weeklyCount, monthlyCount, totalCount };
  }

  /**
   * Count successful referrals (referees with at least 3 completed transactions)
   */
  async countSuccessfulReferrals(userId: string): Promise<number> {
    const referees = await this.prisma.user.findMany({
      where: { referrerId: userId },
      select: { id: true, username: true },
    });

    let successfulCount = 0;
    for (const referee of referees) {
      const count = await this.prisma.order.count({
        where: {
          username: referee.username,
          status: 'COMPLETED',
        },
      });
      if (count >= 3) successfulCount++;
    }

    return successfulCount;
  }

  /**
   * Calculate rewards for a completed order
   * - Transaction volume points: $50+ → +10 points
   * - Transaction frequency bonuses
   * - Referral bonus: +50 points when referee hits 3rd transaction
   * - Commission for referrer based on their tier
   */
  async calculateRewards(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order || order.status !== 'COMPLETED') return;

    // Lookup user by username
    const user = await this.prisma.user.findFirst({
      where: { username: order.username },
      include: { referrer: true },
    });

    if (!user) return;

    let pointsToAdd = 0;

    // --- 1. TRANSACTION VOLUME POINTS ---
    // $50+ → +10 points
    const usdcValue = Number(order.expectedCryptoAmountRaw || '0') / 1_000_000;
    if (usdcValue >= 50) {
      pointsToAdd += this.config.POINTS_OVER_50_USD;
    }

    // --- 2. TRANSACTION FREQUENCY BONUSES ---
    const counts = await this.getTransactionCounts(user.username || '');
    
    // 3+ transactions/day → +50 points
    if (counts.dailyCount >= 3) {
      pointsToAdd += this.config.POINTS_DAILY_3_TX;
    }
    
    // 15+ transactions/week → +100 points
    if (counts.weeklyCount >= 15) {
      pointsToAdd += this.config.POINTS_WEEKLY_15_TX;
    }
    
    // 50+ transactions/month → +300 points
    if (counts.monthlyCount >= 50) {
      pointsToAdd += this.config.POINTS_MONTHLY_50_TX;
    }

    // Add points to user
    if (pointsToAdd > 0) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { loyaltyPoints: { increment: pointsToAdd } },
      });
    }

    // --- 3. REFERRAL BONUS FOR REFERRER ---
    // When this user (F1/referee) completes their 3rd transaction,
    // grant +50 points to their referrer (F0)
    if (user.referrerId && counts.totalCount === 3) {
      const referrer = await this.prisma.user.findUnique({
        where: { id: user.referrerId },
      });

      if (referrer) {
        // Check if referrer hasn't exceeded 500 points from referrals
        // We estimate this by: successful referrals * 50 points
        const successfulReferrals = await this.countSuccessfulReferrals(user.referrerId);
        const estimatedReferralPoints = successfulReferrals * this.config.POINTS_REFERRAL_BONUS;

        if (estimatedReferralPoints < this.config.MAX_REFERRAL_POINTS_PER_PERIOD) {
          await this.prisma.user.update({
            where: { id: user.referrerId },
            data: { loyaltyPoints: { increment: this.config.POINTS_REFERRAL_BONUS } },
          });
        }
      }
    }

    // --- 4. COMMISSION FOR REFERRER (based on referrer's tier) ---
    // Commission is calculated from platform fee collected (payout fee), converted to "$" using exchangeRate.
    if (user.referrer) {
      const feeFiat = Number((order as any).payoutFeeAmountFiat || 0);
      const exchangeRate = Number(order.exchangeRate || 0);

      if (feeFiat > 0 && exchangeRate > 0) {
        const feeUsd = feeFiat / exchangeRate;

        // Calculate referrer's tier based on their current points
        const referrerTier = this.calculateLoyaltyTier(user.referrer.loyaltyPoints);
        const commissionRate = this.getCommissionRateForTier(referrerTier);
        const commission = feeUsd * commissionRate;

        if (commission > 0) {
          await this.prisma.user.update({
            where: { id: user.referrer.id },
            data: { commissionBalance: { increment: commission } },
          });
        }
      }
    }
  }

  /**
   * Get user profile with wallets and KYC status
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        onchainWallets: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
        },
        offchainWallets: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            referees: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Calculate dynamic tier based on current points
    const tier = this.calculateLoyaltyTier(user.loyaltyPoints);
    const commissionRate = this.getCommissionRateForTier(tier);
    const pointsToNextTier = this.getPointsToNextTier(user.loyaltyPoints);

    // Get transaction counts
    const counts = await this.getTransactionCounts(user.username || '');

    // Find default wallet
    const defaultOnchain = user.onchainWallets.find((w: any) => w.isDefault);
    const defaultOffchain = user.offchainWallets.find((w: any) => w.isDefault);

    // Fetch KYC status from Gaian
    let gaianKycStatus = user.kycStatus; // Fallback to local status
    let canTransfer = user.kycStatus === 'approved';
    
    try {
      const gaianUser = await this.gaianClient.getUserInfo(user.walletAddress);
      
      // Extract KYC status from nested response: gaianUser.user.kyc.status
      if (gaianUser?.user?.kyc?.status) {
        gaianKycStatus = gaianUser.user.kyc.status;
        canTransfer = gaianKycStatus === 'approved';
        
        // Sync approved KYC status to local database
        if (gaianKycStatus === 'approved' && user.kycStatus !== 'approved') {
          await this.prisma.user.update({
            where: { id: user.id },
            data: { 
              kycStatus: gaianKycStatus,
              firstName: gaianUser.user.kyc.firstName || user.firstName,
              lastName: gaianUser.user.kyc.lastName || user.lastName,
            },
          });
        }
      }
    } catch (error) {
      console.error('Error fetching user info from Gaian:', error);
      // Use local status as fallback
    }

    return {
      userId: user.id,
      username: user.username,
      walletAddress: user.walletAddress,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      kycStatus: gaianKycStatus,
      canTransfer: canTransfer,
      isActive: user.isActive,
      
      // Loyalty & Tier Info (calculated dynamically)
      loyaltyTier: tier,
      loyaltyPoints: user.loyaltyPoints,
      pointsToNextTier,
      commissionRate,
      
      // Transaction Info
      completedTransactionsCount: counts.totalCount,
      transactionStats: {
        dailyCount: counts.dailyCount,
        weeklyCount: counts.weeklyCount,
        monthlyCount: counts.monthlyCount,
      },
      
      // Referral Info
      refereesCount: user._count.referees,
      
      // Balances
      commissionBalance: user.commissionBalance,
      
      // Wallets
      defaultWallet: defaultOnchain || defaultOffchain || null,
      onchainWallets: user.onchainWallets,
      offchainWallets: user.offchainWallets.map((wallet: any) => ({
        id: wallet.id,
        bankInfo: {
          bankName: wallet.bankName,
          accountNumber: wallet.accountNumber,
          accountName: wallet.accountName,
          country: wallet.country,
          bankBin: wallet.bankBin,
        },
        isDefault: wallet.isDefault,
        label: wallet.label,
      })),
      
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Update user profile (email, firstName, lastName)
   */
  async updateProfile(userId: string, data: { email?: string; firstName?: string; lastName?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: data.email ?? user.email,
        firstName: data.firstName ?? user.firstName,
        lastName: data.lastName ?? user.lastName,
      },
    });

    return {
      userId: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      updatedAt: updatedUser.updatedAt,
    };
  }

  /**
   * Lookup user by username (for transfers)
   */
  async getUserByUsername(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: {
        onchainWallets: {
          where: { isDefault: true, isActive: true },
        },
        offchainWallets: {
          where: { isDefault: true, isActive: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with username '${username}' not found`);
    }

    // Find default wallet - prioritize onchain, then offchain
    const defaultOnchain = user.onchainWallets[0];
    const defaultOffchain = user.offchainWallets[0];

    let defaultWallet = null;
    if (defaultOnchain) {
      defaultWallet = {
        id: defaultOnchain.id,
        type: 'onchain' as const,
        address: defaultOnchain.address,
        chain: defaultOnchain.chain,
      };
    } else if (defaultOffchain) {
      defaultWallet = {
        id: defaultOffchain.id,
        type: 'offchain' as const,
        bankName: defaultOffchain.bankName,
        accountNumber: defaultOffchain.accountNumber,
        accountName: defaultOffchain.accountName,
        qrString: defaultOffchain.qrString, // Include qrString for payment API
      };
    }

    return {
      userId: user.id,
      username: user.username,
      walletAddress: user.walletAddress,
      kycStatus: user.kycStatus,
      canReceiveTransfer: user.kycStatus === 'approved' || !!defaultOnchain,
      defaultWallet,
    };
  }
  async checkUsernameAvailability(username: string) {
    const clean = (username || '').trim().toLowerCase();

    if (clean.length < 3 || clean.length > 30) {
      return { available: false };
    }

    if (!/^[a-z0-9_]+$/.test(clean)) {
      return { available: false };
    }

    const existing = await this.prisma.user.findUnique({
      where: { username: clean },
      select: { id: true },
    });

    return { available: !existing };
  }

  async completeOnboarding(
    userId: string,
    dto: { username: string; email?: string; referralUsername?: string },
  ) {
    const username = dto.username.trim().toLowerCase();

    if (username.length < 3 || username.length > 30 || !/^[a-z0-9_]+$/.test(username)) {
      throw new BusinessException('Invalid username', 'USERNAME_INVALID', 400);
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const existing = await this.prisma.user.findUnique({ where: { username } });
    if (existing && existing.id !== userId) {
      throw new BusinessException('Username already taken', 'USERNAME_TAKEN', 409);
    }

    let referrerId: string | null = null;
    if (dto.referralUsername) {
      const referralUsername = dto.referralUsername.trim().toLowerCase();
      if (!/^[a-z0-9_]+$/.test(referralUsername)) {
        throw new BusinessException('Invalid referral username', 'REFERRAL_USERNAME_INVALID', 400);
      }

      const referrer = await this.prisma.user.findUnique({ where: { username: referralUsername } });
      if (!referrer) {
        throw new BusinessException('Referrer not found', 'REFERRER_NOT_FOUND', 404);
      }
      if (referrer.id === userId) {
        throw new BusinessException('Cannot refer yourself', 'REFERRER_SELF', 400);
      }
      referrerId = referrer.id;
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        username,
        email: dto.email ?? user.email,
        referrerId: referrerId ?? user.referrerId,
      },
    });

    return {
      userId: updated.id,
      username: updated.username,
      email: updated.email,
      referrerId: updated.referrerId,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Get loyalty stats for user
   */
  async getLoyaltyStats(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const tier = this.calculateLoyaltyTier(user.loyaltyPoints);
    const commissionRate = this.getCommissionRateForTier(tier);
    const pointsToNextTier = this.getPointsToNextTier(user.loyaltyPoints);

    const counts = await this.getTransactionCounts(user.username || '');
    const successfulReferrals = await this.countSuccessfulReferrals(userId);
    const estimatedReferralPoints = successfulReferrals * this.config.POINTS_REFERRAL_BONUS;

    return {
      currentTier: tier,
      loyaltyPoints: user.loyaltyPoints,
      pointsToNextTier,
      commissionRate,
      transactionStats: {
        dailyCount: counts.dailyCount,
        weeklyCount: counts.weeklyCount,
        monthlyCount: counts.monthlyCount,
      },
      referralInfo: {
        successfulReferrals,
        estimatedPointsFromReferrals: estimatedReferralPoints,
        maxReferralPoints: this.config.MAX_REFERRAL_POINTS_PER_PERIOD,
        referralPointsRemaining: this.config.MAX_REFERRAL_POINTS_PER_PERIOD - estimatedReferralPoints,
      },
    };
  }

  /**
   * Get referral info for user
   */
  async getReferralInfo(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        referees: {
          select: {
            id: true,
            username: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const totalReferrals = user.referees.length;

    // Get transaction counts for each referee
    const refereesWithStats = await Promise.all(
      user.referees.map(async (referee) => {
        const count = await this.prisma.order.count({
          where: {
            username: referee.username,
            status: 'COMPLETED',
          },
        });
        return {
          username: referee.username,
          registeredAt: referee.createdAt,
          transactionCount: count,
          bonusGranted: count >= 3, // Bonus granted when referee hits 3 transactions
        };
      })
    );

    const successfulReferrals = refereesWithStats.filter(r => r.bonusGranted).length;
    const estimatedReferralPoints = successfulReferrals * this.config.POINTS_REFERRAL_BONUS;

    return {
      totalReferrals,
      successfulReferrals,
      estimatedPointsFromReferrals: estimatedReferralPoints,
      maxReferralPoints: this.config.MAX_REFERRAL_POINTS_PER_PERIOD,
      referees: refereesWithStats,
    };
  }
}
