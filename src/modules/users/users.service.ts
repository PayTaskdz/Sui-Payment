import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { AppConfigService } from '../../config/config.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private config: AppConfigService,
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
   * UC7: Change Username
   * Rate limit: 3 changes per 30 days
   * NOTE: Rate limiting logic can be added later with Redis or DB tracking
   */
  async changeUsername(userId: string, newUsername: string) {
    // 1. Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 2. Check if new username is already taken
    const existingUser = await this.prisma.user.findUnique({
      where: { username: newUsername },
    });

    if (existingUser) {
      throw new BusinessException(
        'Username already taken',
        'USERNAME_TAKEN',
        409,
      );
    }

    // 3. TODO: Check rate limit (3 changes per 30 days)
    // This can be implemented later with a separate table tracking username changes
    // For now, we'll allow the change

    // 4. Update username
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { username: newUsername },
    });

    return {
      userId: updatedUser.id,
      username: updatedUser.username,
      message: 'Username changed successfully',
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
   * Calculate rewards for a completed order
   * - F1 (user who made transaction): Earns loyalty points
   * - F0 (referrer): Earns commission from F1's transaction fees
   */
  async calculateRewards(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) return;

    // Lookup user by username
    const user = await this.prisma.user.findFirst({
      where: { username: order.username },
      include: { referrer: true },
    });

    if (!user) return;

    // --- A. TÍNH POINT (F1) ---
    // Rule: Có GaianID + Currency VN + Giá trị > 50$ (đổi từ raw)
    const usdcValue = Number(order.expectedCryptoAmountRaw || '0') / 1_000_000;

    if (order.gaianOrderId && order.fiatCurrency === 'VN' && usdcValue > 50) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { loyaltyPoints: { increment: usdcValue } }
      });
    }

    // --- B. TÍNH COMMISSION (F0) ---
    // Rule: 15% của Fee thu được (configurable via REFERRAL_COMMISSION_RATE)
    if (user.referrer) {
      const feeCollected = Number(order.hiddenWalletFeeAmount || 0);
      const commission = feeCollected * this.config.referralCommissionRate;

      if (commission > 0) {
        await this.prisma.user.update({
          where: { id: user.referrer.id },
          data: { commissionBalance: { increment: commission } }
        });
      }
    }
  }
}
