import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/business.exception';

@Injectable()
export class PaymentMethodsService {
  constructor(private prisma: PrismaService) {}

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }

  /**
   * UC5: Set Default Wallet
   * Only 1 default wallet globally (across onchain + offchain)
   */
  async setDefaultWallet(userId: string, walletId: string, walletType: 'onchain' | 'offchain') {
    if (!this.isUuid(userId)) {
      throw new BadRequestException('Invalid userId format');
    }

    if (!this.isUuid(walletId)) {
      throw new BadRequestException('Invalid walletId format');
    }

    // 1. Validate wallet exists and belongs to user
    let wallet: any;

    if (walletType === 'onchain') {
      wallet = await this.prisma.onchainWallet.findFirst({
        where: { id: walletId, userId },
      });
    } else {
      wallet = await this.prisma.offchainWallet.findFirst({
        where: { id: walletId, userId },
      });
    }

    if (!wallet) {
      throw new NotFoundException('Wallet not found or does not belong to user');
    }

    // 2. Check wallet is active
    if (!wallet.isActive) {
      throw new BusinessException(
        'Cannot set inactive wallet as default',
        'WALLET_INACTIVE',
        400,
      );
    }

    // 3. Transaction: Unset all defaults → Set new default
    await this.prisma.$transaction(async (tx) => {
      // Unset all onchain wallets
      await tx.onchainWallet.updateMany({
        where: { userId },
        data: { isDefault: false },
      });

      // Unset all offchain wallets
      await tx.offchainWallet.updateMany({
        where: { userId },
        data: { isDefault: false },
      });

      // Set new default
      if (walletType === 'onchain') {
        await tx.onchainWallet.update({
          where: { id: walletId },
          data: { isDefault: true },
        });
      } else {
        await tx.offchainWallet.update({
          where: { id: walletId },
          data: { isDefault: true },
        });
      }
    });

    return {
      walletId,
      walletType,
      isDefault: true,
      message: 'Default wallet set successfully',
    };
  }

  /**
   * Get current default wallet
   */
  async getDefaultWallet(userId: string) {
    // Check onchain wallets
    const onchainDefault = await this.prisma.onchainWallet.findFirst({
      where: { userId, isDefault: true, isActive: true },
    });

    if (onchainDefault) {
      return {
        walletId: onchainDefault.id,
        walletType: 'onchain',
        address: onchainDefault.address,
        chain: onchainDefault.chain,
        label: onchainDefault.label,
        isDefault: true,
      };
    }

    // Check offchain wallets
    const offchainDefault = await this.prisma.offchainWallet.findFirst({
      where: { userId, isDefault: true, isActive: true },
    });

    if (offchainDefault) {
      return {
        walletId: offchainDefault.id,
        walletType: 'offchain',
        bankName: offchainDefault.bankName,
        accountNumber: offchainDefault.accountNumber,
        accountName: offchainDefault.accountName,
        label: offchainDefault.label,
        isDefault: true,
      };
    }

    // No default wallet found
    return {
      walletId: null,
      walletType: null,
      isDefault: false,
      message: 'No default wallet set',
    };
  }
}
