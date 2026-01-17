import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { SuiModule } from './sui/sui.module';
import { GaianModule } from './gaian/gaian.module';
import { PaymentsModule } from './payments/payments.module';
import { AuthModule } from './auth/auth.module';
import { ProverModule } from './prover/prover.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    HttpModule,
    ScheduleModule.forRoot(),
    PrismaModule,
    SuiModule,
    GaianModule,
    PaymentsModule,
    AuthModule,
    ProverModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
