import { Module } from '@nestjs/common';
import { TransferController } from './transfer.controller';
import { TransferService } from './transfer.service';
import { GaianClientModule } from '../../gaian/gaian.module';
import { SuiModule } from '../../sui/sui.module';

@Module({
  imports: [GaianClientModule, SuiModule],
  controllers: [TransferController],
  providers: [TransferService],
})
export class TransferModule {}
