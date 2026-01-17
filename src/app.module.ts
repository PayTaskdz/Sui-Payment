import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { TransferModule } from './modules/transfer/transfer.module';
import { UsersModule } from './modules/users/users.module';
import { KycModule } from './modules/kyc/kyc.module';
import { OnchainWalletsModule } from './modules/wallets/onchain/onchain.module';
import { OffchainWalletsModule } from './modules/wallets/offchain/offchain.module';
import { PaymentMethodsModule } from './modules/payment-methods/payment-methods.module';
import { GaianModule } from './integrations/gaian/gaian.module';
import { BlockchainModule } from './integrations/blockchain/blockchain.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    AuthModule,
    WalletModule,
    TransferModule,
    UsersModule,
    KycModule,
    OnchainWalletsModule,
    OffchainWalletsModule,
    PaymentMethodsModule,
    GaianModule,
    BlockchainModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
