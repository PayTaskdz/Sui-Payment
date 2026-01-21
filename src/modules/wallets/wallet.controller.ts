import { Controller, Post, Get, Body, Query, BadRequestException } from '@nestjs/common';
import { AuthService } from '../../auth/auth.service';
import { PaymentMethodsService } from '../payment-methods/payment-methods.service';
import { RegisterDto } from '../../auth/dto/register.dto';

@Controller('wallet')
export class WalletController {
  constructor(
    private readonly authService: AuthService,
    private readonly paymentMethodsService: PaymentMethodsService,
  ) {}

  /**
   * POST /wallet/register
   * Register new user with username, wallet address and optional referral username
   */
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    if (!dto.walletAddress) {
      throw new BadRequestException('walletAddress is required');
    }
    return this.authService.registerUser(dto);
  }

  /**
   * GET /wallet/check-wallet?address=xxx
   * Check if wallet is registered and return full user info
   */
  @Get('check-wallet')
  async checkWallet(@Query('address') address: string) {
    if (!address) {
      throw new BadRequestException('Wallet address is required');
    }

    const user = await this.authService.login(address);

    // Not registered
    if (!user) {
      return {
        isRegistered: false,
      };
    }

    // Registered - return full user info
    // Get all wallets
    const onchainWallets = user.onchainWallets || [];
    const offchainWallets = user.offchainWallets || [];

    // Find receive wallet (isDefault = true)
    const defaultOnchain = onchainWallets.find((w: any) => w.isDefault);
    const defaultOffchain = offchainWallets.find((w: any) => w.isDefault);

    let receiveWallet = null;
    if (defaultOnchain) {
      receiveWallet = {
        type: 'onchain',
        id: defaultOnchain.id,
        address: defaultOnchain.address,
        chain: defaultOnchain.chain,
        label: defaultOnchain.label,
      };
    } else if (defaultOffchain) {
      receiveWallet = {
        type: 'offchain',
        id: defaultOffchain.id,
        bankName: defaultOffchain.bankName,
        accountNumber: defaultOffchain.accountNumber,
        accountName: defaultOffchain.accountName,
        label: defaultOffchain.label,
      };
    }

    return {
      isRegistered: true,
      userId: user.id,
      username: user.username,
      kycStatus: user.kycStatus,
      transferWallet: {
        address: user.walletAddress, // Fixed transfer wallet
        chain: 'Sui',
      },
      receiveWallet, // Can be changed by user
      wallets: {
        onchain: onchainWallets.map((w: any) => ({
          id: w.id,
          address: w.address,
          chain: w.chain,
          label: w.label,
          isDefault: w.isDefault,
          isActive: w.isActive,
        })),
        offchain: offchainWallets.map((w: any) => ({
          id: w.id,
          bankName: w.bankName,
          accountNumber: w.accountNumber,
          accountName: w.accountName,
          label: w.label,
          isDefault: w.isDefault,
          isActive: w.isActive,
        })),
      },
    };
  }

  /**
   * POST /wallet/default-receive
   * Set default wallet for receiving transfers
   */
  @Post('default-receive')
  async setDefaultReceive(
    @Body() body: { userId: string; walletId: string; walletType: 'onchain' | 'offchain' },
  ) {
    const { userId, walletId, walletType } = body;

    if (!userId || !walletId || !walletType) {
      throw new BadRequestException('userId, walletId, and walletType are required');
    }

    return this.paymentMethodsService.setDefaultWallet(userId, walletId, walletType);
  }
}
