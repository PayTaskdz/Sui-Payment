import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { AppConfigService } from '../../config/config.service';
import { GaianService } from '../../integrations/gaian/gaian.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private config: AppConfigService,
    private gaianService: GaianService,
  ) { }

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
    // Call Gaian API for result kyc status
    const gaianResponse = await this.gaianService.getUserInfo(user.walletAddress);
    user.kycStatus = gaianResponse.kycStatus; // Update kyc status from Gaian

    // Find default wallet
    const defaultOnchain = user.onchainWallets.find((w: any) => w.isDefault);
    const defaultOffchain = user.offchainWallets.find((w: any) => w.isDefault);

    return {
      userId: user.id,
      username: user.username,
      walletAddress: user.walletAddress,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      kycStatus: user.kycStatus,
      canTransfer: user.kycStatus === 'approved',
      isActive: user.isActive,
      refereesCount: user._count.referees,
      loyaltyPoints: user.loyaltyPoints,
      commissionBalance: user.commissionBalance,
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

    // Find default wallet
    const defaultWallet = user.onchainWallets[0] || user.offchainWallets[0] || null;

    return {
      userId: user.id,
      username: user.username,
      kycStatus: user.kycStatus,
      canReceiveTransfer: user.kycStatus === 'approved' || !!user.onchainWallets[0], // Onchain không cần KYC
      defaultWallet: defaultWallet ? {
        id: defaultWallet.id,
        type: 'address' in defaultWallet ? 'onchain' : 'offchain',
        address: 'address' in defaultWallet ? defaultWallet.address : null,
        chain: 'chain' in defaultWallet ? defaultWallet.chain : null,
        bankName: 'bankName' in defaultWallet ? defaultWallet.bankName : null,
        accountNumber: 'accountNumber' in defaultWallet ? defaultWallet.accountNumber : null,
      } : null,
    };
  }
  //Referral system
  async onKycApproved(userId: string) {
  // Step 1: Get F1 user
  const user = await this.prisma.user.findUnique({
    where: { id: userId }
  });
  
  if (!user) return { bonusAwarded: false };
  
  // Step 2: Check if F1 has referrer (F0)
  if (!user.referrerId) {
    return { bonusAwarded: false }; // Không có F0
  }
  
  // Step 3: Award KYC bonus to F1 and log to ReferralReward
  const bonusPoints = this.config.referralKycBonus; // 50
  
  await this.prisma.$transaction([
    // Update F1's loyalty points
    this.prisma.user.update({
      where: { id: userId, kycStatus: 'approved' },
      data: {
        loyaltyPoints: { increment: bonusPoints }
      }
    }),
    // Log reward history for 6-month tracking
    this.prisma.referralReward.create({
      data: {
        referrerId: user.referrerId!,
        refereeId: userId,
        points: bonusPoints,
        reason: 'KYC_APPROVED'
      }
    })
  ]);
  
  return {
    bonusAwarded: true,
    points: bonusPoints
  };
}
  //F0 complete 3 transactions first
  async onOrderCompleted(orderId: string) {
  // Step 1: Get order info
  const order = await this.prisma.order.findUnique({
    where: { id: orderId }
  });
  
  if (!order || order.status !== 'COMPLETED') {
    return { referrerBonusAwarded: false };
  }
  
  // Step 2: Get F1 user
  const f1User = await this.prisma.user.findFirst({
    where: { walletAddress: order.payerWalletAddress },
    include: { referrer: true }
  });
  
  if (!f1User || !f1User.referrer) {
    return { referrerBonusAwarded: false }; // F1 không có F0
  }
  
  // Step 3: Count F1's completed offchain orders
  const completedOrders = await this.prisma.order.count({
    where: {
      payerWalletAddress: f1User.walletAddress,
      status: 'COMPLETED'
    }
  });
  
  const requiredTx = this.config.referralOffchainTxRequired; // 3
  
  // Step 4: Check if exactly 3 transactions (chỉ thưởng 1 lần)
  if (completedOrders !== requiredTx) {
    return { referrerBonusAwarded: false };
  }
  
  // Step 5: Check F0's point limit for current period
  const canReceiveBonus = await this.checkReferrerPointsLimit(f1User.referrer.id);
  
  if (!canReceiveBonus) {
    return { 
      referrerBonusAwarded: false, 
      reason: 'F0 đã đạt giới hạn 500 points/6 tháng'
    };
  }
  
  // Step 6: Award bonus to F0 and log to ReferralReward
  const bonusPoints = this.config.referralF1CompletionBonus; // 50
  
  await this.prisma.$transaction([
    // Update F0's loyalty points
    this.prisma.user.update({
      where: { id: f1User.referrer.id },
      data: {
        loyaltyPoints: { increment: bonusPoints }
      }
    }),
    // Log reward history for 6-month tracking
    this.prisma.referralReward.create({
      data: {
        referrerId: f1User.referrer.id,
        refereeId: f1User.id,
        points: bonusPoints,
        reason: 'F1_COMPLETED_3_TX'
      }
    })
  ]);
  
  return {
    referrerBonusAwarded: true,
    referrerPoints: bonusPoints,
    referrerId: f1User.referrer.id
  };
}

  /**
   * Check if referrer (F0) can receive more bonus points
   * Limit: 500 points per 6 months
   */
  private async checkReferrerPointsLimit(referrerId: string): Promise<boolean> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Sum all bonus points received in the last 6 months
    const totalPoints = await this.prisma.referralReward.aggregate({
      where: {
        referrerId: referrerId,
        createdAt: {
          gte: sixMonthsAgo
        }
      },
      _sum: {
        points: true
      }
    });

    const currentTotal = totalPoints._sum.points || 0;
    const limit = this.config.referralPointsLimitPerPeriod; // 500

    return currentTotal < limit;
  }

  /**
   * Get referral statistics for a user
   * Shows both F0 rewards (as referrer) and F1 rewards (as referee)
   */
  async getReferralStats(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        referrer: {
          select: {
            id: true,
            username: true
          }
        },
        _count: {
          select: {
            referees: true
          }
        }
      }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Get F0 rewards (rewards I received from my F1 referrals)
    const f0Rewards = await this.prisma.referralReward.aggregate({
      where: {
        referrerId: userId,
        createdAt: {
          gte: sixMonthsAgo
        }
      },
      _sum: {
        points: true
      },
      _count: true
    });

    // Get F1 rewards (rewards I received as a referee)
    const f1Rewards = await this.prisma.referralReward.aggregate({
      where: {
        refereeId: userId,
        createdAt: {
          gte: sixMonthsAgo
        }
      },
      _sum: {
        points: true
      },
      _count: true
    });

    const f0PointsEarned = f0Rewards._sum.points || 0;
    const f0PointsLimit = this.config.referralPointsLimitPerPeriod; // 500
    const f0PointsRemaining = Math.max(0, f0PointsLimit - f0PointsEarned);

    return {
      userId: user.id,
      username: user.username,
      
      // User's role in referral system
      referralRole: {
        isF0: user._count.referees > 0, // Has referred others
        isF1: !!user.referrerId, // Was referred by someone
        referrer: user.referrer || null
      },

      // Current balances
      currentBalances: {
        loyaltyPoints: user.loyaltyPoints,
        commissionBalance: user.commissionBalance
      },

      // F0 stats (as a referrer)
      asReferrer: {
        totalReferees: user._count.referees,
        pointsEarned6Months: f0PointsEarned,
        pointsLimit6Months: f0PointsLimit,
        pointsRemaining: f0PointsRemaining,
        rewardCount6Months: f0Rewards._count
      },

      // F1 stats (as a referee)
      asReferee: {
        pointsEarned6Months: f1Rewards._sum.points || 0,
        rewardCount6Months: f1Rewards._count
      },

      // Config values for reference
      config: {
        kycBonus: this.config.referralKycBonus,
        f1CompletionBonus: this.config.referralF1CompletionBonus,
        requiredOffchainTx: this.config.referralOffchainTxRequired
      }
    };
  }

  /**
   * Get referral reward history for a user
   * Shows both rewards received (as F0) and rewards earned (as F1)
   */
  async getReferralHistory(userId: string, limit = 50) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Rewards where user is the referrer (F0)
    const asReferrer = await this.prisma.referralReward.findMany({
      where: { referrerId: userId },
      include: {
        referee: {
          select: {
            id: true,
            username: true,
            walletAddress: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    // Rewards where user is the referee (F1)
    const asReferee = await this.prisma.referralReward.findMany({
      where: { refereeId: userId },
      include: {
        referrer: {
          select: {
            id: true,
            username: true,
            walletAddress: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return {
      userId: user.id,
      username: user.username,
      
      // Rewards I received from my F1 referrals
      rewardsAsReferrer: asReferrer.map(reward => ({
        id: reward.id,
        points: reward.points,
        reason: reward.reason,
        reasonText: this.getReasonText(reward.reason),
        referee: {
          id: reward.refereeId,
          username: reward.referee?.username,
          walletAddress: reward.referee?.walletAddress
        },
        createdAt: reward.createdAt
      })),

      // Rewards I received as a referee
      rewardsAsReferee: asReferee.map(reward => ({
        id: reward.id,
        points: reward.points,
        reason: reward.reason,
        reasonText: this.getReasonText(reward.reason),
        referrer: {
          id: reward.referrerId,
          username: reward.referrer?.username,
          walletAddress: reward.referrer?.walletAddress
        },
        createdAt: reward.createdAt
      })),

      summary: {
        totalRewardsAsReferrer: asReferrer.length,
        totalPointsAsReferrer: asReferrer.reduce((sum, r) => sum + r.points, 0),
        totalRewardsAsReferee: asReferee.length,
        totalPointsAsReferee: asReferee.reduce((sum, r) => sum + r.points, 0)
      }
    };
  }

  /**
   * Helper to convert reason code to human-readable text
   */
  private getReasonText(reason: string): string {
    const reasonMap: Record<string, string> = {
      'KYC_APPROVED': 'KYC approved bonus',
      'F1_COMPLETED_3_TX': 'F1 completed 3 transactions bonus'
    };
    return reasonMap[reason] || reason;
  }
}