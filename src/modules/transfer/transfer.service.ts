import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GaianClient } from '../../gaian/gaian.client';
import { SuiRpcService } from '../../sui/sui-rpc.service';
import { BusinessException } from '../../common/business.exception';

@Injectable()
export class TransferService {
  constructor(
    private prisma: PrismaService,
    private gaianClient: GaianClient,
    private suiRpcService: SuiRpcService,
  ) {}

  /**
   * Smart QR Scanner - Auto detects PayPath username, onchain address, or offchain bank QR
   */
  async scanQr(qrString: string, userId: string) {
    // 1. Check if it's a PayPath username QR (internal user)
    if (this.isPayPathQr(qrString)) {
      const username = this.extractPayPathUsername(qrString);
      return this.handleUsernameQr(username);
    }

    // 2. Check if it's a raw wallet address (onchain)
    if (this.isWalletAddress(qrString)) {
      return this.handleOnchainQr(qrString);
    }

    // 3. Otherwise, try parsing as bank QR (offchain)
    return this.handleOffchainQr(qrString);
  }

  /**
   * Check if QR is PayPath username format
   * Format examples: "paypath://username" or "@username" or custom format
   */
  private isPayPathQr(qrString: string): boolean {
    // PayPath username QR patterns
    return (
      qrString.startsWith('paypath://') ||
      qrString.startsWith('hiddenpay://') ||
      (qrString.startsWith('@') && qrString.length > 1 && qrString.length < 50)
    );
  }

  /**
   * Extract username from PayPath QR
   */
  private extractPayPathUsername(qrString: string): string {
    let username = qrString.trim();

    if (username.toLowerCase().startsWith('paypath:')) {
        username = username.substring(8);
    }

    if (username.startsWith('@')) {
        username = username.substring(1);
    }

    return username.toLowerCase();
  }

  /**
   * Check if string is a valid wallet address
   */
  private isWalletAddress(qrString: string): boolean {
    // Hex addresses (Sui, Ethereum, Polygon): 0x + 40+ hex chars
    const hexPattern = /^0x[a-fA-F0-9]{40,}$/;
    // Base58 addresses (Solana, Bitcoin): 32+ chars
    const base58Pattern = /^[1-9A-HJ-NP-Za-km-z]{32,}$/;
    return hexPattern.test(qrString) || base58Pattern.test(qrString);
  }

  /**
   * Handle PayPath username QR (internal user lookup)
   */
  private async handleUsernameQr(username: string) {
    // Lookup user in database
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
      throw new BusinessException(
        `User @${username} not found`,
        'USER_NOT_FOUND',
        404,
        { username },
      );
    }

    // Check if user has a linked wallet
    const defaultOnchain = user.onchainWallets[0];
    const defaultOffchain = user.offchainWallets[0];

    if (!defaultOnchain && !defaultOffchain) {
      throw new BusinessException(
        `User @${username} has no linked wallet`,
        'NO_WALLET_LINKED',
        400,
        { username },
      );
    }

    const defaultWallet = defaultOnchain
      ? {
          type: 'onchain',
          address: defaultOnchain.address,
          chain: defaultOnchain.chain,
        }
      : {
          type: 'offchain',
          bankName: defaultOffchain.bankName,
          accountNumber: defaultOffchain.accountNumber,
          accountName: defaultOffchain.accountName,
        };

    return {
      type: 'username',
      username: user.username,
      displayName: `@${user.username}`,
      user: {
        username: user.username,
        kycStatus: user.kycStatus,
        defaultWallet,
      },
    };
  }

  /**
   * Handle onchain wallet address QR
   */
  private async handleOnchainQr(address: string) {
    // 1. Validate address format (for Sui)
    const isValid = await this.suiRpcService.validateAddress(address);
    if (!isValid) {
      throw new BusinessException(
        'Invalid wallet address format',
        'INVALID_ADDRESS',
        400,
        { address },
      );
    }

    // 2. Check if address exists in database
    const wallet = await this.prisma.onchainWallet.findFirst({
      where: {
        address,
        isActive: true,
      },
      include: {
        user: {
          include: {
            onchainWallets: {
              where: { isDefault: true, isActive: true },
            },
            offchainWallets: {
              where: { isDefault: true, isActive: true },
            },
          },
        },
      },
    });

    // 3. Format response
    if (!wallet) {
      // Address not registered
      return {
        type: 'onchain',
        address,
        chain: 'Sui', // Default assumption
        user: null,
      };
    }

    // Address is registered - return user info with default wallet
    const defaultOnchain = wallet.user.onchainWallets[0];
    const defaultOffchain = wallet.user.offchainWallets[0];

    const defaultWallet = defaultOnchain
      ? {
          type: 'onchain',
          address: defaultOnchain.address,
          chain: defaultOnchain.chain,
        }
      : defaultOffchain
      ? {
          type: 'offchain',
          bankName: defaultOffchain.bankName,
          accountNumber: defaultOffchain.accountNumber,
          accountName: defaultOffchain.accountName,
        }
      : null;

    return {
      type: 'onchain',
      address: wallet.address,
      chain: wallet.chain,
      user: {
        username: wallet.user.username,
        defaultWallet,
      },
    };
  }

  /**
   * Handle offchain bank QR (VietQR)
   */
  private async handleOffchainQr(qrString: string) {
    // 1. Parse QR via Gaian
    const parsedBank = await this.gaianClient.parseQr(qrString, 'VN');
    
    if (!parsedBank) {
      throw new BusinessException(
        'Invalid QR code',
        'INVALID_QR',
        400,
      );
    }

    // 2. Check if bank account exists in database
    const bank = await this.prisma.offchainWallet.findFirst({
      where: {
        country: 'VN',
        bankBin: parsedBank.bankBin,
        accountNumber: parsedBank.accountNumber,
        isActive: true,
      },
      include: {
        user: {
          include: {
            onchainWallets: {
              where: { isDefault: true, isActive: true },
            },
            offchainWallets: {
              where: { isDefault: true, isActive: true },
            },
          },
        },
      },
    });

    // 3. Format bank info from parsed data
    const bankInfo = {
      bankName: parsedBank.bankName,
      accountNumber: parsedBank.accountNumber,
      accountName: parsedBank.beneficiaryName,
      country: 'VN',
      bankBin: parsedBank.bankBin,
      amount: parsedBank.amount, // Optional amount from QR
      memo: parsedBank.memo, // Optional memo from QR
    };

    // 4. Format response
    if (!bank) {
      // Bank account not registered
      return {
        type: 'offchain',
        bankInfo,
        user: null,
      };
    }

    // Bank account is registered - return user info
    const defaultOnchain = bank.user.onchainWallets[0];
    const defaultOffchain = bank.user.offchainWallets[0];

    const defaultWallet = defaultOnchain
      ? {
          type: 'onchain',
          address: defaultOnchain.address,
          chain: defaultOnchain.chain,
        }
      : defaultOffchain
      ? {
          type: 'offchain',
          bankName: defaultOffchain.bankName,
          accountNumber: defaultOffchain.accountNumber,
          accountName: defaultOffchain.accountName,
        }
      : null;

    return {
      type: 'offchain',
      bankInfo,
      user: {
        username: bank.user.username,
        defaultWallet,
      },
    };
  }
}
