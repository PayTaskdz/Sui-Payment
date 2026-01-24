import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaModule } from '../prisma/prisma.module';
import { GoogleOidcService } from './google-oidc.service';
import { SuiModule } from '../sui/sui.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { GaianClientModule } from '../gaian/gaian.module';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    SuiModule,
    GaianClientModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'dev_secret_change_me',
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN') ?? '7d' as any,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, GoogleOidcService],
  exports: [AuthService],
})
export class AuthModule {}

