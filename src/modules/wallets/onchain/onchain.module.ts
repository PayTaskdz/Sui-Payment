import { Module } from '@nestjs/common';
import { OnchainController } from './onchain.controller';
import { OnchainService } from './onchain.service';
import { BlockchainModule } from '../../../integrations/blockchain/blockchain.module';

@Module({
  imports: [BlockchainModule],
  controllers: [OnchainController],
  providers: [OnchainService],
  exports: [OnchainService],
})
export class OnchainWalletsModule {}
