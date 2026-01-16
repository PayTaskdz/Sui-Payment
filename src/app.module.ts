import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AppConfigModule } from './config/config.module';
import { GaianModule } from './integrations/gaian/gaian.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OnchainWalletsModule } from './wallets/onchain/onchain-wallets.module';
import { OffchainWalletsModule } from './wallets/offchain/offchain-wallets.module';
import { PaymentMethodsModule } from './payment-methods/payment-methods.module';
import { KycModule } from './kyc/kyc.module';
import { ContactsModule } from './contacts/contacts.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    AppConfigModule,
    GaianModule,
    AuthModule,
    UsersModule,
    OnchainWalletsModule,
    OffchainWalletsModule,
    PaymentMethodsModule,
    KycModule,
    ContactsModule,
  ],
})
export class AppModule {}
