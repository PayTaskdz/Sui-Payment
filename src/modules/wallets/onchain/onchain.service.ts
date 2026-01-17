import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { SuiService } from '../../../integrations/blockchain/sui.service';
import { BusinessException } from '../../../common/exceptions/business.exception';

@Injectable()
export class OnchainService {
  constructor(
    private prisma: PrismaService,
    private suiService: SuiService,
  ) {}

  /**
   * UC2: Add Onchain Wallet (Multi-chain, SUI priority)
   * Methods: Connect Wallet, Manual Input, QR Scan
   */
  async addWallet(userId: string, data: {
    address: string;
    chain: string;
    label?: string;
    walletProvider?: string;
    publicKey?: string;
  }) {
    // 1. Check user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 2. Validate address format (basic validation)
    if (!data.address || data.address.length < 10) {
      throw new BadRequestException('Invalid wallet address format');
    }

    // 3. Check uniqueness (UC10: Prevent Duplicate)
    const existingWallet = await this.prisma.onchainWallet.findUnique({
      where: {
        chain_address: {
          chain: data.chain,
          address: data.address,
        },
      },
      include: {
        user: true,
      },
    });

    if (existingWallet) {
      throw new BusinessException(
        `This wallet is already registered to username: ${existingWallet.user.username}`,
        'WALLET_ALREADY_REGISTERED',
        409,
        { existingUsername: existingWallet.user.username },
      );
    }

    // 4. Check if user has any default wallet (onchain or offchain)
    const hasDefaultOnchain = await this.prisma.onchainWallet.findFirst({
      where: { userId, isDefault: true },
    });

    const hasDefaultOffchain = await this.prisma.offchainWallet.findFirst({
      where: { userId, isDefault: true },
    });

    // Only set as default if no other wallet (onchain or offchain) is default
    const shouldBeDefault = !hasDefaultOnchain && !hasDefaultOffchain;

    // 5. Create wallet
    const wallet = await this.prisma.onchainWallet.create({
      data: {
        userId,
        address: data.address,
        chain: data.chain,
        label: data.label || `${data.chain} Wallet`,
        walletProvider: data.walletProvider,
        isDefault: shouldBeDefault, // Auto set default if no other default exists
        isActive: true,
      },
    });

    return {
      walletId: wallet.id,
      address: wallet.address,
      chain: wallet.chain,
      label: wallet.label,
      walletProvider: wallet.walletProvider,
      isDefault: wallet.isDefault,
      isActive: wallet.isActive,
      createdAt: wallet.createdAt,
    };
  }

  /**
   * List user's onchain wallets
   */
  async listWallets(userId: string) {
    const wallets = await this.prisma.onchainWallet.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      total: wallets.length,
      wallets: wallets.map(w => ({
        walletId: w.id,
        address: w.address,
        chain: w.chain,
        label: w.label,
        walletProvider: w.walletProvider,
        isDefault: w.isDefault,
        isActive: w.isActive,
        createdAt: w.createdAt,
      })),
    };
  }

  /**
   * Get wallet by ID
   */
  async getWallet(walletId: string) {
    const wallet = await this.prisma.onchainWallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return wallet;
  }

  /**
   * Query balance from blockchain RPC
   */
  async getBalance(walletId: string) {
    const wallet = await this.getWallet(walletId);

    // For now, only SUI is implemented
    if (wallet.chain.toLowerCase() === 'sui') {
      try {
        const balance = await this.suiService.getBalance(wallet.address);
        return {
          walletId: wallet.id,
          address: wallet.address,
          chain: wallet.chain,
          balance,
          currency: 'SUI',
        };
      } catch (error) {
        throw new BusinessException(
          'Failed to query balance from blockchain',
          'BALANCE_QUERY_FAILED',
          500,
          { error: error.message },
        );
      }
    }

    // Other chains not implemented yet
    return {
      walletId: wallet.id,
      address: wallet.address,
      chain: wallet.chain,
      balance: '0',
      currency: wallet.chain,
      message: `Balance query for ${wallet.chain} not implemented yet`,
    };
  }

  /**
   * Update wallet label
   */
  async updateWallet(walletId: string, data: { label?: string }) {
    const wallet = await this.getWallet(walletId);

    const updated = await this.prisma.onchainWallet.update({
      where: { id: walletId },
      data: { label: data.label },
    });

    return {
      walletId: updated.id,
      label: updated.label,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * UC6: Deactivate Wallet (Soft Lock)
   */
  async deactivateWallet(walletId: string) {
    const wallet = await this.getWallet(walletId);

    // Deactivate wallet
    const updated = await this.prisma.onchainWallet.update({
      where: { id: walletId },
      data: { isActive: false, isDefault: false },
    });

    // If it was default, try to set another wallet as default
    if (wallet.isDefault) {
      const nextWallet = await this.prisma.onchainWallet.findFirst({
        where: {
          userId: wallet.userId,
          isActive: true,
          id: { not: walletId },
        },
      });

      if (nextWallet) {
        await this.prisma.onchainWallet.update({
          where: { id: nextWallet.id },
          data: { isDefault: true },
        });
      }
    }

    return {
      walletId: updated.id,
      isActive: updated.isActive,
      message: 'Wallet deactivated successfully',
    };
  }

  /**
   * Reactivate wallet
   */
  async reactivateWallet(walletId: string) {
    await this.getWallet(walletId);

    const updated = await this.prisma.onchainWallet.update({
      where: { id: walletId },
      data: { isActive: true },
    });

    return {
      walletId: updated.id,
      isActive: updated.isActive,
      message: 'Wallet reactivated successfully',
    };
  }

  /**
   * UC11: Delete Wallet (Hard Delete)
   */
  async deleteWallet(walletId: string) {
    const wallet = await this.getWallet(walletId);

    // Check if it's default wallet
    if (wallet.isDefault) {
      throw new BusinessException(
        'Cannot delete default wallet. Please set another wallet as default first.',
        'CANNOT_DELETE_DEFAULT_WALLET',
        400,
      );
    }

    // Hard delete
    await this.prisma.onchainWallet.delete({
      where: { id: walletId },
    });

    return {
      walletId,
      message: 'Wallet deleted successfully',
    };
  }
}
