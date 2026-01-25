import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SuiRpcService } from '../../../sui/sui-rpc.service';
import { BusinessException } from '../../../common/business.exception';

@Injectable()
export class OnchainService {
  constructor(
    private prisma: PrismaService,
    private suiRpcService: SuiRpcService,
  ) { }

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

    // 4. Create wallet (NOT auto-set as default - user must explicitly set receive wallet)
    const wallet = await this.prisma.onchainWallet.create({
      data: {
        userId,
        address: data.address,
        chain: data.chain,
        label: data.label || `${data.chain} Wallet`,
        walletProvider: data.walletProvider,
        isDefault: false, // NOT default - user must use setDefaultWallet API
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
   * Get wallet by ID (must belong to user)
   */
  async getWallet(userId: string, walletId: string) {
    const wallet = await this.prisma.onchainWallet.findFirst({
      where: { id: walletId, userId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return wallet;
  }

  /**
   * Query balance from blockchain RPC
   */
  async getBalance(userId: string, walletId: string) {
    const wallet = await this.getWallet(userId, walletId);

    // For now, only SUI is implemented
    if (wallet.chain.toLowerCase() === 'sui') {
      try {
        const balance = await this.suiRpcService.getBalance(wallet.address);
        return {
          walletId: wallet.id,
          address: wallet.address,
          chain: wallet.chain,
          balance,
          currency: 'SUI',
        };
      } catch (error: any) {
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
   * Update wallet label (must belong to user)
   */
  async updateWallet(userId: string, walletId: string, data: { label?: string }) {
    await this.getWallet(userId, walletId);

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
   * Delete Wallet (Hard Delete) (must belong to user)
   */
  async deleteWallet(userId: string, walletId: string) {
    const wallet = await this.getWallet(userId, walletId);

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
