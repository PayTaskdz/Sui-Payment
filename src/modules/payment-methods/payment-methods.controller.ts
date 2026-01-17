import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { PaymentMethodsService } from './payment-methods.service';
import { SetDefaultWalletDto } from './dto/set-default-wallet.dto';

@Controller('payment-methods')
export class PaymentMethodsController {
  constructor(private readonly paymentMethodsService: PaymentMethodsService) {}

  /**
   * POST /payment-methods/default?userId=xxx
   * UC5: Set default wallet (onchain or offchain)
   */
  @Post('default')
  async setDefault(
    @Query('userId') userId: string,
    @Body() dto: SetDefaultWalletDto,
  ) {
    return this.paymentMethodsService.setDefaultWallet(
      userId,
      dto.walletId,
      dto.walletType,
    );
  }

  /**
   * GET /payment-methods/default?userId=xxx
   * Get current default wallet
   */
  @Get('default')
  async getDefault(@Query('userId') userId: string) {
    return this.paymentMethodsService.getDefaultWallet(userId);
  }
}
