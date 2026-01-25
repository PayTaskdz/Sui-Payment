import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './config/config.module';
import { AuthModule } from './auth/auth.module';
import { WalletModule } from './modules/wallets/wallet.module';
import { TransferModule } from './modules/transfer/transfer.module';
import { UsersModule } from './modules/users/users.module';
import { KycModule } from './modules/kyc/kyc.module';
import { OnchainWalletsModule } from './modules/wallets/onchain/onchain.module';
import { OffchainWalletsModule } from './modules/wallets/offchain/offchain.module';
import { PaymentMethodsModule } from './modules/payment-methods/payment-methods.module';
import { GaianClientModule } from './gaian/gaian.module';
// Payment & Sui Modules
import { SuiModule } from './sui/sui.module';
import { PaymentsModule } from './payments/payments.module';
import { ProverModule } from './prover/prover.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    AppConfigModule,
    // Core Modules (Linked)
    AuthModule,
    UsersModule,
    KycModule,
    WalletModule,
    TransferModule,
    OnchainWalletsModule,
    OffchainWalletsModule,
    PaymentMethodsModule,
    GaianClientModule,
    // Feature Modules (Payment & Sui)
    PaymentsModule,
    SuiModule,
    ProverModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
