import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsPoller } from './payments.poller';
import { GaianModule } from '../gaian/gaian.module';
import { SuiModule } from '../sui/sui.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [GaianModule, SuiModule, PrismaModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsPoller],
  exports: [PaymentsService],
})
export class PaymentsModule {}

