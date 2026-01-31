import { Module } from '@nestjs/common';
import { TransferController } from './transfer.controller';
import { TransferService } from './transfer.service';
import { GaianModule } from '../../gaian/gaian.module';

@Module({
  imports: [GaianModule],
  controllers: [TransferController],
  providers: [TransferService],
})
export class TransferModule {}
