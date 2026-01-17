import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { KycModule } from './modules/kyc/kyc.module';
import { OnchainWalletsModule } from './modules/wallets/onchain/onchain.module';
import { OffchainWalletsModule } from './modules/wallets/offchain/offchain.module';
import { PaymentMethodsModule } from './modules/payment-methods/payment-methods.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { GaianModule } from './integrations/gaian/gaian.module';
import { BlockchainModule } from './integrations/blockchain/blockchain.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    KycModule,
    OnchainWalletsModule,
    OffchainWalletsModule,
    PaymentMethodsModule,
    ContactsModule,
    GaianModule,
    BlockchainModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
