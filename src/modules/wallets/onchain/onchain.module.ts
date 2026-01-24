import { Module } from '@nestjs/common';
import { OnchainController } from './onchain.controller';
import { OnchainService } from './onchain.service';
import { SuiModule } from '../../../sui/sui.module';

@Module({
  imports: [SuiModule],
  controllers: [OnchainController],
  providers: [OnchainService],
  exports: [OnchainService],
})
export class OnchainWalletsModule {}
