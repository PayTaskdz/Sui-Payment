import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PaymentMethodsService } from './payment-methods.service';
import { SetDefaultWalletDto } from './dto/set-default-wallet.dto';

@ApiTags('PaymentMethods')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('payment-methods')
export class PaymentMethodsController {
  constructor(private readonly paymentMethodsService: PaymentMethodsService) {}

  /**
   * POST /payment-methods/default?userId=xxx
   * UC5: Set default wallet (onchain or offchain)
   */
  @Post('default')
  async setDefault(@Req() req: any, @Body() dto: SetDefaultWalletDto) {
    return this.paymentMethodsService.setDefaultWallet(
      req.user.userId,
      dto.walletId,
      dto.walletType,
    );
  }

  /**
   * GET /payment-methods/default?userId=xxx
   * Get current default wallet
   */
  @Get('default')
  async getDefault(@Req() req: any) {
    return this.paymentMethodsService.getDefaultWallet(req.user.userId);
  }
}
