import { Module } from '@nestjs/common';
import { TransferController } from './transfer.controller';
import { TransferService } from './transfer.service';
import { GaianClientModule } from '../../gaian/gaian.module';
import { BlockchainModule } from '../../integrations/blockchain/blockchain.module';

@Module({
  imports: [GaianClientModule, BlockchainModule],
  controllers: [TransferController],
  providers: [TransferService],
})
export class TransferModule {}
