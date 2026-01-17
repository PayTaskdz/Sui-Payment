import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { GaianService } from '../../integrations/gaian/gaian.service';
import { BusinessException } from '../../common/exceptions/business.exception';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private gaianService: GaianService,
  ) {}

  /**
   * UC1: Create Identity
   * Tạo user mới với username unique
   */
  async register(data: { username: string; walletAddress: string; email?: string }) {
    // 1. Check username đã tồn tại chưa
    const existingUser = await this.prisma.user.findUnique({
      where: { username: data.username },
    });

    if (existingUser) {
      throw new BusinessException(
        'Username already taken',
        'USERNAME_TAKEN',
        409,
      );
    }

    // 2. Check wallet đã được sử dụng chưa (UC10: Prevent Duplicate Identity)
    const existingWallet = await this.prisma.user.findFirst({
      where: { walletAddress: data.walletAddress },
    });

    if (existingWallet) {
      throw new BusinessException(
        `This wallet is already registered to username: ${existingWallet.username}`,
        'WALLET_ALREADY_REGISTERED',
        409,
        { existingUsername: existingWallet.username },
      );
    }

    // 3. Register user với Gaian
    let gaianUser;
    try {
      gaianUser = await this.gaianService.registerUser({
        walletAddress: data.walletAddress,
        email: data.email,
      });
    } catch (error) {
      throw new BusinessException(
        'Failed to register with Gaian',
        'GAIAN_REGISTRATION_FAILED',
        500,
        { error: error.message },
      );
    }

    // 4. Tạo user và onchain wallet trong transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Tạo user
      const user = await tx.user.create({
        data: {
          username: data.username,
          walletAddress: data.walletAddress,
          email: data.email,
          gaianUserId: gaianUser.user?.id ? String(gaianUser.user.id) : null,
          kycStatus: 'not started',
          isActive: true,
        },
      });

      // Tự động tạo onchain wallet từ walletAddress đã đăng ký
      const onchainWallet = await tx.onchainWallet.create({
        data: {
          userId: user.id,
          address: data.walletAddress,
          chain: 'Sui', // phải sửa lại sau khi thi hackathon xong - sẽ theo chain của user
          label: `${data.username}'s Wallet`,
          walletProvider: 'connected',
          isDefault: true, // First wallet = default
          isActive: true,
        },
      });

      return { user, onchainWallet };
    });

    return {
      userId: result.user.id,
      username: result.user.username,
      walletAddress: result.user.walletAddress,
      email: result.user.email,
      kycStatus: result.user.kycStatus,
      canTransfer: false, // Chưa KYC thì không transfer được offchain
      defaultWallet: {
        walletId: result.onchainWallet.id,
        address: result.onchainWallet.address,
        chain: result.onchainWallet.chain,
        isDefault: true,
      },
      createdAt: result.user.createdAt,
    };
  }

  /**
   * UC8: Restore Identity
   * User connect wallet đã tồn tại → khôi phục identity
   */
  async restore(walletAddress: string) {
    const user = await this.prisma.user.findFirst({
      where: { walletAddress },
      include: {
        onchainWallets: {
          where: { isActive: true },
        },
        offchainWallets: {
          where: { isActive: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('No account found for this wallet address');
    }

    return {
      userId: user.id,
      username: user.username,
      walletAddress: user.walletAddress,
      email: user.email,
      kycStatus: user.kycStatus,
      canTransfer: user.kycStatus === 'approved',
      onchainWallets: user.onchainWallets,
      offchainWallets: user.offchainWallets,
      createdAt: user.createdAt,
    };
  }

  /**
   * UC9: Onboarding Entrypoint
   * Luôn attempt restore trước, chỉ create identity khi restore thất bại
   */
  async onboarding(data: { username: string; walletAddress: string; email?: string }) {
    // 1. Attempt restore first
    try {
      const restoredUser = await this.restore(data.walletAddress);
      return {
        action: 'restored',
        ...restoredUser,
      };
    } catch (error) {
      // Restore failed, proceed to register
      if (error instanceof NotFoundException) {
        const newUser = await this.register(data);
        return {
          action: 'registered',
          ...newUser,
        };
      }
      throw error;
    }
  }

  /**
   * Check username availability
   */
  async checkUsername(username: string) {
    const existingUser = await this.prisma.user.findUnique({
      where: { username },
    });

    return {
      username,
      available: !existingUser,
    };
  }
}
