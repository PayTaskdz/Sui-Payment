import { Module } from '@nestjs/common';
import { WalletController } from '../wallets/wallet.controller';
import { AuthModule } from '../../auth/auth.module';
import { PaymentMethodsModule } from '../payment-methods/payment-methods.module';

@Module({
  imports: [AuthModule, PaymentMethodsModule],
  controllers: [WalletController],
})
export class WalletModule {}
